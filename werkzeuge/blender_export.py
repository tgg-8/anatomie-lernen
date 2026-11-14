"""
Wandelt die Z-Anatomy-Blenderdatei in GLB-Dateien pro App-Ebene um.

Aufruf (mit Blender als Python-Modul, `pip install bpy`):
    python blender_export.py <Startup.blend> <ausgabe-ordner>
Nur bestimmte Ebenen:  EBENEN=muskeln,faszien python blender_export.py ...

Was passiert:
1. Für jede Ebene aus export_konfig.json werden alle echten Objekte (Meshes und
   Kurven, z. B. Gefäße) der genannten Sammlungen gesammelt und nach Namen
   gefiltert. Hilfsobjekte von Z-Anatomy (Beschriftungen .t, Linien .j/.i,
   Gruppenlabels .g) werden übersprungen. Jedes Objekt landet in genau einer Ebene.
2. Modifikatoren werden angewendet (Unterteilung höchstens bis `subsurf_max`)
   und die Weltposition fest eingerechnet. Kurven werden zu Röhren.
3. Jede Struktur bleibt ein eigenes Objekt mit ihrem Originalnamen
   (z. B. "Femur.l"), damit sie in der App einzeln antippbar ist.
4. Sonderfälle:
   - knochen: Ankerpunkte der Markierungen (z. B. "Greater trochanter")
   - muskeln: Aufteilung in oberflächlich/tief per Sichtbarkeit von außen
   - unterhaut: schematische Schale, aus der Haut nach innen versetzt
Ausgabe: <ebene>.roh.glb und <ebene>.meshes.json (+ knochen.markierungen.json).
Danach komprimiert optimieren.mjs die Dateien.
"""
import bpy, bmesh, json, re, sys, os, math, bisect, mathutils
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HIER = os.path.dirname(os.path.abspath(__file__))
blend, ausgabe = sys.argv[-2], sys.argv[-1]
os.makedirs(ausgabe, exist_ok=True)
konfig = json.load(open(os.path.join(HIER, "export_konfig.json"), encoding="utf8"))
NUR = set(filter(None, os.environ.get("EBENEN", "").split(",")))
lizenz_ausschluss = re.compile(konfig["lizenz_ausschluss"])
HILFSOBJEKT = re.compile(r"\.(t|j|i|g)$")

bpy.ops.wm.open_mainfile(filepath=blend)
szene = bpy.context.scene
# Alle Quellobjekte zusätzlich in eine sichtbare Sammlung legen, damit Blender sie sicher auswertet.
QUELLEN = bpy.data.collections.new("QUELLEN_SICHTBAR")
szene.collection.children.link(QUELLEN)


def y_oben(v):
    """Blender ist Z-oben, glTF/Three.js ist Y-oben: (x, y, z) -> (x, z, -y)."""
    return [round(v.x, 5), round(v.z, 5), round(-v.y, 5)]


vergeben = set()  # Objekte, die schon einer Ebene zugeordnet sind


def sammle(cfg):
    einschl = re.compile(cfg["einschliessen"]) if cfg.get("einschliessen") else None
    ausschl = re.compile(cfg["ausschliessen"]) if cfg.get("ausschliessen") else None
    erlaubt = re.compile(cfg["erlauben"]) if cfg.get("erlauben") else None
    nur_aus = {k: re.compile(v) for k, v in cfg.get("nur_aus_sammlung", {}).items()}
    liste = []
    for sname in cfg["sammlungen"]:
        for o in bpy.data.collections[sname].all_objects:
            if o.type not in ("MESH", "CURVE") or o.name in vergeben or HILFSOBJEKT.search(o.name):
                continue
            if o.type == "MESH" and len(o.data.vertices) <= 4:
                continue
            n = o.name
            if sname in nur_aus and not nur_aus[sname].search(n):
                continue
            if einschl and not einschl.search(n):
                continue
            if ausschl and ausschl.search(n) and not (erlaubt and erlaubt.search(n)):
                continue
            if lizenz_ausschluss.search(n):
                print("Lizenz-Ausschluss:", n)
                continue
            vergeben.add(n)
            liste.append(o)
    return liste


