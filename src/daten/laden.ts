// Lädt alle Inhalte (JSON) und verknüpft Strukturen mit ihren Lerntexten.
import type { Daten, EbeneDef, Feinbau, Lerntext, Markierung, Quelle, Struktur } from '../typen';

interface TextDatei {
  standard_quellen?: string[];
  eintraege: Record<string, Lerntext>;
  vorlagen?: { muster: string; eintrag: Lerntext }[];
}

async function json<T>(pfad: string): Promise<T> {
  const antwort = await fetch(pfad);
  if (!antwort.ok) throw new Error(`Konnte ${pfad} nicht laden (${antwort.status})`);
  return antwort.json() as Promise<T>;
}

/** Sucht den Lerntext für einen englischen Strukturnamen: erst direkter Eintrag, dann Vorlage. */
function textFuer(en: string, datei: TextDatei): Lerntext | undefined {
  if (datei.eintraege[en]) return datei.eintraege[en];
  const vorlage = datei.vorlagen?.find((v) => new RegExp(v.muster).test(en));
  return vorlage?.eintrag;
}

export async function ladeDaten(): Promise<Daten> {
  const [gen, ebenen, knochenTexte, feinbau, quellen] = await Promise.all([
    json<{ strukturen: Struktur[]; meshIndex: Record<string, string>; markierungen: Record<string, Markierung[]> }>(
      './inhalte/generiert/strukturen.json',
    ),
    json<{ ebenen: EbeneDef[] }>('./inhalte/ebenen.json'),
    json<TextDatei>('./inhalte/texte/knochen.json'),
    json<Record<string, Feinbau>>('./inhalte/texte/feinbau.json'),
    json<Record<string, Quelle>>('./inhalte/texte/quellen.json'),
  ]);

  const strukturen = new Map<string, Struktur>();
  for (const s of gen.strukturen) {
    if (s.ebene === 'knochen') s.text = textFuer(s.en, knochenTexte);
    strukturen.set(s.id, s);
  }
  return {
    strukturen,
    meshIndex: gen.meshIndex,
    markierungen: gen.markierungen,
    ebenen: ebenen.ebenen,
    feinbau,
    quellen,
    standardQuellen: knochenTexte.standard_quellen ?? [],
  };
}
