// Lädt alle Inhalte (JSON) und verknüpft Strukturen mit ihren Lerntexten.
import type { Ansatzflaeche, Daten, EbeneDef, Feinbau, Gelenk, Lerntext, Markierung, Quelle, Struktur } from '../typen';

interface TextDatei {
  standard_quellen?: string[];
  eintraege: Record<string, Lerntext>;
  vorlagen?: { muster: string; eintrag: Lerntext }[];
  typen?: Record<string, Lerntext>;
}

async function json<T>(pfad: string): Promise<T> {
  const antwort = await fetch(pfad);
  if (!antwort.ok) throw new Error(`Konnte ${pfad} nicht laden (${antwort.status})`);
  return antwort.json() as Promise<T>;
}

/** Welche Textdatei ist für welche Ebene zuständig? */
const DATEI_FUER_EBENE: Record<string, string> = {
  knochen: 'knochen', muskeln_oberflaechlich: 'muskeln', muskeln_tief: 'muskeln', faszien: 'faszien',
};

/** Sucht den Lerntext: eigener Eintrag → Vorlage (Muster) → allgemeiner Text für den Strukturtyp. */
function textFuer(s: Struktur, dateien: Record<string, TextDatei>): Lerntext | undefined {
  const eigene = dateien[DATEI_FUER_EBENE[s.ebene] ?? 'weitere'];
  const weitere = dateien.weitere;
  for (const d of [eigene, weitere]) {
    if (d?.eintraege[s.en]) return d.eintraege[s.en];
  }
  const vorlage = eigene?.vorlagen?.find((v) => new RegExp(v.muster).test(s.en));
  if (vorlage) return vorlage.eintrag;
  return weitere.typen?.[s.typ];
}

export async function ladeDaten(): Promise<Daten> {
  const [gen, ebenen, knochen, muskeln, faszien, weitere, gelenkDatei, feinbau, quellen] = await Promise.all([
    json<{
      strukturen: Struktur[]; meshIndex: Record<string, string>; markierungen: Record<string, Markierung[]>;
      gelenke: { id: string; mitglieder: string[] }[]; ansaetze: Record<string, Ansatzflaeche[]>;
    }>('./inhalte/generiert/strukturen.json'),
    json<{ ebenen: EbeneDef[] }>('./inhalte/ebenen.json'),
    json<TextDatei>('./inhalte/texte/knochen.json'),
    json<TextDatei>('./inhalte/texte/muskeln.json'),
    json<TextDatei>('./inhalte/texte/faszien.json'),
    json<TextDatei>('./inhalte/texte/weitere.json'),
    json<{ eintraege: Record<string, Omit<Gelenk, 'id' | 'mitglieder'>> }>('./inhalte/texte/gelenke.json'),
    json<Record<string, Feinbau> & { _zuordnung?: Record<string, string> }>('./inhalte/texte/feinbau.json'),
    json<Record<string, Quelle>>('./inhalte/texte/quellen.json'),
  ]);
  const dateien = { knochen, muskeln, faszien, weitere };

  const strukturen = new Map<string, Struktur>();
  for (const s of gen.strukturen) {
    s.text = textFuer(s, dateien);
    strukturen.set(s.id, s);
  }
  const gelenke = new Map<string, Gelenk>();
  for (const g of gen.gelenke) {
    const text = gelenkDatei.eintraege[g.id];
    if (text) gelenke.set(g.id, { ...text, id: g.id, mitglieder: g.mitglieder });
  }
  const { _zuordnung, ...feinbauTexte } = feinbau;
  return {
    strukturen,
    meshIndex: gen.meshIndex,
    markierungen: gen.markierungen,
    gelenke,
    ansaetze: gen.ansaetze,
    ebenen: ebenen.ebenen,
    feinbau: feinbauTexte as Record<string, Feinbau>,
    feinbauZuordnung: _zuordnung ?? {},
    quellen,
    standardQuellen: knochen.standard_quellen ?? [],
  };
}
