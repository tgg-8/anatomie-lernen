// Volltextsuche über Strukturen und Knochenmarkierungen (deutsch, lateinisch, englisch).
// Findet auch Wortanfänge ("troch") und kleine Tippfehler.
import MiniSearch from 'minisearch';
import { anzeigename, type Daten } from '../typen';

export interface Suchtreffer {
  art: 'struktur' | 'markierung' | 'gelenk';
  strukturId: string;
  markierungId?: string;
  titel: string;
  untertitel: string;
}

interface Dokument extends Suchtreffer {
  id: string;
  de: string;
  la: string;
  en: string;
}

/** Entfernt Akzente/Umlaute für die Suche ("Hueftbein" findet "Hüftbein"). */
function normalisiere(text: string) {
  return text.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

export class Suche {
  private index: MiniSearch<Dokument>;

  constructor(daten: Daten) {
    this.index = new MiniSearch<Dokument>({
      fields: ['de', 'la', 'en'],
      storeFields: ['art', 'strukturId', 'markierungId', 'titel', 'untertitel'],
      processTerm: (t) => normalisiere(t),
      searchOptions: { prefix: true, fuzzy: 0.2, boost: { de: 2, la: 1.5 }, combineWith: 'AND' },
    });
    const dokumente: Dokument[] = [];
    for (const s of daten.strukturen.values()) {
      dokumente.push({
        id: `s:${s.id}`, art: 'struktur', strukturId: s.id, titel: anzeigename(s),
        untertitel: [s.la, s.region].filter(Boolean).join(' · '), de: s.de ?? '', la: s.la ?? '', en: s.en,
      });
    }
    for (const [strukturId, liste] of Object.entries(daten.markierungen)) {
      const s = daten.strukturen.get(strukturId);
      for (const m of liste) {
        dokumente.push({
          id: `m:${strukturId}:${m.id}`, art: 'markierung', strukturId, markierungId: m.id,
          titel: m.de ?? m.la ?? m.en, untertitel: `Markierung an: ${s ? anzeigename(s) : strukturId}${m.la && m.de ? ' · ' + m.la : ''}`,
          de: m.de ?? '', la: m.la ?? '', en: m.en,
        });
      }
    }
    for (const g of daten.gelenke.values()) {
      dokumente.push({ id: `g:${g.id}`, art: 'gelenk', strukturId: g.id, titel: g.name, untertitel: `Gelenk · ${g.la}`, de: g.name, la: g.la, en: '' });
    }
    this.index.addAll(dokumente);
  }

  suche(text: string, max = 20): Suchtreffer[] {
    if (text.trim().length < 2) return [];
    return this.index.search(text).slice(0, max).map((r) => ({
      art: r.art, strukturId: r.strukturId, markierungId: r.markierungId, titel: r.titel, untertitel: r.untertitel,
    }));
  }
}