def flache_kopien(objekte, subsurf_max, ziel, ohne_solidify=False):
    """Erzeugt neue Mesh-Objekte mit angewendeten Modifikatoren in Weltkoordinaten."""
    gespeichert = []
    for o in objekte:
        if o.name not in QUELLEN.objects:
            QUELLEN.objects.link(o)
        o.hide_viewport = False
        o.hide_set(False)
        for m in o.modifiers:
            if m.type == "SUBSURF":
                gespeichert.append((m, "levels", m.levels))
                m.levels = min(m.levels, subsurf_max)
            if ohne_solidify and m.type == "SOLIDIFY":
                gespeichert.append((m, "show_viewport", m.show_viewport))
                m.show_viewport = False
        if o.type == "CURVE":  # Röhren nicht unnötig fein
            gespeichert.append((o.data, "bevel_resolution", o.data.bevel_resolution))
            gespeichert.append((o.data, "resolution_u", o.data.resolution_u))
            o.data.bevel_resolution = min(o.data.bevel_resolution, 1)
            o.data.resolution_u = min(o.data.resolution_u, 6)
    deps = bpy.context.evaluated_depsgraph_get()
    deps.update()
    kopien = []
    for o in objekte:
        ev = o.evaluated_get(deps)
        try:
            me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=False, depsgraph=deps)
        except RuntimeError:
            continue
        if len(me.polygons) == 0:  # z. B. Kurve ohne Querschnitt
            bpy.data.meshes.remove(me)
            continue
        me.transform(o.matrix_world)
        if o.type == "CURVE" and not me.materials and o.data.materials:
            for mat in o.data.materials:
                me.materials.append(mat)
        neu = bpy.data.objects.new(o.name + "#", me)
        ziel.objects.link(neu)
        kopien.append((o, neu))
    for obj, attr, wert in gespeichert:
        setattr(obj, attr, wert)
    return kopien


def info_von(o, k):
    bb = [k.matrix_world @ Vector(c) for c in k.bound_box]
    return {
        "name": k.name,
        "ecken": len(k.data.vertices),
        "dreiecke": sum(len(p.vertices) - 2 for p in k.data.polygons),
        "mitte": y_oben(sum(bb, Vector()) / 8),
        "materialien": [s.material.name for s in k.material_slots if s.material],
        # Z-Anatomy-Sammlungen (Region, Gruppe, versorgender Nerv) – Grundlage für Baum und Daten
        "sammlungen": [c.name for c in o.users_collection if c != QUELLEN] if o else [],
    }


def exportiere(ebene, kopien, zusatz=None):
    """Schreibt <ebene>.roh.glb und <ebene>.meshes.json. Kopien tragen den Originalnamen."""
    info = []
    for o, k in kopien:
        eintrag = info_von(o, k)
        if zusatz:
            eintrag.update(zusatz.get(k.name, {}))
        info.append(eintrag)
    bpy.ops.object.select_all(action="DESELECT")
    for o, k in kopien:
        k.select_set(True)
    pfad = os.path.join(ausgabe, f"{ebene}.roh.glb")
    bpy.ops.export_scene.gltf(
        filepath=pfad, export_format="GLB", use_selection=True,
        export_apply=False, export_yup=True, export_normals=True,
        export_texcoords=False, export_materials="EXPORT",
        export_animations=False, export_extras=False, export_cameras=False,
        export_lights=False,
    )
    json.dump({"ebene": ebene, "meshes": info}, open(os.path.join(ausgabe, f"{ebene}.meshes.json"), "w", encoding="utf8"), ensure_ascii=False, indent=0)
    print(f"{ebene}: {len(info)} Teile, {sum(i['dreiecke'] for i in info)} Dreiecke -> {pfad}")


def originalnamen(kopien):
    """Kopien bekommen exakt den Originalnamen (Original wird dafür umbenannt)."""
    for o, k in kopien:
        alt = o.name
        o.name = alt + "~quelle"
        k.name = alt
        if k.name != alt:
            raise SystemExit("Name nicht eindeutig: " + alt)


