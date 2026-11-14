// Lädt die 3D-Ebenen (GLB-Dateien) und verwaltet den Zustand jedes 3D-Teils:
// sichtbar / ausgeblendet / transparent / isoliert / ausgewählt.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import type { Daten, EbeneDef } from '../typen';
import type { Szene } from './szene';

// three-mesh-bvh beschleunigt das Antippen (Raycasting) bei Hunderttausenden Dreiecken.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/** Farben nach Gewebeart (Materialname aus Z-Anatomy). */
function gewebefarbe(materialname: string, ebenenfarbe: string): string {
  const n = materialname.toLowerCase();
  if (n.startsWith('bone')) return '#eee3cc';
  if (n.startsWith('suture')) return '#d8c7a5';
  if (n.includes('cartilage')) return '#bcdcec';
  if (n.includes('tooth') || n.includes('enamel') || n.includes('dentin')) return '#fbfaf2';
  if (n.includes('ligament')) return '#dfe6ee';
  if (n.includes('capsule')) return '#b9cde3';
  if (n.includes('fat')) return '#f1dc95';
  if (n.startsWith('skin')) return '#e6b597';
  return ebenenfarbe;
}

export type TeilZustand = 'normal' | 'versteckt' | 'transparent';

/** Ein antippbares 3D-Teil, z. B. "Femur.l". */
export interface Teil {
  meshName: string;
  strukturId: string;
  ebene: string;
  objekt: THREE.Object3D;
  meshes: THREE.Mesh[];
  zustand: TeilZustand;
}

interface EbenenZustand {
  def: EbeneDef;
  sichtbar: boolean;
  deckkraft: number;
  geladen: boolean;
  laedt?: Promise<void>;
  gruppe?: THREE.Group;
}

const AUSWAHL_FARBE = new THREE.Color('#ff7a1a');

export class Modell {
  readonly teile = new Map<string, Teil>();
  readonly ebenen = new Map<string, EbenenZustand>();
  private isoliert: Set<string> | null = null;
  private ausgewaehlt: Teil | null = null;
  private loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  /** Benachrichtigt die Oberfläche, wenn sich Zustände ändern. */
  beiAenderung: (() => void)[] = [];

  constructor(private szene: Szene, private daten: Daten) {
    for (const def of daten.ebenen) {
      this.ebenen.set(def.id, {
        def, sichtbar: !!def.start_sichtbar && def.verfuegbar, deckkraft: def.start_deckkraft ?? 1, geladen: false,
      });
    }
  }

  /** Lädt alle Ebenen, die anfangs sichtbar sind. Andere werden erst beim Einschalten geladen. */
  async ladeStartEbenen() {
    await Promise.all([...this.ebenen.values()].filter((e) => e.sichtbar).map((e) => this.ladeEbene(e.def.id)));
  }

