// Gemeinsame Datentypen der App. Sie beschreiben die JSON-Dateien in public/inhalte.

export type Seite = 'l' | 'r' | null;
export type Vec3 = [number, number, number];

/** Ein einzelnes 3D-Teil (Mesh) einer Struktur, z. B. "Femur.l". */
export interface MeshInfo {
  name: string;
  seite: Seite;
  mitte: Vec3;
}

/** Von Hand geschriebene Lerninhalte (public/inhalte/texte/*.json). */
export interface Lerntext {
  jahr?: 1 | 2 | 3;
  kurz?: string;
  lage?: string;
  form?: string;
  markierungen?: string[];
  gelenke?: string[];
  muskeln?: string[];
  baender?: string[];
  tastbar?: string[];
  praxis?: string;
  offen?: string[];
  status?: 'entwurf' | 'geprueft';
  quellen?: string[];
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
  ebenen: EbeneDef[];
  feinbau: Record<string, Feinbau>;
  quellen: Record<string, Quelle>;
  standardQuellen: string[];
}

/** Angezeigter Hauptname: deutsch, sonst lateinisch, sonst englisch. */
export function anzeigename(s: { de: string | null; la: string | null; en: string }): string {
  return s.de ?? s.la ?? s.en;
}

export const SEITE_TEXT: Record<string, string> = { l: 'links', r: 'rechts' };
