// Info-Panel: zeigt zu einer ausgewählten Struktur alle Inhalte,
// gestaffelt nach Detailstufe (1 Überblick, 2 Details, 3 Feinbau).
import { h } from './dom';
import { anzeigename, SEITE_TEXT, type Daten, type Lerntext, type Markierung, type Seite, type Struktur } from '../typen';

export interface InfoAktionen {
  schliessen(): void;
  ausblenden(): void;
  transparent(): void;
  isolieren(): void;
  fokus(): void;
  markierungWaehlen(m: Markierung): void;
  stufeWechseln(stufe: 1 | 2 | 3): void;
}

export interface InfoZustand {
  struktur: Struktur;
  seite: Seite;
  stufe: 1 | 2 | 3;
  istTransparent: boolean;
  istIsoliert: boolean;
  aktiveMarkierung: string | null;
}

const TYP_TEXT: Record<string, string> = {
  knochen: 'Knochen', knorpel: 'Knorpel', zahn: 'Zahn', hoehle: 'Nasennebenhöhle', band: 'Band', kapsel: 'Gelenkkapsel',
  meniskus: 'Meniskus', bandscheibe: 'Bandscheibe', gelenklippe: 'Gelenklippe', gelenkscheibe: 'Gelenkscheibe',
  schleimbeutel: 'Schleimbeutel', membran: 'Membran', hautregion: 'Hautregion', nagel: 'Nagel',
};

const NOCH_ZU_PRUEFEN = 'noch zu prüfen';

function feld(titel: string, wert: string | string[] | undefined, pflicht = true) {
  if (!wert || (Array.isArray(wert) && !wert.length)) {
    return pflicht ? h('div', { class: 'feld' }, h('h3', {}, titel), h('p', { class: 'offen' }, NOCH_ZU_PRUEFEN)) : null;
  }
  return h('div', { class: 'feld' }, h('h3', {}, titel),
    Array.isArray(wert) ? h('ul', {}, wert.map((w) => h('li', {}, w))) : h('p', {}, wert));
}

