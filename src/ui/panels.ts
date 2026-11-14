// Linkes Panel: Ebenen-Steuerung und Baumansicht aller Strukturen.
import { h } from './dom';
import { anzeigename, SEITE_TEXT, type Daten, type Struktur } from '../typen';
import type { Modell } from '../viewer/modell';

/** Ebenen von außen nach innen: an/aus und Deckkraft. */
export function zeichneEbenen(ziel: HTMLElement, modell: Modell, beiAlleEinblenden: () => void) {
  ziel.replaceChildren();
  ziel.append(h('p', { class: 'klein-leise' }, 'Von außen nach innen. Schieberegler = Transparenz. Durchsichtige Ebenen (unter 50 %) kann man „durchtippen“.'));
  for (const e of modell.ebenen.values()) {
    const d = e.def;
    const schalter = h('input', {
      type: 'checkbox', role: 'switch', 'aria-label': `${d.name} anzeigen`,
      ...(e.sichtbar ? { checked: true } : {}), ...(d.verfuegbar ? {} : { disabled: true }),
    });
    schalter.addEventListener('change', async () => {
      const text = zeile.querySelector('.klein-leise');
      if (schalter.checked && !e.geladen && text) text.textContent = 'wird geladen …';
      await modell.setzeEbeneSichtbar(d.id, schalter.checked);
      if (text) text.textContent = '';
    });
    const regler = h('input', {
      type: 'range', min: '0', max: '1', step: '0.05', value: String(e.deckkraft), 'aria-label': `Deckkraft ${d.name}`,
      ...(d.verfuegbar ? {} : { disabled: true }),
    });
    regler.addEventListener('input', () => modell.setzeDeckkraft(d.id, Number(regler.value)));
    const zeile = h('div', { class: `ebene${d.verfuegbar ? '' : ' nicht-verfuegbar'}`, 'data-ebene': d.id },
      h('div', { class: 'ebene-zeile' },
        h('span', { class: 'farbpunkt', style: `background:${d.farbe ?? 'transparent'}` }),
        h('span', { class: 'name' }, d.name),
        h('label', { class: 'schalter' }, schalter, h('span')),
      ),
      d.verfuegbar ? regler : h('div', { class: 'klein-leise' }, d.hinweis ?? `folgt in Etappe ${d.etappe}`),
      h('div', { class: 'klein-leise' }),
    );
    ziel.append(zeile);
  }
  const versteckt = modell.anzahlVersteckt();
  if (versteckt || modell.istIsoliert) {
    ziel.append(h('div', { class: 'feld' },
      h('p', {}, modell.istIsoliert ? 'Eine Struktur ist isoliert.' : `${versteckt} Struktur(en) ausgeblendet.`),
      h('button', { class: 'knopf', onclick: beiAlleEinblenden }, 'Alle wieder einblenden'),
    ));
  }
}

/** Baumansicht: Ebene → Region → (Gruppe) → Struktur. */
export function zeichneBaum(ziel: HTMLElement, daten: Daten, waehle: (s: Struktur, meshName: string) => void) {
  ziel.replaceChildren();
  // Im Baum zuerst die Knochen (Lernbeginn), dann von innen nach außen.
  for (const ebene of [...daten.ebenen].reverse().filter((e) => e.verfuegbar)) {
    const liste = [...daten.strukturen.values()].filter((s) => s.ebene === ebene.id);
    const regionen = new Map<string, Struktur[]>();
    for (const s of liste) {
      const schluessel = s.gruppe ? `${s.region} › ${s.gruppe}` : s.region;
      if (!regionen.has(schluessel)) regionen.set(schluessel, []);
      regionen.get(schluessel)!.push(s);
    }
    const ebenenKnoten = h('details', {}, h('summary', {}, `${ebene.name} (${liste.length})`));
    for (const [region, strukturen] of [...regionen.entries()].sort((a, b) => a[0].localeCompare(b[0], 'de'))) {
      const regionKnoten = h('details', {}, h('summary', {}, `${region} (${strukturen.length})`));
      // Inhalt erst beim Aufklappen erzeugen (schneller Start).
      regionKnoten.addEventListener('toggle', () => {
        if (!regionKnoten.open || regionKnoten.dataset.gefuellt) return;
        regionKnoten.dataset.gefuellt = '1';
        for (const s of strukturen.sort((a, b) => anzeigename(a).localeCompare(anzeigename(b), 'de'))) {
          const meshes = [...s.meshes].sort((a, b) => (a.seite ?? '').localeCompare(b.seite ?? ''));
          regionKnoten.append(h('div', { class: 'baum-eintrag' },
            h('span', { class: 'name' }, anzeigename(s), s.la && s.de ? h('div', { class: 'klein-leise la' }, s.la) : null),
            meshes.map((m) => h('button', { onclick: () => waehle(s, m.name), 'aria-label': `${anzeigename(s)} ${m.seite ? SEITE_TEXT[m.seite] : ''} auswählen` },
              m.seite ? SEITE_TEXT[m.seite] : 'zeigen')),
          ));
        }
      });
      ebenenKnoten.append(regionKnoten);
    }
    ziel.append(ebenenKnoten);
  }
}
