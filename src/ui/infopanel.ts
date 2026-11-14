// Info-Panel: zeigt zu einer ausgewählten Struktur alle Inhalte,
// gestaffelt nach Detailstufe (1 Überblick, 2 Details, 3 Feinbau).
import { h } from './dom';
import { anzeigename, lernjahr, SEITE_TEXT, type Daten, type Gelenk, type Lerntext, type Markierung, type Seite, type Struktur } from '../typen';

export interface InfoAktionen {
  schliessen(): void;
  ausblenden(): void;
  transparent(): void;
  isolieren(): void;
  fokus(): void;
  merken(): void;
  markierungWaehlen(m: Markierung): void;
  stufeWechseln(stufe: 1 | 2 | 3): void;
  ansaetzeUmschalten(): void;
  gelenkZeigen(g: Gelenk): void;
}

export interface InfoZustand {
  struktur: Struktur;
  seite: Seite;
  stufe: 1 | 2 | 3;
  istTransparent: boolean;
  istIsoliert: boolean;
  istGemerkt: boolean;
  ansaetzeSichtbar: boolean;
  aktiveMarkierung: string | null;
  offenesGelenk: string | null;
}

export const TYP_TEXT: Record<string, string> = {
  knochen: 'Knochen', knorpel: 'Knorpel', zahn: 'Zahn', hoehle: 'Nasennebenhöhle', band: 'Band', kapsel: 'Gelenkkapsel',
  meniskus: 'Meniskus', bandscheibe: 'Bandscheibe', gelenklippe: 'Gelenklippe', gelenkscheibe: 'Gelenkscheibe',
  schleimbeutel: 'Schleimbeutel', sehnenscheide: 'Sehnenscheide', membran: 'Membran', hautregion: 'Hautregion', nagel: 'Nagel',
  muskel: 'Muskel', faszie: 'Faszie', aponeurose: 'Aponeurose', retinaculum: 'Retinaculum', septum: 'Muskelscheidewand',
  unterhaut: 'Unterhaut (schematisch)', arterie: 'Arterie', vene: 'Vene', herz: 'Herz', nerv: 'Nerv', zns: 'Zentrales Nervensystem',
  sinnesorgan: 'Sinnesorgan', organ: 'Organ', lymphatisch: 'Lymphatisches System',
};

const NOCH_ZU_PRUEFEN = 'noch zu prüfen';
type Wert = string | string[] | undefined;

function feld(titel: string, wert: Wert, pflicht = false) {
  if (!wert || (Array.isArray(wert) && !wert.length)) {
    return pflicht ? h('div', { class: 'feld' }, h('h3', {}, titel), h('p', { class: 'offen' }, NOCH_ZU_PRUEFEN)) : null;
  }
  return h('div', { class: 'feld' }, h('h3', {}, titel),
    Array.isArray(wert) ? h('ul', {}, wert.map((w) => h('li', {}, w))) : h('p', {}, wert));
}

/** Welche Felder in Stufe 1 (Überblick) und Stufe 2 (Details) erscheinen – je nach Strukturtyp. */
function felderFuer(typ: string, t: Lerntext): { ueberblick: [string, Wert, boolean][]; details: [string, Wert, boolean][] } {
  const speziell = !t.allgemein;
  if (typ === 'knochen') {
    return {
      ueberblick: [['Funktion', t.kurz, speziell], ['Lage', t.lage, speziell], ['Form / Knochenart', t.form, speziell]],
      details: [['Wichtige Markierungen', t.markierungen, speziell], ['Angrenzende Gelenke', t.gelenke, speziell],
        ['Ansetzende Muskeln', t.muskeln, speziell], ['Bänder', t.baender, false], ['Palpation (tastbar)', t.tastbar, false], ['Praxisbezug', t.praxis, false]],
    };
  }
  if (typ === 'muskel') {
    return {
      ueberblick: [['Funktion', t.kurz, speziell], ['Ursprung', t.ursprung, speziell], ['Ansatz', t.ansatz, speziell]],
      details: [['Aktion / Bewegung', t.aktion, speziell], ['Innervation (Nerv und Segment)', t.innervation, speziell],
        ['Gefäßversorgung', t.versorgung, speziell], ['Palpation (tastbar)', t.tastbar, speziell],
        ['Synergisten', t.synergisten, speziell], ['Antagonisten', t.antagonisten, speziell], ['Praxisbezug', t.praxis, false]],
    };
  }
  if (['faszie', 'aponeurose', 'retinaculum', 'septum'].includes(typ)) {
    return {
      ueberblick: [['Funktion', t.kurz, speziell], ['Lage', t.lage, speziell]],
      details: [['Aufbau', t.aufbau, speziell], ['Zugehörige Muskeln', t.muskeln, speziell], ['Palpation (tastbar)', t.tastbar, false],
        ['Klinische Bedeutung', t.praxis, false]],
    };
  }
  if (['nerv', 'zns'].includes(typ)) {
    return {
      ueberblick: [['Funktion', t.kurz, true], ['Lage und Verlauf', t.lage, speziell]],
      details: [['Herkunft (Segmente)', t.ursprung_segmente, speziell], ['Versorgt', t.versorgt, speziell], ['Praxisbezug', t.praxis, false]],
    };
  }
  return {
    ueberblick: [['Funktion', t.kurz, true], ['Lage', t.lage, false], ['Aufbau', t.aufbau ?? t.form, false]],
    details: [['Aufgaben', t.funktion_liste, false], ['Organsystem', t.system, false], ['Palpation (tastbar)', t.tastbar, false], ['Praxisbezug', t.praxis, false]],
  };
}