export function zeichneInfo(ziel: HTMLElement, daten: Daten, z: InfoZustand, a: InfoAktionen) {
  const s = z.struktur;
  const t: Lerntext = s.text ?? {};
  const seitenText = z.seite ? ` (${SEITE_TEXT[z.seite]})` : '';
  ziel.replaceChildren();

  // ----- Kopf -----
  ziel.append(h('div', { class: 'panel-kopf' },
    h('div', { class: 'titelblock' },
      h('h2', {}, anzeigename(s) + seitenText),
      s.la && s.la !== anzeigename(s) ? h('div', { class: 'la' }, s.la) : null,
      h('div', { class: 'klein-leise' }, `engl.: ${s.en}`),
      h('div', {},
        h('span', { class: 'abzeichen' }, TYP_TEXT[s.typ] ?? s.typ),
        h('span', { class: 'abzeichen' }, s.region),
        s.gruppe ? h('span', { class: 'abzeichen' }, s.gruppe) : null,
        t.jahr ? h('span', { class: 'abzeichen' }, `${t.jahr}. Ausbildungsjahr`) : null,
        s.text ? h('span', { class: 'abzeichen warn', title: 'Von Claude aus Lehrbuchwissen erstellt, noch nicht fachlich gegengeprüft' },
          (t.status ?? 'entwurf') === 'geprueft' ? 'geprüft' : 'Entwurf – mit Schulbuch abgleichen') : null,
      ),
    ),
    h('button', { class: 'schliessen', 'aria-label': 'Schließen', onclick: () => a.schliessen() }, '×'),
  ));

  // ----- Detailstufe -----
  const stufen: [1 | 2 | 3, string][] = [[1, 'Überblick'], [2, 'Details'], [3, 'Feinbau']];
  ziel.append(h('div', { class: 'stufen', role: 'group', 'aria-label': 'Detailstufe' },
    stufen.map(([n, name]) => h('button', { class: z.stufe === n ? 'aktiv' : '', onclick: () => a.stufeWechseln(n) }, name))));

  // ----- Aktionen -----
  ziel.append(h('div', { class: 'aktionen' },
    h('button', { class: 'knopf', onclick: () => a.fokus() }, 'Heranzoomen'),
    h('button', { class: 'knopf', 'aria-pressed': String(z.istIsoliert), onclick: () => a.isolieren() }, z.istIsoliert ? 'Alle zeigen' : 'Isolieren'),
    h('button', { class: 'knopf', 'aria-pressed': String(z.istTransparent), onclick: () => a.transparent() }, 'Transparent'),
    h('button', { class: 'knopf', onclick: () => a.ausblenden() }, 'Ausblenden'),
  ));

  const inhalt = h('div', { class: 'panel-inhalt' });
  ziel.append(inhalt);

  if (!s.text) {
    const hinweis = s.ebene === 'haut'
      ? 'Hautregion des Modells. Inhalte zum Aufbau der Haut (Epidermis, Dermis, Subcutis) folgen in Etappe 4.'
      : 'Inhalte (Funktion, Verlauf, Gelenkbezug) folgen in Etappe 2 „Gelenke und Bänder“.';
    inhalt.append(h('div', { class: 'feld' }, h('p', { class: 'offen' }, hinweis)));
    return;
  }

  // ----- Stufe 1: Überblick -----
  inhalt.append(
    feld('Funktion', t.kurz) ?? '',
    feld('Lage', t.lage) ?? '',
    feld('Form / Knochenart', t.form) ?? '',
  );

  // ----- Stufe 2: Details -----
  if (z.stufe >= 2) {
    const marks = daten.markierungen[s.id] ?? [];
    inhalt.append(feld('Wichtige Markierungen', t.markierungen, s.typ === 'knochen') ?? '');
    if (marks.length) {
      inhalt.append(h('div', { class: 'feld' },
        h('h3', {}, `Markierungen am Modell (${marks.length}) – antippen zum Zeigen`),
        h('ul', { class: 'markierungsliste' }, marks.map((m) => h('li', {},
          h('button', { class: z.aktiveMarkierung === m.id ? 'aktiv' : '', onclick: () => a.markierungWaehlen(m) },
            m.de ?? m.la ?? m.en,
            m.de && m.la ? h('span', { class: 'klein-leise la' }, ` · ${m.la}`) : null,
          ))))));
    }
    inhalt.append(
      feld('Angrenzende Gelenke', t.gelenke) ?? '',
      feld('Ansetzende Muskeln', t.muskeln, s.typ === 'knochen') ?? '',
      feld('Bänder', t.baender, false) ?? '',
      feld('Palpation (tastbar)', t.tastbar, false) ?? '',
      feld('Praxisbezug', t.praxis, false) ?? '',
    );
    if (t.offen?.length) {
      inhalt.append(h('div', { class: 'feld' }, h('h3', {}, 'Noch zu prüfen'), h('ul', { class: 'offen' }, t.offen.map((o) => h('li', {}, o)))));
    }
  }

  // ----- Stufe 3: Feinbau -----
  if (z.stufe >= 3) {
    const fb = daten.feinbau[s.typ === 'knochen' ? 'knochen' : ''];
    if (fb) {
      inhalt.append(h('div', { class: 'feld' },
        h('h3', {}, `Feinbau: ${fb.titel}`),
        fb.bild ? h('img', { class: 'schema', src: `./${fb.bild}`, alt: fb.titel, loading: 'lazy' }) : null,
        h('p', { class: 'hinweis-schema' }, 'Schematische Darstellung, vereinfacht und nicht maßstabsgetreu.'),
        fb.abschnitte.map((ab) => h('div', { class: 'feld' }, h('h3', {}, ab.name), h('p', {}, ab.text))),
      ));
    } else {
      inhalt.append(h('div', { class: 'feld' }, h('p', { class: 'offen' }, 'Feinbau für diese Struktur folgt in einer späteren Etappe.')));
    }
  }

  // ----- Quellen -----
  const quellen = t.quellen ?? daten.standardQuellen;
  inhalt.append(h('div', { class: 'feld klein-leise' },
    h('h3', {}, 'Quellen'),
    h('ul', {}, quellen.map((q) => h('li', {}, daten.quellen[q]?.titel ?? q))),
    h('p', {}, 'Lernmodell – ersetzt weder Unterricht noch Lehrbuch.'),
  ));
}