  ladeEbene(id: string): Promise<void> {
    const e = this.ebenen.get(id);
    if (!e || !e.def.verfuegbar || !e.def.datei) return Promise.resolve();
    if (e.laedt) return e.laedt;
    e.laedt = (async () => {
      const gltf = await this.loader.loadAsync(`./modelle/${e.def.datei}`);
      const gruppe = gltf.scene;
      gruppe.name = `ebene:${id}`;
      const vorlage = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0 });
      gruppe.traverse((o) => {
        // Three.js entfernt Punkte aus Objektnamen ("Femur.l" -> "Femurl");
        // der Originalname aus der GLB-Datei steht in userData.name.
        const name = (o.userData.name as string | undefined) ?? o.name;
        const strukturId = this.daten.meshIndex[name];
        if (!strukturId || this.teile.has(name)) return;
        o.name = name;
        const meshes: THREE.Mesh[] = [];
        o.traverse((k) => {
          if (!(k as THREE.Mesh).isMesh) return;
          const mesh = k as THREE.Mesh;
          const alt = mesh.material as THREE.Material;
          // Jedes Teil bekommt ein eigenes Material, damit es einzeln eingefärbt oder transparent werden kann.
          const mat = vorlage.clone();
          mat.color.set(gewebefarbe(alt.name ?? '', e.def.farbe ?? '#dddddd'));
          mat.side = id === 'knochen' ? THREE.FrontSide : THREE.DoubleSide;
          mat.userData.grundfarbe = mat.color.clone();
          mesh.material = mat;
          alt.dispose();
          mesh.userData.meshName = o.name;
          meshes.push(mesh);
        });
        this.teile.set(o.name, { meshName: o.name, strukturId, ebene: id, objekt: o, meshes, zustand: 'normal' });
      });
      e.gruppe = gruppe;
      e.geladen = true;
      this.szene.szene.add(gruppe);
      this.anwenden();
      // Beschleunigungsstrukturen fürs Antippen im Hintergrund aufbauen (in kleinen Portionen).
      this.bvhImLeerlauf([...this.teile.values()].filter((t) => t.ebene === id));
    })();
    return e.laedt;
  }

  private bvhImLeerlauf(teile: Teil[]) {
    const arbeit = teile.flatMap((t) => t.meshes);
    const schritt = () => {
      const ende = performance.now() + 8;
      while (arbeit.length && performance.now() < ende) {
        const m = arbeit.pop()!;
        try { m.geometry.computeBoundsTree(); } catch { /* ohne BVH funktioniert Antippen trotzdem, nur langsamer */ }
      }
      if (arbeit.length) setTimeout(schritt, 0);
    };
    setTimeout(schritt, 50);
  }

  // ---------- Ebenen ----------
  async setzeEbeneSichtbar(id: string, sichtbar: boolean) {
    const e = this.ebenen.get(id);
    if (!e) return;
    e.sichtbar = sichtbar;
    if (sichtbar && !e.geladen) await this.ladeEbene(id);
    this.anwenden();
  }

  setzeDeckkraft(id: string, wert: number) {
    const e = this.ebenen.get(id);
    if (!e) return;
    e.deckkraft = wert;
    this.anwenden();
  }

  // ---------- Einzelne Teile ----------
  setzeZustand(meshName: string, zustand: TeilZustand) {
    const t = this.teile.get(meshName);
    if (!t) return;
    t.zustand = zustand;
    if (zustand === 'versteckt' && this.ausgewaehlt === t) this.waehle(null);
    this.anwenden();
  }

  /** Zeigt nur noch die angegebenen Teile (z. B. einen Knochen allein). */
  isoliere(meshNamen: string[] | null) {
    this.isoliert = meshNamen ? new Set(meshNamen) : null;
    this.anwenden();
  }
  get istIsoliert() { return this.isoliert !== null; }
  isoliertesTeil(meshName: string) { return !!this.isoliert?.has(meshName); }

  alleEinblenden() {
    for (const t of this.teile.values()) t.zustand = 'normal';
    this.isoliert = null;
    this.anwenden();
  }

  anzahlVersteckt() {
    return [...this.teile.values()].filter((t) => t.zustand === 'versteckt').length;
  }

  /** Wirksame Deckkraft eines Teils (Ebene × eigener Zustand). */
  deckkraftVon(t: Teil) {
    const e = this.ebenen.get(t.ebene)!;
    return e.deckkraft * (t.zustand === 'transparent' ? 0.25 : 1);
  }

  istSichtbar(t: Teil) {
    const e = this.ebenen.get(t.ebene)!;
    if (!e.sichtbar || t.zustand === 'versteckt') return false;
    if (this.isoliert && !this.isoliert.has(t.meshName)) return false;
    return this.deckkraftVon(t) > 0.01;
  }

  /** Überträgt alle Zustände auf die Three.js-Objekte. */
  private anwenden() {
    for (const t of this.teile.values()) {
      const sichtbar = this.istSichtbar(t);
      t.objekt.visible = sichtbar;
      const d = this.deckkraftVon(t);
      for (const m of t.meshes) {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.opacity = d;
        const transparent = d < 0.999;
        if (mat.transparent !== transparent) { mat.transparent = transparent; mat.needsUpdate = true; }
        mat.depthWrite = !transparent;
        const gewaehlt = this.ausgewaehlt === t;
        mat.color.copy(mat.userData.grundfarbe as THREE.Color);
        if (gewaehlt) mat.color.lerp(AUSWAHL_FARBE, 0.55);
        mat.emissive.set(gewaehlt ? AUSWAHL_FARBE : 0x000000);
        mat.emissiveIntensity = gewaehlt ? 0.25 : 0;
      }
      // Transparente Ebenen (z. B. Haut) nach den undurchsichtigen zeichnen.
      t.objekt.renderOrder = d < 0.999 ? 1 : 0;
    }
    this.szene.anfordern();
    for (const f of this.beiAenderung) f();
  }

  // ---------- Auswahl ----------
  waehle(meshName: string | null) {
    this.ausgewaehlt = meshName ? this.teile.get(meshName) ?? null : null;
    this.anwenden();
  }
  get auswahl() { return this.ausgewaehlt; }

  /**
   * Findet das Teil unter einem Bildschirmpunkt.
   * Stark durchsichtige Teile (Deckkraft < 50 %) werden "durchtippt",
   * damit man darunterliegende Strukturen auswählen kann.
   */
  treffer(x: number, y: number): { teil: Teil; punkt: THREE.Vector3 } | null {
    const r = new THREE.Raycaster();
    r.firstHitOnly = true;
    const ndc = new THREE.Vector2((x / this.szene.leinwand.clientWidth) * 2 - 1, -(y / this.szene.leinwand.clientHeight) * 2 + 1);
    r.setFromCamera(ndc, this.szene.kamera);
    const kandidaten = [...this.teile.values()].filter((t) => this.istSichtbar(t) && this.deckkraftVon(t) >= 0.5).flatMap((t) => t.meshes);
    const treffer = r.intersectObjects(kandidaten, false);
    if (!treffer.length) return null;
    const teil = this.teile.get(treffer[0].object.userData.meshName as string);
    return teil ? { teil, punkt: treffer[0].point.clone() } : null;
  }

  /** Mittelpunkt und Box eines Teils in Weltkoordinaten. */
  box(meshName: string): THREE.Box3 | null {
    const t = this.teile.get(meshName);
    return t ? new THREE.Box3().setFromObject(t.objekt) : null;
  }
}
