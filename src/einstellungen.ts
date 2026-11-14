// Einstellungen (Thema, Ebenen) im Browser speichern.
// localStorage kann in privaten Fenstern fehlen -> alles in try/catch.
const SCHLUESSEL = 'anatomie-einstellungen-v1';

export interface Einstellungen {
  thema?: 'auto' | 'light' | 'dark';
  hinweisGelesen?: boolean;
  detailstufe?: 1 | 2 | 3;
}

export function lies(): Einstellungen {
  try {
    return JSON.parse(localStorage.getItem(SCHLUESSEL) ?? '{}') as Einstellungen;
  } catch {
    return {};
  }
}

export function speichere(teil: Partial<Einstellungen>) {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify({ ...lies(), ...teil }));
  } catch {
    /* Speichern nicht möglich – App funktioniert trotzdem */
  }
}
