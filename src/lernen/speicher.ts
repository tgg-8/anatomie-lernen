// Lernfortschritt dauerhaft im Browser speichern (IndexedDB über idb-keyval).
// Die Daten bleiben nur auf diesem Gerät. Über Export/Import kann man sie sichern.
import { get, set } from 'idb-keyval';

export type Lernjahr = 1 | 2 | 3 | 'alle';

/** Zustand einer Lernkarte (Spaced Repetition, Leitner-Prinzip). */
export interface Karte {
  stufe: number;      // 0 = neu/vergessen … 6 = sehr sicher
  faellig: number;    // Zeitpunkt (ms), ab dem die Karte wieder dran ist
  wiederholungen: number;
}

export interface Fortschritt {
  version: 1;
  lernjahr: Lernjahr;
  merkliste: string[];                                   // Struktur-IDs
  karten: Record<string, Karte>;                         // Struktur-ID -> Karte
  quiz: Record<string, { richtig: number; falsch: number }>;
}

const SCHLUESSEL = 'anatomie-fortschritt-v1';
const LEER: Fortschritt = { version: 1, lernjahr: 'alle', merkliste: [], karten: {}, quiz: {} };

/** Abstände in Tagen je Stufe. */
export const ABSTAENDE_TAGE = [0, 1, 2, 4, 8, 16, 32];
const TAG = 24 * 60 * 60 * 1000;

export class Speicher {
  daten: Fortschritt = structuredClone(LEER);

  async laden() {
    try {
      const d = await get<Fortschritt>(SCHLUESSEL);
      if (d?.version === 1) this.daten = { ...structuredClone(LEER), ...d };
    } catch {
      /* z. B. privater Modus: dann ohne dauerhafte Speicherung */
    }
    // Bitte den Browser, die Daten nicht automatisch zu löschen
    navigator.storage?.persist?.().catch(() => {});
  }

  async speichern() {
    try { await set(SCHLUESSEL, this.daten); } catch { /* ignorieren */ }
  }

  istGemerkt(id: string) { return this.daten.merkliste.includes(id); }
  merkenUmschalten(id: string) {
    const l = this.daten.merkliste;
    this.daten.merkliste = l.includes(id) ? l.filter((x) => x !== id) : [...l, id];
    this.speichern();
  }

  quizErgebnis(id: string, richtig: boolean) {
    const q = (this.daten.quiz[id] ??= { richtig: 0, falsch: 0 });
    if (richtig) q.richtig++;
    else {
      q.falsch++;
      // Falsch beantwortet -> als Lernkarte sofort wiederholen
      this.daten.karten[id] = { stufe: 0, faellig: Date.now(), wiederholungen: this.daten.karten[id]?.wiederholungen ?? 0 };
    }
    this.speichern();
  }

  karteHinzufuegen(id: string) {
    this.daten.karten[id] ??= { stufe: 0, faellig: Date.now(), wiederholungen: 0 };
  }

  /** Bewertung nach dem Aufdecken: 0 = nochmal, 1 = schwer, 2 = gut, 3 = leicht. */
  bewerten(id: string, note: 0 | 1 | 2 | 3) {
    const k = (this.daten.karten[id] ??= { stufe: 0, faellig: Date.now(), wiederholungen: 0 });
    k.wiederholungen++;
    if (note === 0) { k.stufe = 0; k.faellig = Date.now() + 60 * 1000; }
    else {
      k.stufe = Math.min(ABSTAENDE_TAGE.length - 1, Math.max(1, k.stufe + (note - 1)));
      const tage = ABSTAENDE_TAGE[k.stufe] * (note === 1 ? 0.5 : 1);
      k.faellig = Date.now() + Math.max(tage, 0.5) * TAG;
    }
    this.speichern();
  }

  faellige(): string[] {
    const jetzt = Date.now();
    return Object.entries(this.daten.karten).filter(([, k]) => k.faellig <= jetzt).sort((a, b) => a[1].faellig - b[1].faellig).map(([id]) => id);
  }

  exportieren(): string {
    return JSON.stringify(this.daten, null, 1);
  }

  async importieren(text: string) {
    const d = JSON.parse(text) as Fortschritt;
    if (d.version !== 1 || !Array.isArray(d.merkliste)) throw new Error('Keine gültige Sicherungsdatei');
    this.daten = { ...structuredClone(LEER), ...d };
    await this.speichern();
  }
}
