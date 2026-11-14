// Gemeinsame Datentypen der App. Sie beschreiben die JSON-Dateien in public/inhalte.

export type Seite = 'l' | 'r' | null;
export type Vec3 = [number, number, number];

/** Ein einzelnes 3D-Teil (Mesh) einer Struktur, z. B. "Femur.l". */
export interface MeshInfo {
  name: string;
  seite: Seite;
  mitte: Vec3;
}

/** Von Hand geschriebene Lerninhalte (public/inhalte/texte/*.json). Alle Felder sind optional. */
export interface Lerntext {
  jahr?: 1 | 2 | 3;
  kurz?: string;
  lage?: string;
  form?: string;
  aufbau?: string;
  markierungen?: string[];
  gelenke?: string[];
  muskeln?: string[];
  baender?: string[];
  tastbar?: string[];
  // Muskeln
  ursprung?: string;
  ansatz?: string;
  aktion?: string[];
  innervation?: string;
  versorgung?: string;
  synergisten?: string[];
  antagonisten?: string[];
  // Nerven, Organe
  ursprung_segmente?: string;
  versorgt?: string[];
  system?: string;
  funktion_liste?: string[];
  praxis?: string;
  offen?: string[];
  status?: 'entwurf' | 'geprueft';
  quellen?: string[];
  /** true = allgemeiner Text für den Strukturtyp, nicht speziell für diese Struktur */
  allgemein?: boolean;
}

/** Gelenk: Gruppe aus Kapsel, Bändern und Knochen mit eigenem Lerntext. */
export interface Gelenk {
  id: string;
  name: string;
  la: string;
  jahr?: 1 | 2 | 3;
  typ?: string;
  knochen?: string[];
  achsen?: string[];
  rom?: { bewegung: string; wert: string; quelle: string }[];
  kapsel_baender?: string[];
  ruhestellung?: string;
  verriegelung?: string;
  praxis?: string;
  offen?: string[];
  mitglieder: string[];
}

export interface Ansatzflaeche {
  mesh: string;
  art: 'ursprung' | 'ansatz';
  seite: Seite;
}

/** Eine anatomische Struktur (kann links und rechts je ein Mesh haben). */
export interface Struktur {
  id: string;
  ebene: string;
  en: string;
  la: string | null;
  de: string | null;
  typ: string;
  region: string;
  gruppe: string | null;
  meshes: MeshInfo[];
  text?: Lerntext;
  /** IDs der Gelenke, zu denen die Struktur gehört */
  gelenke?: string[];
  /** Versorgender Nerv laut Z-Anatomy-Zuordnung (nur Muskeln) */
  nerven_modell?: string[];
}

/** Knochenmarkierung (Ankerpunkt aus Z-Anatomy), z. B. Trochanter major. */
export interface Markierung {
  id: string;
  en: string;
  la: string | null;
  de: string | null;
  seite: Seite;
  pos: Vec3;
}

export interface EbeneDef {
  id: string;
  name: string;
  datei?: string;
  verfuegbar: boolean;
  start_sichtbar?: boolean;
  start_deckkraft?: number;
  farbe?: string;
  etappe?: number;
  hinweis?: string;
}

export interface Feinbau {
  titel: string;
  bild?: string;
  abschnitte: { name: string; text: string }[];
}

export interface Quelle {
  titel: string;
  url: string;
  lizenz: string;
  art: string;
}

export interface Daten {
  strukturen: Map<string, Struktur>;
  meshIndex: Record<string, string>;
  markierungen: Record<string, Markierung[]>;
  gelenke: Map<string, Gelenk>;
  ansaetze: Record<string, Ansatzflaeche[]>;
  ebenen: EbeneDef[];
  feinbau: Record<string, Feinbau>;
  feinbauZuordnung: Record<string, string>;
  quellen: Record<string, Quelle>;
  standardQuellen: string[];
}

/** Lernjahr einer Struktur (ohne Angabe: 1. Jahr für Bewegungsapparat, sonst 2.). */
export function lernjahr(s: Struktur): 1 | 2 | 3 {
  if (s.text?.jahr) return s.text.jahr;
  if (['knochen', 'baender_gelenke', 'muskeln_oberflaechlich', 'muskeln_tief', 'faszien'].includes(s.ebene)) return 1;
  if (s.ebene === 'organe') return 3;
  return 2;
}

/** Angezeigter Hauptname: deutsch, sonst lateinisch, sonst englisch. */
export function anzeigename(s: { de: string | null; la: string | null; en: string }): string {
  return s.de ?? s.la ?? s.en;
}

export const SEITE_TEXT: Record<string, string> = { l: 'links', r: 'rechts' };
