// Lernmodus: Lernpfade nach Ausbildungsjahr, Quiz, Lernkarten (Spaced Repetition), Merkliste.
//
// Quiz-Fragearten:
//   zeigen   – "Tippe auf den M. gluteus medius" (Antwort per Antippen im 3D-Modell)
//   benennen – eine Struktur leuchtet auf, vier Namen zur Auswahl
//   wissen   – "Wo setzt dieser Muskel an?", "Welcher Nerv versorgt ihn?" (vier Antworten)
import { h } from '../ui/dom';
import { anzeigename, lernjahr, type Daten, type Gelenk, type Struktur } from '../typen';
import type { Modell, Teil } from '../viewer/modell';
import type { Lernjahr, Speicher } from './speicher';

export interface LernUmgebung {
  daten: Daten;
  modell: Modell;
  speicher: Speicher;
  /** normale Auswahl mit Info-Panel */
  zeigeStruktur(s: Struktur, meshName?: string): Promise<void>;
  /** Struktur hervorheben und heranzoomen, ohne Namen zu verraten */
  zeigeVerdeckt(meshName: string): Promise<void>;
  auswahlAufheben(): void;
  /** nach Wechsel des Lernjahrs: Baum neu zeichnen */
  lernpfadGeaendert(): void;
}

type Fragenart = 'zeigen' | 'benennen' | 'wissen';
interface Frage {
  art: Fragenart;
  struktur: Struktur;
  text: string;
  antworten?: string[];
  richtig?: string;
  meshName?: string;
}
interface QuizLauf {
  fragen: Frage[];
  index: number;
  punkte: number;
  beantwortet: false | { richtig: boolean; gewaehlt?: string; getippt?: string };
  falsch: Frage[];
  vorherSichtbar: Map<string, boolean>;
}

const THEMEN: Record<string, { name: string; passt: (s: Struktur) => boolean }> = {
  alle: { name: 'Alles', passt: () => true },
  knochen: { name: 'Knochen', passt: (s) => s.ebene === 'knochen' },
  muskeln: { name: 'Muskeln', passt: (s) => s.typ === 'muskel' },
  gelenke: { name: 'Gelenke und Bänder', passt: (s) => s.ebene === 'baender_gelenke' },
  faszien: { name: 'Faszien', passt: (s) => s.ebene === 'faszien' },
  nerven: { name: 'Nerven und Gefäße', passt: (s) => s.ebene === 'nerven_gefaesse' },
  organe: { name: 'Organe', passt: (s) => s.ebene === 'organe' },
};
const FRAGENARTEN: Record<string, string> = { gemischt: 'Gemischt', zeigen: 'Antippen im Modell', benennen: 'Struktur benennen', wissen: 'Wissensfragen' };

