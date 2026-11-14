"""
Wandelt die Z-Anatomy-Blenderdatei in GLB-Dateien pro App-Ebene um.

Aufruf (mit Blender als Python-Modul, `pip install bpy`):
    python blender_export.py <Startup.blend> <ausgabe-ordner>

Was passiert:
1. Für jede Ebene aus export_konfig.json werden alle echten Meshes der genannten
   Sammlungen gesammelt. Hilfsobjekte von Z-Anatomy (Beschriftungen .t,
   Beschriftungslinien .j/.i, Gruppenlabels .g) werden übersprungen.
2. Modifikatoren werden angewendet (Unterteilung höchstens bis `subsurf_max`,
   damit die Modelle für das iPad leicht bleiben) und die Weltposition wird
   fest eingerechnet.
3. Jede Struktur bleibt ein eigenes Objekt mit ihrem Originalnamen
   (z. B. "Femur.l"), damit sie in der App einzeln antippbar ist.
4. Für Knochen werden zusätzlich die Ankerpunkte der Markierungen
   (z. B. "Greater trochanter") exportiert und dem nächstgelegenen Knochen
   zugeordnet.
Ausgabe: <ebene>.roh.glb, <ebene>.meshes.json und knochen.markierungen.json.
Danach komprimiert optimieren.mjs die Dateien.
"""
import bpy, bmesh, json, re, sys, os, mathutils
from mathutils.bvhtree import BVHTree

HIER = os.path.dirname(os.path.abspath(__file__))
blend, ausgabe = sys.argv[-2], sys.argv[-1]
os.makedirs(ausgabe, exist_ok=True)
konfig = json.load(open(os.path.join(HIER, "export_konfig.json"), encoding="utf8"))
lizenz_ausschluss = re.compile(konfig["lizenz_ausschluss"].replace("(?i)", ""), re.I)
HILFSOBJEKT = re.compile(r"\.(t|j|i|g)$")

bpy.ops.wm.open_mainfile(filepath=blend)
szene = bpy.context.scene


def y_oben(v):
    """Blender ist Z-oben, glTF/Three.js ist Y-oben: (x, y, z) -> (x, z, -y)."""
    return [round(v.x, 5), round(v.z, 5), round(-v.y, 5)]


def echte_meshes(sammlungen, ausschliessen=None):
    ausschl = re.compile(ausschliessen) if ausschliessen else None
    gesehen, liste = set(), []
    for name in sammlungen:
        for o in bpy.data.collections[name].all_objects:
            if o.type != "MESH" or o.name in gesehen:
                continue
            gesehen.add(o.name)
            if HILFSOBJEKT.search(o.name) or len(o.data.vertices) <= 4:
                continue
            if ausschl and ausschl.search(o.name):
                continue
            if lizenz_ausschluss.search(o.name):
                print("Lizenz-Ausschluss:", o.name)
                continue
            liste.append(o)
    return liste


def flache_kopien(objekte, subsurf_max, ziel):
    """Erzeugt neue Objekte mit angewendeten Modifikatoren in Weltkoordinaten.
    Alles in einem Durchgang, weil jede Neuberechnung der Szene teuer ist."""
    gespeichert = []
    for o in objekte:
        # Versteckte Objekte werden nicht ausgewertet -> einblenden.
        o.hide_viewport = False
        for m in o.modifiers:
            if m.type == "SUBSURF":
                gespeichert.append((m, m.levels))
                m.levels = min(m.levels, subsurf_max)
    deps = bpy.context.evaluated_depsgraph_get()
    deps.update()
    kopien = []
    for o in objekte:
        ev = o.evaluated_get(deps)
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=False, depsgraph=deps)
        me.transform(o.matrix_world)
        neu = bpy.data.objects.new(o.name + "#", me)
        ziel.objects.link(neu)
        kopien.append((o, neu))
    for m, lv in gespeichert:
        m.levels = lv
    return kopien


for ebene, cfg in konfig["ebenen"].items():
    quellen = echte_meshes(cfg["sammlungen"], cfg.get("ausschliessen"))
    ziel = bpy.data.collections.new("EXPORT_" + ebene)
    szene.collection.children.link(ziel)
    info = []
    kopien = flache_kopien(quellen, cfg.get("subsurf_max", 1), ziel)
    # Erst nach dem Kopieren umbenennen, damit Namen exakt dem Original entsprechen.
    for o, k in kopien:
        o.name = o.name + "~quelle"
    for o, k in kopien:
        k.name = o.name.replace("~quelle", "")
        if k.name != o.name.replace("~quelle", ""):
            raise SystemExit("Name nicht eindeutig: " + k.name)
        bb = [k.matrix_world @ mathutils.Vector(c) for c in k.bound_box]
        mitte = sum(bb, mathutils.Vector()) / 8
        info.append({
            "name": k.name,
            "ecken": len(k.data.vertices),
            "dreiecke": sum(len(p.vertices) - 2 for p in k.data.polygons),
            "mitte": y_oben(mitte),
            "materialien": [s.material.name for s in k.material_slots if s.material],
            # Z-Anatomy-Sammlungen (Region, Gruppe) – daraus entsteht die Baumansicht
            "sammlungen": [c.name for c in o.users_collection],
        })
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
    print(f"{ebene}: {len(info)} Meshes, {sum(i['dreiecke'] for i in info)} Dreiecke -> {pfad}")

    if cfg.get("markierungen"):
        # BVH-Bäume der exportierten Knochen für die Zuordnung der Ankerpunkte
        baeume = []
        for o, k in kopien:
            bm = bmesh.new(); bm.from_mesh(k.data)
            baeume.append((k.name, BVHTree.FromBMesh(bm)))
            bm.free()
        anker = [o for name in cfg["sammlungen"] for o in bpy.data.collections[name].all_objects
                 if o.type == "MESH" and o.name.endswith(".j")]
        for o in anker:
            o.hide_viewport = False
        deps = bpy.context.evaluated_depsgraph_get()
        deps.update()
        punkte = []
        for o in anker:
            if True:
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