def bvh_aus(kopien):
    """Ein gemeinsamer BVH-Baum über mehrere Objekte + Zuordnung Polygon -> Objekt."""
    verts, polys, grenzen, namen = [], [], [], []
    for _, k in kopien:
        basis = len(verts)
        verts.extend(v.co.copy() for v in k.data.vertices)
        polys.extend([basis + i for i in p.vertices] for p in k.data.polygons)
        grenzen.append(len(polys))
        namen.append(k.name)
    return BVHTree.FromPolygons(verts, polys), grenzen, namen


def oberflaechlich_berechnen(kopien, cfg, knochen_baum):
    """
    Oberflächlich = ein nennenswerter Teil des Muskels ist von außen direkt sichtbar.
    Parallele Teststrahlen aus 8 waagerechten Richtungen (vorn, hinten, seitlich, schräg):
      - "sichtbar": der Muskel ist das ERSTE, was der Strahl trifft (Knochen verdecken)
      - "gesamt":   der Strahl durchquert den Muskel irgendwo
    Anteil = sichtbar / gesamt. Oberflächlich, wenn Anteil >= schwelle_anteil
    und mindestens schwelle_treffer Strahlen den Muskel als ersten treffen.
    """
    baum, grenzen, namen = bvh_aus(kopien)
    alle = [k.matrix_world @ Vector(c) for _, k in kopien for c in k.bound_box]
    mn = Vector((min(p.x for p in alle), min(p.y for p in alle), min(p.z for p in alle)))
    mx = Vector((max(p.x for p in alle), max(p.y for p in alle), max(p.z for p in alle)))
    mitte, radius = (mn + mx) / 2, (mx - mn).length / 2 + 0.05
    schritt = cfg.get("raster_mm", 8) / 1000
    richtungen = [Vector(d).normalized() for d in [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0),
                                                  (1, 1, 0), (1, -1, 0), (-1, 1, 0), (-1, -1, 0)]]
    sichtbar = {n: 0 for n in namen}
    gesamt = {n: 0 for n in namen}
    for d in richtungen:
        u = Vector((0, 0, 1))          # senkrecht (Körperlängsachse)
        v = d.cross(u).normalized()     # waagerecht quer zur Blickrichtung
        nz = int((mx.z - mn.z) / schritt) + 1
        nv = int(2 * radius / schritt)
        for i in range(nz):
            z = mn.z + i * schritt
            for j in range(nv):
                start = Vector((mitte.x, mitte.y, z)) - d * radius * 1.5 + v * (-radius + j * schritt)
                loc, _, idx, dist = baum.ray_cast(start, d, radius * 3)
                if idx is None:
                    continue
                erster = namen[bisect.bisect_right(grenzen, idx)]
                kloc, _, kidx, kdist = knochen_baum.ray_cast(start, d, radius * 3)
                if kidx is None or kdist > dist:
                    sichtbar[erster] += 1
                # alle Muskeln entlang des Strahls zählen (jeden nur einmal pro Strahl)
                gesehen = {erster}
                p = loc + d * 1e-4
                for _ in range(40):
                    loc2, _, idx2, _ = baum.ray_cast(p, d, radius * 3)
                    if idx2 is None:
                        break
                    gesehen.add(namen[bisect.bisect_right(grenzen, idx2)])
                    p = loc2 + d * 1e-4
                for n in gesehen:
                    gesamt[n] += 1
    ergebnis, werte = {}, {}
    for name in namen:
        anteil = sichtbar[name] / gesamt[name] if gesamt[name] else 0
        werte[name] = {"sichtbar": sichtbar[name], "gesamt": gesamt[name], "anteil": round(anteil, 3)}
        basis = re.sub(r"\.[lr]$", "", name)
        if basis in cfg.get("immer_oberflaechlich", []):
            ergebnis[name] = True
        elif basis in cfg.get("immer_tief", []):
            ergebnis[name] = False
        else:
            ergebnis[name] = sichtbar[name] >= cfg.get("schwelle_treffer", 6) and anteil >= cfg.get("schwelle_anteil", 0.3)
    return ergebnis, werte


