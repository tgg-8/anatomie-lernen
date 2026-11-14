// Grundgerüst der 3D-Ansicht: Renderer, Kamera, Licht, Touch-Steuerung.
//
// Gesten (OrbitControls von Three.js):
//   1 Finger ziehen  -> drehen
//   2 Finger spreizen -> zoomen (Pinch)
//   2 Finger ziehen  -> verschieben
//
// Es wird nur gezeichnet, wenn sich etwas ändert ("render on demand").
// Das spart Akku und hält die Bildrate hoch.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type Ansicht = 'vorne' | 'hinten' | 'links' | 'rechts' | 'oben' | 'zuruecksetzen';

// Das Modell steht aufrecht, Füße bei y≈0, Kopf bei y≈1,75 m; Blickrichtung des Körpers = +z.
const KOERPER_MITTE = new THREE.Vector3(0, 0.95, 0);
const ABSTAND = 2.6;

export class Szene {
  readonly renderer: THREE.WebGLRenderer;
  readonly kamera: THREE.PerspectiveCamera;
  readonly szene = new THREE.Scene();
  readonly steuerung: OrbitControls;
  private zeichnenAngefordert = false;
  private animation: { start: number; dauer: number; vonPos: THREE.Vector3; zuPos: THREE.Vector3; vonZiel: THREE.Vector3; zuZiel: THREE.Vector3 } | null = null;
  /** Wird nach jedem gezeichneten Bild aufgerufen (z. B. für Beschriftungen). */
  nachDemZeichnen: (() => void)[] = [];