function gelenkAbschnitt(g: Gelenk, daten: Daten, offen: boolean, a: InfoAktionen) {
  const quelle = (id: string) => daten.quellen[id]?.titel.split(':')[0] ?? id;
  const inhalt = h('div', {},
    feld('Gelenktyp', g.typ),
    feld('Beteiligte Knochen', g.knochen),
    feld('Achsen und Bewegungsebenen', g.achsen),
    g.rom?.length
      ? h('div', { class: 'feld' }, h('h3', {}, 'Bewegungsumfang (Neutral-Null-Methode)'),
        h('table', { class: 'tabelle' }, g.rom.map((r) => h('tr', {}, h('td', {}, r.bewegung), h('td', { class: 'wert' }, `${r.wert}°`)))),
        h('p', { class: 'klein-leise' }, `Richtwerte. Quelle: ${[...new Set(g.rom.map((r) => quelle(r.quelle)))].join(', ')}. Individuell und je nach Lehrbuch verschieden.`))
      : feld('Bewegungsumfang (Neutral-Null-Methode)', undefined, true),
    feld('Kapsel-Band-Apparat', g.kapsel_baender, true),
    g.ruhestellung || g.verriegelung
      ? h('div', { class: 'feld' }, h('h3', {}, 'Gelenkstellungen (Manuelle Therapie nach Kaltenborn)'),
        h('ul', {}, g.ruhestellung ? h('li', {}, `Ruhestellung: ${g.ruhestellung}`) : null,
          g.verriegelung ? h('li', {}, `Verriegelte Stellung: ${g.verriegelung}`) : null))
      : null,
    feld('Praxisbezug', g.praxis),
    g.offen?.length ? h('div', { class: 'feld' }, h('h3', {}, 'Noch zu prüfen'), h('ul', { class: 'offen' }, g.offen.map((o) => h('li', {}, o)))) : null,
  );
  const det = h('details', { class: 'gelenk', ...(offen ? { open: true } : {}) },
    h('summary', {}, `Gelenk: ${g.name}`, h('span', { class: 'klein-leise la' }, ` · ${g.la}`)),
    h('button', { class: 'knopf klein', onclick: () => a.gelenkZeigen(g) }, 'Ganzes Gelenk im Modell zeigen'),
    inhalt);
  return det;
}

