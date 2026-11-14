// Beschriftungen direkt am Modell (HTML über der 3D-Leinwand) und
// Markierungspunkte für Knochenmerkmale (z. B. Trochanter major).
import * as THREE from 'three';
import type { Szene } from './szene';
import type { Markierung, Seite } from '../typen';

interface Schild {
  el: HTMLDivElement;
  punkt: THREE.Vector3;
}

export class Beschriftungen {
  private schilder = new Map<string, Schild>();

  constructor(private szene: Szene, private ebene: HTMLElement) {
    szene.nachDemZeichnen.push(() => this.positionieren());
  }

  /** Zeigt ein Schild mit Haupt- und Untertitel an einem Weltpunkt. */
  zeige(schluessel: string, punkt: THREE.Vector3, titel: string, untertitel?: string | null, art: 'auswahl' | 'markierung' = 'auswahl') {
    this.entferne(schluessel);
    const el = document.createElement('div');
    el.className = `beschriftung ${art}`;
    el.innerHTML = '<div class="punkt"></div><div class="linie"></div><div class="kasten"></div>';
    const kasten = el.querySelector('.kasten')!;
    kasten.textContent = titel;
    if (untertitel && untertitel !== titel) {
      const s = document.createElement('small');
      s.textContent = untertitel;
      kasten.appendChild(s);
    }
    this.ebene.appendChild(el);
    this.schilder.set(schluessel, { el, punkt: punkt.clone() });
    this.szene.anfordern();
  }

  entferne(schluessel: string) {
    this.schilder.get(schluessel)?.el.remove();
    this.schilder.delete(schluessel);
  }

  private positionieren() {
    for (const s of this.schilder.values()) {
      const p = this.szene.aufBildschirm(s.punkt);
      s.el.style.display = p.sichtbar ? '' : 'none';
      s.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    }
  }
}

/**
 * Kleine Kugeln auf dem ausgewählten Knochen, eine pro Markierung.
 * Die Ankerpunkte liegen in Z-Anatomy nur auf einer Körperseite;
 * für die andere Seite wird an der Mittelebene (x = 0) gespiegelt.
 */
export class Markierungspunkte {
  private netz: THREE.InstancedMesh | null = null;
  private liste: { m: Markierung; pos: THREE.Vector3 }[] = [];
  aktiv: string | null = null;

  constructor(private szene: Szene) {}

  zeige(markierungen: Markierung[], seite: Seite) {
    this.entferne();
    if (!markierungen.length) return;
    this.liste = markierungen.map((m) => {
      const spiegeln = seite && m.seite && seite !== m.seite;
      return { m, pos: new THREE.Vector3(spiegeln ? -m.pos[0] : m.pos[0], m.pos[1], m.pos[2]) };
    });
    const geo = new THREE.SphereGeometry(0.0035, 12, 8);
    // depthTest aus: Punkte bleiben sichtbar, auch wenn sie knapp unter der Oberfläche liegen.
    const mat = new THREE.MeshBasicMaterial({ color: 0x2a7de1, depthTest: false, transparent: true, opacity: 0.9 });
    this.netz = new THREE.InstancedMesh(geo, mat, this.liste.length);
    this.netz.renderOrder = 10;
    this.aktualisieren();
    this.szene.szene.add(this.netz);
    this.szene.anfordern();
  }

  private aktualisieren() {
    if (!this.netz) return;
    const m = new THREE.Matrix4();
    const farbe = new THREE.Color();
    this.liste.forEach((e, i) => {
      const gross = e.m.id === this.aktiv ? 1.8 : 1;
      m.makeScale(gross, gross, gross).setPosition(e.pos);
      this.netz!.setMatrixAt(i, m);
      this.netz!.setColorAt(i, farbe.set(e.m.id === this.aktiv ? 0xff3b6b : 0x2a7de1));
    });
    this.netz.instanceMatrix.needsUpdate = true;
    if (this.netz.instanceColor) this.netz.instanceColor.needsUpdate = true;
    this.szene.anfordern();
  }

  hebeHervor(id: string | null) {
    this.aktiv = id;
    this.aktualisieren();
  }

  position(id: string) {
    return this.liste.find((e) => e.m.id === id)?.pos ?? null;
  }

  /** Findet die Markierung, die einem Bildschirmpunkt am nächsten liegt (max. 22 px, fingerfreundlich). */
  treffer(x: number, y: number): Markierung | null {
    let bester: Markierung | null = null;
    let abstand = 22;
    for (const e of this.liste) {
      const p = this.szene.aufBildschirm(e.pos);
      if (!p.sichtbar) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < abstand) { abstand = d; bester = e.m; }
    }
    return bester;
  }

  entferne() {
    if (this.netz) {
      this.szene.szene.remove(this.netz);
      this.netz.geometry.dispose();
      (this.netz.material as THREE.Material).dispose();
      this.netz = null;
    }
    this.liste = [];
    this.aktiv = null;
    this.szene.anfordern();
  }
}