  constructor(readonly leinwand: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas: leinwand, antialias: true, powerPreference: 'high-performance' });
    // Auf dem iPad ist devicePixelRatio 2; mehr bringt nichts und kostet Leistung.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.kamera = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
    this.kamera.position.set(0, KOERPER_MITTE.y, ABSTAND);

    // Licht: Himmel-/Bodenlicht für weiche Grundhelligkeit + Licht, das mit der Kamera mitwandert.
    this.szene.add(new THREE.HemisphereLight(0xffffff, 0x8a8070, 1.6));
    const kameraLicht = new THREE.DirectionalLight(0xffffff, 1.6);
    kameraLicht.position.set(0.5, 1, 1);
    this.kamera.add(kameraLicht);
    this.szene.add(this.kamera);

    this.steuerung = new OrbitControls(this.kamera, leinwand);
    this.steuerung.target.copy(KOERPER_MITTE);
    this.steuerung.enableDamping = true;
    this.steuerung.dampingFactor = 0.12;
    this.steuerung.minDistance = 0.08;
    this.steuerung.maxDistance = 6;
    this.steuerung.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.steuerung.screenSpacePanning = true;
    this.steuerung.addEventListener('change', () => this.anfordern());
    this.steuerung.update();

    new ResizeObserver(() => this.groesseAnpassen()).observe(leinwand);
    this.groesseAnpassen();
    this.kamera.position.z = this.startAbstand();
    this.hintergrundAusCss();
  }

  /** Übernimmt die Hintergrundfarbe aus dem CSS (hell/dunkel). */
  hintergrundAusCss() {
    const farbe = getComputedStyle(document.documentElement).getPropertyValue('--hg').trim() || '#f4f2ee';
    this.szene.background = new THREE.Color(farbe);
    this.anfordern();
  }

  private versatz = { x: 0, y: 0 };

  /**
   * Verschiebt die Bildmitte, damit das Modell nicht hinter offenen Panels liegt.
   * x > 0: Panel rechts (Bild rückt nach links), y > 0: Panel unten (Bild rückt nach oben).
   */
  setzeVersatz(x: number, y: number) {
    this.versatz = { x, y };
    this.groesseAnpassen();
  }

  private groesseAnpassen() {
    const { clientWidth: b, clientHeight: h } = this.leinwand;
    if (!b || !h) return;
    this.renderer.setSize(b, h, false);
    this.kamera.aspect = b / h;
    if (this.versatz.x || this.versatz.y) this.kamera.setViewOffset(b, h, this.versatz.x / 2, this.versatz.y / 2, b, h);
    else this.kamera.clearViewOffset();
    this.kamera.updateProjectionMatrix();
    this.anfordern();
  }

  /** Fordert ein neues Bild an (höchstens eins pro Bildschirm-Aktualisierung). */
  anfordern() {
    if (this.zeichnenAngefordert) return;
    this.zeichnenAngefordert = true;
    requestAnimationFrame((t) => this.zeichnen(t));
  }

  private zeichnen(zeit: number) {
    this.zeichnenAngefordert = false;
    let weiter = false;
    if (this.animation) {
      const a = this.animation;
      const t = Math.min(1, (zeit - a.start) / a.dauer);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // weiche Bewegung
      this.kamera.position.lerpVectors(a.vonPos, a.zuPos, e);
      this.steuerung.target.lerpVectors(a.vonZiel, a.zuZiel, e);
      if (t >= 1) this.animation = null;
      weiter = true;
    }
    // update() liefert true, solange die Dämpfung noch nachschwingt.
    if (this.steuerung.update()) weiter = true;
    this.renderer.render(this.szene, this.kamera);
    for (const f of this.nachDemZeichnen) f();
    if (weiter) this.anfordern();
  }

  /** Bewegt die Kamera weich zu einer neuen Position. */
  fliegeZu(position: THREE.Vector3, ziel: THREE.Vector3, dauer = 600) {
    this.animation = {
      start: performance.now(), dauer,
      vonPos: this.kamera.position.clone(), zuPos: position,
      vonZiel: this.steuerung.target.clone(), zuZiel: ziel,
    };
    this.anfordern();
  }

  /** Standardansichten. "links/rechts" meint die Körperseite des Modells. */
  ansicht(a: Ansicht) {
    const z = this.steuerung.target.clone();
    if (a === 'zuruecksetzen') {
      this.fliegeZu(new THREE.Vector3(0, KOERPER_MITTE.y, this.startAbstand()), KOERPER_MITTE.clone());
      return;
    }
    const d = Math.max(this.kamera.position.distanceTo(z), 0.5);
    const richtung = {
      vorne: new THREE.Vector3(0, 0, 1),
      hinten: new THREE.Vector3(0, 0, -1),
      links: new THREE.Vector3(1, 0, 0), // linke Körperseite liegt bei +x
      rechts: new THREE.Vector3(-1, 0, 0),
      oben: new THREE.Vector3(0, 1, 0.001).normalize(),
    }[a];
    this.fliegeZu(z.clone().addScaledVector(richtung, d), z);
  }

  /** Abstand, bei dem der ganze Körper (ca. 1,9 × 0,9 m) ins Bild passt – im Hoch- und Querformat. */
  startAbstand() {
    const tanHalb = Math.tan((this.kamera.fov * Math.PI) / 360);
    const aspect = this.leinwand.clientWidth / Math.max(this.leinwand.clientHeight, 1) || 1;
    return Math.max(0.95 / tanHalb, 0.5 / (tanHalb * aspect), ABSTAND * 0.8) * 1.05;
  }

  /** Richtet die Kamera so aus, dass ein Bereich (Bounding Box) gut sichtbar ist. */
  fokussiere(box: THREE.Box3) {
    const mitte = box.getCenter(new THREE.Vector3());
    const groesse = box.getSize(new THREE.Vector3()).length();
    const abstand = Math.max(groesse / (2 * Math.tan((this.kamera.fov * Math.PI) / 360)), 0.15) * 1.15;
    const richtung = this.kamera.position.clone().sub(this.steuerung.target).normalize();
    this.fliegeZu(mitte.clone().addScaledVector(richtung, abstand), mitte);
  }

  /** Projiziert einen Weltpunkt auf Bildschirmkoordinaten (CSS-Pixel). */
  aufBildschirm(punkt: THREE.Vector3): { x: number; y: number; sichtbar: boolean } {
    const p = punkt.clone().project(this.kamera);
    return {
      x: ((p.x + 1) / 2) * this.leinwand.clientWidth,
      y: ((1 - p.y) / 2) * this.leinwand.clientHeight,
      sichtbar: p.z > -1 && p.z < 1,
    };
  }
}