export function zeichneInfo(ziel: HTMLElement, daten: Daten, z: InfoZustand, a: InfoAktionen) {
  const s = z.struktur;
  const t: Lerntext = s.text ?? {};
  const seitenText = z.seite ? ` (${SEITE_TEXT[z.seite]})` : '';
  const hatAnsaetze = !!daten.ansaetze[s.id]?.length;
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
        h('span', { class: 'abzeichen' }, `${lernjahr(s)}. Ausbildungsjahr`),
        s.text && !t.allgemein ? h('span', { class: 'abzeichen warn', title: 'Von Claude aus Lehrbuchwissen erstellt, noch nicht fachlich gegengeprüft' },
          (t.status ?? 'entwurf') === 'geprueft' ? 'geprüft' : 'Entwurf – mit Schulbuch abgleichen') : null,
        t.allgemein ? h('span', { class: 'abzeichen warn' }, 'nur allgemeiner Text') : null,
      ),
    ),
    h('button', { class: 'merken', 'aria-pressed': String(z.istGemerkt), 'aria-label': z.istGemerkt ? 'Von Merkliste entfernen' : 'Auf die Merkliste', title: 'Merkliste', onclick: () => a.merken() }, z.istGemerkt ? '★' : '☆'),
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
    hatAnsaetze ? h('button', { class: 'knopf', 'aria-pressed': String(z.ansaetzeSichtbar), onclick: () => a.ansaetzeUmschalten() },
      z.ansaetzeSichtbar ? 'Ursprung/Ansatz aus' : 'Ursprung/Ansatz zeigen') : null,
  ));
  if (z.ansaetzeSichtbar) {
    ziel.append(h('div', { class: 'legende' }, h('span', { class: 'punkt rot' }), 'Ursprung', h('span', { class: 'punkt blau' }), 'Ansatz',
      h('span', { class: 'klein-leise' }, ' (Flächen aus dem Z-Anatomy-Modell)')));
  }

  const inhalt = h('div', { class: 'panel-inhalt' });
  ziel.append(inhalt);
  const f = felderFuer(s.typ, t);

  // ----- Stufe 1: Überblick -----
  for (const [titel, wert, pflicht] of f.ueberblick) inhalt.append(feld(titel, wert, pflicht) ?? '');
  if (t.allgemein) {
    inhalt.append(h('p', { class: 'offen' }, 'Für diese Struktur gibt es noch keinen eigenen Text – oben steht der allgemeine Text zum Strukturtyp. Genaue Angaben: noch zu prüfen.'));
  }
  if (s.typ === 'muskel' && t.allgemein && s.nerven_modell?.length) {
    inhalt.append(feld('Innervation (laut Z-Anatomy-Modell)', s.nerven_modell.join(', ')) ?? '');
  }

  // ----- Stufe 2: Details -----
  if (z.stufe >= 2) {
    const marks = daten.markierungen[s.id] ?? [];
    for (const [titel, wert, pflicht] of f.details) inhalt.append(feld(titel, wert, pflicht) ?? '');
    if (marks.length) {
      inhalt.append(h('div', { class: 'feld' },
        h('h3', {}, `Markierungen am Modell (${marks.length}) – antippen zum Zeigen`),
        h('ul', { class: 'markierungsliste' }, marks.map((m) => h('li', {},
          h('button', { class: z.aktiveMarkierung === m.id ? 'aktiv' : '', onclick: () => a.markierungWaehlen(m) },
            m.de ?? m.la ?? m.en,
            m.de && m.la ? h('span', { class: 'klein-leise la' }, ` · ${m.la}`) : null,
          ))))));
    }
    if (t.offen?.length) {
      inhalt.append(h('div', { class: 'feld' }, h('h3', {}, 'Noch zu prüfen'), h('ul', { class: 'offen' }, t.offen.map((o) => h('li', {}, o)))));
    }
  }

  // ----- Gelenke, zu denen die Struktur gehört -----
  for (const gid of s.gelenke ?? []) {
    const g = daten.gelenke.get(gid);
    if (g) inhalt.append(gelenkAbschnitt(g, daten, z.offenesGelenk === gid || (z.stufe >= 2 && s.ebene === 'baender_gelenke'), a));
  }

  // ----- Stufe 3: Feinbau -----
  if (z.stufe >= 3) {
    const fb = daten.feinbau[daten.feinbauZuordnung[s.typ] ?? ''];
    if (fb) {
      inhalt.append(h('div', { class: 'feld' },
        h('h3', {}, `Feinbau: ${fb.titel}`),
        fb.bild ? h('img', { class: 'schema', src: `./${fb.bild}`, alt: fb.titel, loading: 'lazy' }) : null,
        fb.bild ? h('p', { class: 'hinweis-schema' }, 'Schematische Darstellung, vereinfacht und nicht maßstabsgetreu.') : null,
        fb.abschnitte.map((ab) => h('div', { class: 'feld' }, h('h3', {}, ab.name), h('p', {}, ab.text))),
      ));
    } else {
      inhalt.append(h('div', { class: 'feld' }, h('p', { class: 'offen' }, 'Feinbau für diesen Strukturtyp ist noch nicht beschrieben.')));
    }
  }

  // ----- Quellen -----
  const quellen = t.quellen ?? (s.text && !t.allgemein ? daten.standardQuellen : ['z-anatomy']);
  inhalt.append(h('div', { class: 'feld klein-leise' },
    h('h3', {}, 'Quellen'),
    h('ul', {}, quellen.map((q) => h('li', {}, daten.quellen[q]?.titel ?? q))),
    h('p', {}, 'Lernmodell – ersetzt weder Unterricht noch Lehrbuch.'),
  ));
}