def schale(haut_objekte, knochen_baum, cfg):
    """Schematische Unterhaut: Hautfläche (ohne Dicke) um versatz_mm nach innen versetzt, zu einem Teil vereint."""
    ziel = bpy.data.collections.new("EXPORT_unterhaut")
    szene.collection.children.link(ziel)
    teile = flache_kopien(haut_objekte, 0, ziel, ohne_solidify=True)
    versatz = cfg.get("versatz_mm", 7) / 1000
    bm_gesamt = bmesh.new()
    for o, k in teile:
        bm = bmesh.new()
        bm.from_mesh(k.data)
        bm.normal_update()
        # Richtung "nach außen" = weg vom nächsten Knochen. Danach Normalen ggf. umdrehen.
        summe = 0.0
        for vert in list(bm.verts)[:: max(1, len(bm.verts) // 30)]:
            loc, _, _, _ = knochen_baum.find_nearest(vert.co)
            if loc is not None:
                summe += vert.normal.dot(vert.co - loc)
        vorzeichen = 1 if summe >= 0 else -1
        for vert in bm.verts:
            vert.co -= vert.normal * vorzeichen * versatz
        me = bpy.data.meshes.new("tmp")
        bm.to_mesh(me)
        bm.free()
        bm_gesamt.from_mesh(me)
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(cfg["name"])
    bm_gesamt.to_mesh(me)
    bm_gesamt.free()
    mat = bpy.data.materials.new("Fat-schematic")
    me.materials.append(mat)
    obj = bpy.data.objects.new(cfg["name"], me)
    ziel.objects.link(obj)
    for o, k in teile:
        bpy.data.objects.remove(k)
    return [(None, obj)]


knochen_baum = None
haut_quellen = []
for ebene, cfg in konfig["ebenen"].items():
    if "schale_von" in cfg:
        if (NUR and ebene not in NUR) or knochen_baum is None:
            continue
        exportiere(ebene, schale(haut_quellen, knochen_baum, cfg))
        continue
    quellen = sammle(cfg)
    if ebene == "haut":
        haut_quellen = quellen
    if NUR and ebene not in NUR and ebene not in ("knochen", "haut"):
        continue
    ziel = bpy.data.collections.new("EXPORT_" + ebene)
    szene.collection.children.link(ziel)
    kopien = flache_kopien(quellen, cfg.get("subsurf_max", 1), ziel)
    originalnamen(kopien)

    if ebene == "knochen":
        knochen_baum, _, _ = bvh_aus(kopien)
    if NUR and ebene not in NUR:
        continue

    if "aufteilen" in cfg:
        a = cfg["aufteilen"]
        oben, werte = oberflaechlich_berechnen(kopien, a, knochen_baum)
        zusatz = {n: {"sichtbarkeit": werte[n]} for n in werte}
        exportiere(a["oberflaechlich"], [(o, k) for o, k in kopien if oben[k.name]], zusatz)
        exportiere(a["tief"], [(o, k) for o, k in kopien if not oben[k.name]], zusatz)
    else:
        exportiere(ebene, kopien)

    if cfg.get("markierungen"):
        baeume = []
        for o, k in kopien:
            bm = bmesh.new(); bm.from_mesh(k.data)
            baeume.append((k.name, BVHTree.FromBMesh(bm)))
            bm.free()
        anker = [o for name in cfg["sammlungen"] for o in bpy.data.collections[name].all_objects
                 if o.type == "MESH" and o.name.endswith(".j")]
        for o in anker:
            if o.name not in QUELLEN.objects:
                QUELLEN.objects.link(o)
            o.hide_viewport = False
        deps = bpy.context.evaluated_depsgraph_get()
        deps.update()
        punkte = []
        for o in anker:
            ev = o.evaluated_get(deps)
            me = ev.to_mesh()
            best = None
            for v in me.vertices:
                w = o.matrix_world @ v.co
                for knochen, baum in baeume:
                    loc, nor, idx, dist = baum.find_nearest(w)
                    if loc is not None and (best is None or dist < best[0]):
                        best = (dist, knochen, loc)
            ev.to_mesh_clear()
            if best and best[0] < 0.02:  # max. 2 cm Abstand zur Knochenoberfläche
                punkte.append({"name": o.name[:-2].strip("()"), "knochen": best[1],
                               "pos": y_oben(best[2]), "abstand_mm": round(best[0] * 1000, 1)})
        json.dump(punkte, open(os.path.join(ausgabe, "knochen.markierungen.json"), "w", encoding="utf8"), ensure_ascii=False, indent=0)
        print(f"Markierungen: {len(punkte)}")