const zufall = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)];
function mischen<T>(l: T[]): T[] {
  const a = [...l];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export class Lernmodus {
  private ansicht: 'start' | 'quiz' | 'ergebnis' | 'karten' = 'start';
  private thema = 'alle';
  private fragenart = 'gemischt';
  private quiz: QuizLauf | null = null;
  private karte: { id: string; aufgedeckt: boolean } | null = null;

  constructor(private ziel: HTMLElement, private u: LernUmgebung) {}

  get lernjahr(): Lernjahr { return this.u.speicher.daten.lernjahr; }

  /** Gehört die Struktur zum gewählten Lernpfad? */
  imLernpfad(s: Struktur) {
    const j = this.lernjahr;
    return j === 'alle' || lernjahr(s) <= j;
  }

  /**
   * Lernrelevante Strukturen: alle mit eigenem Lerntext, außerdem alle Knochen und die
   * oberflächlichen Muskeln (sehr kleine/tiefe Muskeln ohne Text wären für das Quiz zu speziell).
   */
  private pool(thema = this.thema): Struktur[] {
    const passt = THEMEN[thema].passt;
    return [...this.u.daten.strukturen.values()].filter((s) =>
      passt(s) && this.imLernpfad(s) && (s.de || s.la) &&
      ((s.text && !s.text.allgemein) || s.typ === 'knochen' || (s.ebene === 'muskeln_oberflaechlich' && !!s.la)));
  }

  // =====================================================================
  // Zeichnen
  // =====================================================================
  zeichnen() {
    this.ziel.replaceChildren();
    if (this.ansicht === 'quiz' && this.quiz) this.zeichneQuiz();
    else if (this.ansicht === 'ergebnis' && this.quiz) this.zeichneErgebnis();
    else if (this.ansicht === 'karten') this.zeichneKarte();
    else this.zeichneStart();
  }

  private zeichneStart() {
    const sp = this.u.speicher;
    const faellig = sp.faellige().length;
    const jahre: [Lernjahr, string][] = [[1, '1. Jahr'], [2, '2. Jahr'], [3, '3. Jahr'], ['alle', 'Alles']];
    const imPfad = this.pool('alle').length;
    const gelernt = Object.entries(sp.daten.karten).filter(([, k]) => k.stufe >= 3).length;

    this.ziel.append(
      h('h3', { class: 'lern-titel' }, 'Lernpfad'),
      h('div', { class: 'stufen' }, jahre.map(([j, name]) =>
        h('button', { class: this.lernjahr === j ? 'aktiv' : '', onclick: () => { sp.daten.lernjahr = j; sp.speichern(); this.u.lernpfadGeaendert(); this.zeichnen(); } }, name))),
      h('p', { class: 'klein-leise' }, this.lernjahr === 'alle'
        ? `Alles freigeschaltet: ${imPfad} lernrelevante Strukturen.`
        : `Bis zum ${this.lernjahr}. Ausbildungsjahr: ${imPfad} Strukturen. Baumansicht und Quiz zeigen nur diese; über „Alles“ wird alles freigeschaltet.`),
      h('p', { class: 'klein-leise' }, 'Die Zuordnung zu den Ausbildungsjahren ist ein Vorschlag (1. Jahr: Bewegungsapparat; 2. Jahr: Kopf, Nerven, Gefäße; 3. Jahr: Organe) und lässt sich in den Texten (Feld „jahr“) anpassen.'),

      h('h3', { class: 'lern-titel' }, 'Quiz'),
      h('label', { class: 'auswahl-zeile' }, 'Thema ',
        this.select(THEMEN, this.thema, (v) => { this.thema = v; this.zeichnen(); }, (k) => THEMEN[k].name)),
      h('label', { class: 'auswahl-zeile' }, 'Fragen ',
        this.select(FRAGENARTEN, this.fragenart, (v) => { this.fragenart = v; }, (k) => FRAGENARTEN[k])),
      h('button', { class: 'knopf breit', onclick: () => this.quizStarten() }, `Quiz starten (10 Fragen)`),
      h('p', { class: 'klein-leise' }, `${this.pool().length} Strukturen in diesem Thema.`),

      h('h3', { class: 'lern-titel' }, 'Lernkarten'),
      h('p', {}, faellig ? `${faellig} Karte(n) sind jetzt fällig.` : 'Gerade keine Karte fällig.'),
      h('div', { class: 'knopfreihe' },
        h('button', { class: 'knopf', ...(faellig ? {} : { disabled: true }), onclick: () => this.kartenStarten() }, 'Karten üben'),
        h('button', { class: 'knopf', onclick: () => this.neueKarten() }, '+10 neue aus dem Lernpfad'),
      ),
      h('p', { class: 'klein-leise' }, `Insgesamt ${Object.keys(sp.daten.karten).length} Karten, davon ${gelernt} sicher (Stufe 3+). Wiederholung nach 1, 2, 4, 8, 16, 32 Tagen.`),

      h('h3', { class: 'lern-titel' }, `Merkliste (${sp.daten.merkliste.length})`),
      sp.daten.merkliste.length
        ? h('ul', { class: 'markierungsliste' }, sp.daten.merkliste.map((id) => {
          const s = this.u.daten.strukturen.get(id);
          return s ? h('li', {}, h('button', { onclick: () => this.u.zeigeStruktur(s) }, anzeigename(s), h('span', { class: 'klein-leise' }, ` · ${s.region}`))) : null;
        }))
        : h('p', { class: 'klein-leise' }, 'Im Info-Panel auf ☆ tippen, um Strukturen hier zu sammeln.'),
      sp.daten.merkliste.length
        ? h('button', { class: 'knopf', onclick: () => { for (const id of sp.daten.merkliste) sp.karteHinzufuegen(id); sp.speichern(); this.kartenStarten(); } }, 'Merkliste als Karten üben')
        : '',

      h('h3', { class: 'lern-titel' }, 'Fortschritt sichern'),
      h('p', { class: 'klein-leise' }, 'Der Lernfortschritt liegt nur auf diesem Gerät. Zur Sicherung exportieren (Datei in „Dateien“ speichern).'),
      h('div', { class: 'knopfreihe' },
        h('button', { class: 'knopf', onclick: () => this.exportieren() }, 'Exportieren'),
        h('button', { class: 'knopf', onclick: () => this.importieren() }, 'Importieren'),
      ),
    );
  }

  private select(optionen: Record<string, unknown>, wert: string, aendern: (v: string) => void, name: (k: string) => string) {
    const sel = h('select', { class: 'auswahl' }, Object.keys(optionen).map((k) => h('option', { value: k, ...(k === wert ? { selected: true } : {}) }, name(k))));
    sel.addEventListener('change', () => aendern(sel.value));
    return sel;
  }

  // =====================================================================
  // Quiz
  // =====================================================================
  private async quizStarten() {
    const pool = this.pool();
    if (pool.length < 4) { alert('Zu wenige Strukturen in diesem Thema/Lernpfad.'); return; }
    const fragen: Frage[] = [];
    let versuche = 0;
    while (fragen.length < 10 && versuche++ < 200) {
      const art = (this.fragenart === 'gemischt' ? zufall(['zeigen', 'benennen', 'wissen'] as Fragenart[]) : this.fragenart) as Fragenart;
      const f = art === 'wissen' ? this.wissensfrage(pool) : this.namensfrage(art, pool);
      if (f && !fragen.some((x) => x.struktur.id === f.struktur.id && x.art === f.art)) fragen.push(f);
    }
    const vorherSichtbar = new Map([...this.u.modell.ebenen.entries()].map(([id, e]) => [id, e.sichtbar]));
    this.quiz = { fragen, index: 0, punkte: 0, beantwortet: false, falsch: [], vorherSichtbar };
    this.ansicht = 'quiz';
    await this.frageVorbereiten();
  }

  private namensfrage(art: 'zeigen' | 'benennen', pool: Struktur[]): Frage | null {
    const s = zufall(pool);
    const mesh = zufall(s.meshes).name;
    const name = anzeigename(s);
    if (art === 'zeigen') return { art, struktur: s, text: `Tippe im Modell auf: ${name}`, meshName: mesh };
    const gleiche = pool.filter((x) => x.typ === s.typ && anzeigename(x) !== name);
    const nahe = gleiche.filter((x) => x.region === s.region);
    const andere = mischen([...new Set([...mischen(nahe).slice(0, 3), ...mischen(gleiche)].map(anzeigename))]).slice(0, 3);
    if (andere.length < 3) return null;
    return { art, struktur: s, text: 'Welche Struktur ist im Modell hervorgehoben?', antworten: mischen([name, ...andere]), richtig: name, meshName: mesh };
  }

  private wissensfrage(pool: Struktur[]): Frage | null {
    type Kandidat = { s: Struktur; frage: string; antwort: string; feld: string };
    const k: Kandidat[] = [];
    for (const s of pool) {
      const t = s.text;
      if (!t || t.allgemein) continue;
      const n = anzeigename(s);
      if (s.typ === 'muskel') {
        if (t.ansatz) k.push({ s, frage: `Wo setzt ${n} an?`, antwort: t.ansatz, feld: 'muskel.ansatz' });
        if (t.ursprung) k.push({ s, frage: `Wo entspringt ${n}?`, antwort: t.ursprung, feld: 'muskel.ursprung' });
        if (t.innervation) k.push({ s, frage: `Welcher Nerv versorgt ${n}?`, antwort: t.innervation, feld: 'muskel.innervation' });
      } else if (s.typ === 'knochen') {
        if (t.form) k.push({ s, frage: `Zu welcher Knochenart gehört: ${n}?`, antwort: t.form, feld: 'knochen.form' });
        if (t.lage) k.push({ s, frage: `Wo liegt: ${n}?`, antwort: t.lage, feld: 'knochen.lage' });
      } else if (t.kurz && !['hautregion'].includes(s.typ)) {
        k.push({ s, frage: `Was beschreibt ${n}?`, antwort: t.kurz, feld: `${s.ebene}.kurz` });
      }
    }
    // Gelenkfragen
    const gelenkStruktur = (g: Gelenk) => g.mitglieder.map((id) => this.u.daten.strukturen.get(id)!).find((s) => s && this.imLernpfad(s) && THEMEN[this.thema].passt(s));
    for (const g of this.u.daten.gelenke.values()) {
      const s = gelenkStruktur(g);
      if (s && g.typ) k.push({ s, frage: `Welcher Gelenktyp ist das ${g.name}?`, antwort: g.typ.split(/[:(]/)[0].trim(), feld: 'gelenk.typ' });
    }
    if (!k.length) return null;
    const wahl = zufall(k);
    const falsche = mischen([...new Set(k.filter((x) => x.feld === wahl.feld && x.antwort !== wahl.antwort).map((x) => x.antwort))]).slice(0, 3);
    if (falsche.length < 3) return null;
    return { art: 'wissen', struktur: wahl.s, text: wahl.frage, antworten: mischen([wahl.antwort, ...falsche]), richtig: wahl.antwort };
  }

  /** Bereitet die 3D-Ansicht für die aktuelle Frage vor. */
  private async frageVorbereiten() {
    const q = this.quiz!;
    const f = q.fragen[q.index];
    this.u.auswahlAufheben();
    if (f.art === 'zeigen') {
      // Nur Knochen + die Ebene der gesuchten Struktur zeigen, damit sie nicht verdeckt ist.
      for (const id of this.u.modell.ebenen.keys()) {
        await this.u.modell.setzeEbeneSichtbar(id, id === f.struktur.ebene || id === 'knochen');
      }
    } else if (f.art === 'benennen' && f.meshName) {
      await this.u.modell.setzeEbeneSichtbar(f.struktur.ebene, true);
      await this.u.zeigeVerdeckt(f.meshName);
    }
    this.zeichnen();
  }

  /** Wird von main.ts bei jedem Tipp auf das Modell aufgerufen. true = Tipp wurde vom Quiz verwendet. */
  beiTipp(teil: Teil | null): boolean {
    const q = this.quiz;
    if (this.ansicht !== 'quiz' || !q || q.beantwortet) return false;
    const f = q.fragen[q.index];
    if (f.art !== 'zeigen') return false;
    if (!teil) return true; // ins Leere getippt: ignorieren
    const getippt = this.u.daten.strukturen.get(teil.strukturId);
    this.antworten(teil.strukturId === f.struktur.id, undefined, getippt ? anzeigename(getippt) : teil.meshName);
    this.u.zeigeVerdeckt(f.meshName ?? f.struktur.meshes[0].name);
    return true;
  }

  private antworten(richtig: boolean, gewaehlt?: string, getippt?: string) {
    const q = this.quiz!;
    const f = q.fragen[q.index];
    q.beantwortet = { richtig, gewaehlt, getippt };
    if (richtig) q.punkte++;
    else q.falsch.push(f);
    this.u.speicher.quizErgebnis(f.struktur.id, richtig);
    this.zeichnen();
  }

  private zeichneQuiz() {
    const q = this.quiz!;
    const f = q.fragen[q.index];
    const b = q.beantwortet;
    this.ziel.append(
      h('div', { class: 'quiz-kopf' }, h('span', {}, `Frage ${q.index + 1} von ${q.fragen.length}`), h('span', {}, `${q.punkte} richtig`)),
      h('p', { class: 'quiz-frage' }, f.text),
      f.art === 'zeigen' && !b ? h('p', { class: 'klein-leise' }, 'Drehen und zoomen ist erlaubt. Kurz antippen = Antwort.') : '',
    );
    if (f.antworten) {
      this.ziel.append(h('div', { class: 'antworten' }, f.antworten.map((a) => {
        let klasse = 'antwort';
        if (b) klasse += a === f.richtig ? ' richtig' : a === b.gewaehlt ? ' falsch' : ' aus';
        return h('button', { class: klasse, ...(b ? { disabled: true } : {}), onclick: () => this.antworten(a === f.richtig, a) }, a);
      })));
    }
    if (b) {
      this.ziel.append(h('div', { class: `rueckmeldung ${b.richtig ? 'gut' : 'schlecht'}` },
        b.richtig ? 'Richtig!' : 'Leider falsch.',
        f.art === 'zeigen' && !b.richtig ? h('div', {}, `Getippt: ${b.getippt}. Gesucht war ${anzeigename(f.struktur)} – jetzt orange markiert.`) : null,
        f.art !== 'zeigen' ? h('div', { class: 'klein-leise' }, `Struktur: ${anzeigename(f.struktur)}${f.struktur.la ? ' · ' + f.struktur.la : ''}`) : null,
      ));
      this.ziel.append(h('div', { class: 'knopfreihe' },
        h('button', { class: 'knopf', onclick: () => this.u.zeigeStruktur(f.struktur, f.meshName) }, 'Im Info-Panel ansehen'),
        h('button', { class: 'knopf aktiv', onclick: () => this.weiter() }, q.index + 1 < q.fragen.length ? 'Weiter' : 'Auswertung'),
      ));
    }
    this.ziel.append(h('button', { class: 'knopf klein abbrechen', onclick: () => this.quizBeenden() }, 'Quiz beenden'));
  }

  private async weiter() {
    const q = this.quiz!;
    if (q.index + 1 >= q.fragen.length) { this.ansicht = 'ergebnis'; await this.ebenenZuruecksetzen(); this.u.auswahlAufheben(); this.zeichnen(); return; }
    q.index++;
    q.beantwortet = false;
    await this.frageVorbereiten();
  }

  private async ebenenZuruecksetzen() {
    if (!this.quiz) return;
    for (const [id, sichtbar] of this.quiz.vorherSichtbar) await this.u.modell.setzeEbeneSichtbar(id, sichtbar);
  }

  private async quizBeenden() {
    await this.ebenenZuruecksetzen();
    this.quiz = null;
    this.ansicht = 'start';
    this.u.auswahlAufheben();
    this.zeichnen();
  }

  private zeichneErgebnis() {
    const q = this.quiz!;
    this.ziel.append(
      h('h3', { class: 'lern-titel' }, 'Auswertung'),
      h('p', { class: 'quiz-frage' }, `${q.punkte} von ${q.fragen.length} richtig`),
      q.falsch.length ? h('p', { class: 'klein-leise' }, 'Falsch beantwortete Strukturen wurden als Lernkarten zum Wiederholen hinzugefügt:') : h('p', {}, 'Super, alles richtig!'),
      h('ul', { class: 'markierungsliste' }, q.falsch.map((f) => h('li', {}, h('button', { onclick: () => this.u.zeigeStruktur(f.struktur, f.meshName) }, anzeigename(f.struktur))))),
      h('div', { class: 'knopfreihe' },
        h('button', { class: 'knopf aktiv', onclick: () => this.quizStarten() }, 'Neues Quiz'),
        h('button', { class: 'knopf', onclick: () => { this.quiz = null; this.ansicht = 'start'; this.zeichnen(); } }, 'Zurück'),
      ),
    );
  }

  // =====================================================================
  // Lernkarten
  // =====================================================================
  private neueKarten() {
    const sp = this.u.speicher;
    // Zuerst Strukturen aus frühen Ausbildungsjahren (Bewegungsapparat), innerhalb eines Jahres zufällig
    const neu = mischen(this.pool('alle').filter((s) => !sp.daten.karten[s.id] && s.text && !s.text.allgemein))
      .sort((a, b) => lernjahr(a) - lernjahr(b)).slice(0, 10);
    for (const s of neu) sp.karteHinzufuegen(s.id);
    sp.speichern();
    this.zeichnen();
  }

  private kartenStarten() {
    const id = this.u.speicher.faellige()[0];
    this.karte = id ? { id, aufgedeckt: false } : null;
    this.ansicht = this.karte ? 'karten' : 'start';
    this.zeichnen();
  }

  private zeichneKarte() {
    if (!this.karte) { this.ansicht = 'start'; this.zeichneStart(); return; }
    const s = this.u.daten.strukturen.get(this.karte.id);
    if (!s) { delete this.u.speicher.daten.karten[this.karte.id]; this.kartenStarten(); return; }
    const t = s.text ?? {};
    const rest = this.u.speicher.faellige().length;
    this.ziel.append(
      h('div', { class: 'quiz-kopf' }, h('span', {}, 'Lernkarte'), h('span', {}, `${rest} fällig`)),
      h('div', { class: 'lernkarte' },
        h('div', { class: 'karte-name' }, anzeigename(s)),
        s.la && s.la !== anzeigename(s) ? h('div', { class: 'la' }, s.la) : null,
        h('div', { class: 'klein-leise' }, `${s.region}`),
        this.karte.aufgedeckt
          ? h('div', { class: 'karte-rueckseite' },
            t.kurz ? h('p', {}, t.kurz) : null,
            t.ursprung ? h('p', {}, h('b', {}, 'Ursprung: '), t.ursprung) : null,
            t.ansatz ? h('p', {}, h('b', {}, 'Ansatz: '), t.ansatz) : null,
            t.innervation ? h('p', {}, h('b', {}, 'Innervation: '), t.innervation) : null,
            t.aktion ? h('p', {}, h('b', {}, 'Aktion: '), t.aktion.join('; ')) : null,
            !t.ursprung && t.lage ? h('p', {}, h('b', {}, 'Lage: '), t.lage) : null,
            !t.ursprung && t.form ? h('p', {}, h('b', {}, 'Form: '), t.form) : null,
          )
          : h('p', { class: 'klein-leise' }, 'Erst selbst überlegen: Lage, Funktion, bei Muskeln Ursprung, Ansatz, Innervation. Dann aufdecken.'),
      ),
    );
    const sp = this.u.speicher;
    const weiter = (note: 0 | 1 | 2 | 3) => { sp.bewerten(s.id, note); this.kartenStarten(); };
    this.ziel.append(this.karte.aufgedeckt
      ? h('div', { class: 'bewertung' },
        h('button', { class: 'knopf', onclick: () => weiter(0) }, 'Nochmal'),
        h('button', { class: 'knopf', onclick: () => weiter(1) }, 'Schwer'),
        h('button', { class: 'knopf', onclick: () => weiter(2) }, 'Gut'),
        h('button', { class: 'knopf', onclick: () => weiter(3) }, 'Leicht'))
      : h('div', { class: 'knopfreihe' },
        h('button', { class: 'knopf aktiv', onclick: () => { this.karte!.aufgedeckt = true; this.zeichnen(); } }, 'Aufdecken'),
        h('button', { class: 'knopf', onclick: () => this.u.zeigeVerdeckt(s.meshes[0].name) }, 'Im Modell zeigen')),
      h('button', { class: 'knopf klein abbrechen', onclick: () => { this.ansicht = 'start'; this.u.auswahlAufheben(); this.zeichnen(); } }, 'Beenden'),
    );
  }

  // =====================================================================
  // Sichern
  // =====================================================================
  private exportieren() {
    const blob = new Blob([this.u.speicher.exportieren()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `anatomie-fortschritt-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a);
    a.click();
    a.remove();
  }

  private importieren() {
    const input = h('input', { type: 'file', accept: 'application/json,.json' });
    input.addEventListener('change', async () => {
      const datei = input.files?.[0];
      if (!datei) return;
      try {
        await this.u.speicher.importieren(await datei.text());
        this.u.lernpfadGeaendert();
        this.zeichnen();
        alert('Fortschritt wurde importiert.');
      } catch (e) {
        alert(`Import fehlgeschlagen: ${e instanceof Error ? e.message : e}`);
      }
    });
    input.click();
  }
}
