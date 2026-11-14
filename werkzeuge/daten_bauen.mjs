// Baut aus den Export-Zwischendaten die Strukturliste für die App.
//
// Aufruf: node werkzeuge/daten_bauen.mjs
//
// Eingaben:
//   werkzeuge/zwischenstand/<ebene>.meshes.json   (von blender_export.py)
//   werkzeuge/zwischenstand/knochen.markierungen.json
//   werkzeuge/quellen/TA2.csv                     (lateinische Namen)
//   public/inhalte/texte/namen_de.json            (deutsche Namen, von Hand gepflegt)
//   public/inhalte/texte/gelenke.json             (Gelenke = Gruppen von Strukturen)
// Ausgabe:
//   public/inhalte/generiert/strukturen.json
//
// Prüfungen: eindeutige IDs und Meshnamen; Texteinträge ohne passende Struktur werden gemeldet.
import fs from 'node:fs';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const zw = (d) => path.join(WURZEL, 'werkzeuge/zwischenstand', d);
const texte = (d) => JSON.parse(fs.readFileSync(path.join(WURZEL, 'public/inhalte/texte', d), 'utf8'));
// Reihenfolge = Reihenfolge im Baum (innen nach außen ist für den Lernbeginn ungünstig, daher Knochen zuerst)
const EBENEN = ['knochen', 'baender_gelenke', 'muskeln_oberflaechlich', 'muskeln_tief', 'faszien', 'haut', 'unterhaut', 'nerven_gefaesse', 'organe'];

// ---------- Lateinische Namen aus der TA2-Tabelle ----------
const ta2 = new Map();
for (const zeile of fs.readFileSync(path.join(WURZEL, 'werkzeuge/quellen/TA2.csv'), 'utf8').split('\n')) {
  const teile = zeile.trim().replace(/^"|"$/g, '').split(';');
  if (teile.length > 2 && teile[1] && !ta2.has(teile[1].trim().toLowerCase())) {
    ta2.set(teile[1].trim().toLowerCase(), teile[2].trim());
  }
}
/** Z-Anatomy markiert Gefäße mit einem Apostroph am Ende ("Femoral artery'") – für die Suche entfernen. */
const sauber = (en) => en.replace(/'+$/, '').replace(/\s+/g, ' ').replace(/^\((.*)\)$/, '$1').trim();
const latein = (en) => ta2.get(sauber(en).toLowerCase()) ?? null;

/** Im Deutschen übliche Kurzform: "Musculus gluteus medius" -> "M. gluteus medius". */
function kurzLatein(la) {
  if (!la) return null;
  return la
    .replace(/\bMusculi\b/g, 'Mm.').replace(/\bMusculus\b/g, 'M.')
    .replace(/\bLigamenta\b/g, 'Ligg.').replace(/\bLigamentum\b/g, 'Lig.')
    .replace(/\bNervi\b/g, 'Nn.').replace(/\bNervus\b/g, 'N.')
    .replace(/\bArteriae\b/g, 'Aa.').replace(/\bArteria\b/g, 'A.')
    .replace(/\bVenae\b/g, 'Vv.').replace(/\bVena\b/g, 'V.')
    .replace(/\bRamus\b/g, 'R.').replace(/\bRami\b/g, 'Rr.');
}

// ---------- Deutsche Namen ----------
const namenDe = texte('namen_de.json');
const ORDINAL = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12 };
const GLIED = { proximal: 'Grundglied', middle: 'Mittelglied', distal: 'Endglied' };

/** Deutsche Namen; systematische Namen werden erzeugt, sonst null. */
function deutscherName(en) {
  en = sauber(en);
  if (namenDe.strukturen[en]) return namenDe.strukturen[en];
  let m;
  if ((m = en.match(/^(\w+) rib$/i)) && ORDINAL[m[1].toLowerCase()]) return `${ORDINAL[m[1].toLowerCase()]}. Rippe`;
  if ((m = en.match(/^Costal cartilage of (\w+) rib$/i))) return `Rippenknorpel der ${ORDINAL[m[1].toLowerCase()]}. Rippe`;
  if ((m = en.match(/^Vertebra ([CTL])(\d+)$/))) {
    const art = { C: 'Halswirbel', T: 'Brustwirbel', L: 'Lendenwirbel' }[m[1]];
    return `${m[2]}. ${art} (${m[1] === 'T' ? 'Th' : m[1]}${m[2]})`;
  }
  if ((m = en.match(/^(\w+) (metacarpal|metatarsal) bone$/i))) {
    return `${ORDINAL[m[1].toLowerCase()]}. ${m[2] === 'metacarpal' ? 'Mittelhandknochen' : 'Mittelfußknochen'}`;
  }
  if ((m = en.match(/^(Proximal|Middle|Distal) phalanx of (\w+) finger of (hand|foot)$/i))) {
    const glied = GLIED[m[1].toLowerCase()];
    const n = ORDINAL[m[2].toLowerCase()];
    if (m[3] === 'hand') return n === 1 ? `${glied} des Daumens` : `${glied} des ${n}. Fingers`;
    return n === 1 ? `${glied} der Großzehe` : `${glied} der ${n}. Zehe`;
  }
  if ((m = en.match(/^(Upper|Lower) (medial incisor|lateral incisor|canine|first premolar|second premolar|first molar tooth|second molar tooth)$/))) {
    const zahn = {
      'medial incisor': 'Mittlerer Schneidezahn', 'lateral incisor': 'Seitlicher Schneidezahn', canine: 'Eckzahn',
      'first premolar': 'Erster Prämolar', 'second premolar': 'Zweiter Prämolar',
      'first molar tooth': 'Erster Molar', 'second molar tooth': 'Zweiter Molar',
    }[m[2]];
    return `${zahn} (${m[1] === 'Upper' ? 'oben' : 'unten'})`;
  }
  if (en === 'Subcutaneous tissue (schematic)') return 'Unterhaut (schematisch)';
  return null;
}

// ---------- Typ, Region und Gruppe ----------
function typVon(ebene, en, materialien, sammlungen) {
  const n = en.toLowerCase();
  const s = sammlungen.join('|');
  if (ebene === 'knochen') {
    if (sammlungen.includes('Teeth')) return 'zahn';
    if (/cartilage/.test(n)) return 'knorpel';
    if (/sinus of|cells of ethmoid/.test(n)) return 'hoehle';
    return 'knochen';
  }
  if (ebene === 'baender_gelenke') {
    if (/meniscus/.test(n)) return 'meniskus';
    if (/intervertebral disc|annulus fibrosus|nucleus pulposus/.test(n)) return 'bandscheibe';
    if (/labrum/.test(n)) return 'gelenklippe';
    if (/articular disc/.test(n)) return 'gelenkscheibe';
    if (/bursa/.test(n)) return 'schleimbeutel';
    if (/sheath/.test(n)) return 'sehnenscheide';
    const mat = materialien[0] ?? '';
    if (/capsule/i.test(mat) || /capsule/.test(n)) return 'kapsel';
    if (/cartilage/i.test(mat)) return 'knorpel';
    if (/membrane/.test(n)) return 'membran';
    return 'band';
  }
  if (ebene.startsWith('muskeln')) return 'muskel';
  if (ebene === 'faszien') {
    if (/retinacul/.test(n)) return 'retinaculum';
    if (/aponeuros/.test(n)) return 'aponeurose';
    if (/septum/.test(n)) return 'septum';
    return 'faszie';
  }
  if (ebene === 'haut') return /nail|perionyx/.test(n) ? 'nagel' : 'hautregion';
  if (ebene === 'unterhaut') return 'unterhaut';
  if (ebene === 'nerven_gefaesse') {
    if (/Heart|Arteries of heart|Cardiac veins/.test(s) || /atri(um|al)|ventricle|valve|leaflet|papillary/.test(n)) return 'herz';
    if (/vein|venous|sinus/.test(n) || /veins/i.test(s)) return 'vene';
    if (/arter|aorta|trunk'|arch'/.test(n) || /arteries|Aorta/i.test(s)) return 'arterie';
    if (/Central nervous system|Brain|Telencephalon|Cerebellum|Brainstem|Spinal cord/.test(s) || /gyrus|sulcus|lobe|cortex|nucleus|spinal cord|dura|ventricle/.test(n)) return 'zns';
    // Achtung: die Obersammlung heißt "7: Nervous system & Sense organs" – nur die Untersammlung zählt
    if (sammlungen.includes('Sense organs') || /eye|retina|lens|cornea/.test(n)) return 'sinnesorgan';
    return 'nerv';
  }
  if (ebene === 'organe') {
    if (/Lymphoid/.test(s) || /node|tonsil|lymph|thymus|spleen/.test(n)) return 'lymphatisch';
    return 'organ';
  }
  return 'struktur';
}

function regionKnochen(en, sammlungen) {
  const n = en.toLowerCase();
  if (sammlungen.includes('Teeth')) return 'Zähne';
  if (/thyroid|cricoid|arytenoid|corniculate/.test(n)) return 'Kehlkopf';
  if (/hyoid/.test(n)) return 'Hals';
  if (/vertebra|atlas|axis/.test(n)) return 'Wirbelsäule';
  if (/rib|sternum|xiphoid/.test(n)) return 'Brustkorb';
  if (/hip bone|sacrum|coccyx/.test(n)) return 'Becken';
  if (/clavicle|scapula/.test(n)) return 'Schultergürtel';
  if (/humerus|radius|ulna/.test(n)) return 'Arm';
  if (/scaphoid|lunate|triquetrum|pisiform|trapezi|capitate|hamate|metacarpal|of hand/.test(n)) return 'Hand';
  if (/femur|patella|tibia|fibula/.test(n)) return 'Bein';
  if (/talus|calcaneus|navicular|cuboid|cuneiform|metatarsal|of foot/.test(n)) return 'Fuß';
  return 'Schädel';
}

function regionKoerper(sammlungen, en) {
  const s = sammlungen.join('|');
  if (/upper limb|hand|forearm|arm\b|axilla/i.test(s)) return /hand|carp|Metacarpo|digit/i.test(s + en) ? 'Hand' : 'Arm und Schulter';
  if (/lower limb|foot|leg\b|thigh|gluteal/i.test(s)) return /foot|tars|Metatarso|plantar|Subtalar/i.test(s + en) ? 'Fuß' : 'Bein und Hüfte';
  if (/Head|face|epicranium|Auricular|Brain|Cranial|Telencephalon|Cerebell|Brainstem|Mouth|eye/i.test(s)) return 'Kopf';
  if (/Neck|cervical|Larynx|Pharynx/i.test(s)) return 'Hals';
  if (/Back|Vertebral column/i.test(s)) return 'Rücken';
  if (/Thorax|Heart|Lungs|Bronchi|Respiratory/i.test(s)) return 'Brustkorb';
  if (/Abdomen|Digestive|Liver|Pelvis|Urinary|Genital|Peritoneal/i.test(s)) return 'Bauch und Becken';
  return 'Rumpf';
}

const GRUPPEN_DE = {
  'Knee joint': 'Kniegelenk', 'Hip joint': 'Hüftgelenk', 'Glenohumeral joint': 'Schultergelenk', 'Elbow joint': 'Ellenbogengelenk',
  'Sternoclavicular joint': 'Sternoklavikulargelenk', 'Acromioclavicular joint': 'Akromioklavikulargelenk',
  'Subtalar joint': 'Unteres Sprunggelenk', 'Talocalcaneonavicular joint': 'Unteres Sprunggelenk (vordere Kammer)', 'Radiocarpal joint': 'Proximales Handgelenk',
  'Temporomandibular joint': 'Kiefergelenk', 'Sacro-iliac joint': 'Iliosakralgelenk', 'Distal radio-ulnar joint': 'Distales Radioulnargelenk',
  'Superior tibiofibular joint': 'Proximales Tibiofibulargelenk',
  'Intervertebral disc': 'Bandscheiben', 'Joints of hand': 'Gelenke der Hand', 'Metacarpophalangeal joints': 'Fingergrundgelenke',
  'Interphalangeal joints of hand': 'Fingergelenke', 'Interphalangeal joints of foot': 'Zehengelenke', 'Metatarsophalangeal joints': 'Zehengrundgelenke',
  'Intermetatarsal joints': 'Intermetatarsalgelenke', 'Intermetacarpal joints': 'Intermetakarpalgelenke',
  'Fibrous joints of vertebral column': 'Bandverbindungen der Wirbelsäule', 'Cranial syndesmosis': 'Bandhaften des Schädels',
  'Tendon sheaths': 'Sehnenscheiden', Bursae: 'Schleimbeutel',
  // Muskelgruppen und Logen
  'Muscles of neck': 'Halsmuskeln', 'Muscles of head': 'Kopfmuskeln', 'Facial muscles': 'Mimische Muskulatur',
  'Muscles of upper limb': 'Muskeln der oberen Extremität', 'Muscles of lower limb': 'Muskeln der unteren Extremität',
  'Muscles of foot': 'Fußmuskeln', 'Muscles of hand': 'Handmuskeln', 'Muscles of abdomen': 'Bauchmuskeln',
  'Laryngeal muscles': 'Kehlkopfmuskeln', 'Hypaxial muscles of back': 'Rückenmuskeln (hypaxial)',
  'Transversospinal muscles': 'Transversospinales System', 'Deep gluteal muscles': 'Tiefe Gesäßmuskeln (Pelvitrochantäre Muskeln)',
  'Suboccipital muscles': 'Kurze Nackenmuskeln', 'Anterior compartment of forearm': 'Unterarm: Beugerloge',
  'Posterior compartment of forearm': 'Unterarm: Streckerloge', 'Anterior compartment of arm': 'Oberarm: Beugerloge',
  'Posterior compartment of arm': 'Oberarm: Streckerloge', 'Anterior compartment of thigh': 'Oberschenkel: Extensorenloge',
  'Medial compartment of thigh': 'Oberschenkel: Adduktorenloge', 'Posterior compartment of thigh': 'Oberschenkel: Flexorenloge',
  'Anterior compartment of leg': 'Unterschenkel: Extensorenloge', 'Lateral compartment of leg': 'Unterschenkel: Fibularisloge',
  'Posterior compartment of leg': 'Unterschenkel: Flexorenloge',
  // Nerven, Gefäße, Organe
  'Systemic veins': 'Venen des Körperkreislaufs', 'Systemic arteries': 'Arterien des Körperkreislaufs', Aorta: 'Aorta und Äste',
  'Cranial nerves': 'Hirnnerven', 'Lumbosacral plexus': 'Plexus lumbosacralis', 'Lumbar plexus': 'Plexus lumbalis',
  'Frontal lobe': 'Stirnlappen', 'Temporal lobe': 'Schläfenlappen', 'Occipital lobe': 'Hinterhauptslappen', 'Parietal lobe': 'Scheitellappen',
  'Limbic lobe': 'Limbischer Lappen', Cerebellum: 'Kleinhirn', Brainstem: 'Hirnstamm', Heart: 'Herz', 'Arteries of heart': 'Herzkranzarterien',
  'Pulmonary arteries': 'Lungenarterien', 'Pulmonary veins': 'Lungenvenen',
  '6: Lymphoid organs': 'Lymphatische Organe', '8: Visceral systems': 'Eingeweide',
};
function deGruppe(en) {
  if (GRUPPEN_DE[en]) return GRUPPEN_DE[en];
  if (/brachial plexus/i.test(en)) return 'Plexus brachialis';
  if (/pulmonary (artery|vein)/i.test(en)) return /artery/i.test(en) ? 'Lungenarterien' : 'Lungenvenen';
  return en;
}
const NERVEN_GRUPPEN = /(nerve|plexus)/i;
function gruppeVon(ebene, sammlungen) {
  if (ebene === 'baender_gelenke') {
    const g = sammlungen.find((s) => /joint|disc|Tendon sheaths|Bursae/i.test(s) && s !== '3: Joints');
    return g ? { de: deGruppe(g), en: g } : null;
  }
  if (ebene.startsWith('muskeln')) {
    // Muskelgruppe: Logen ("compartment") oder Muskelgruppen wie "Muscles of hand"
    // Logen (compartments) sind genauer als allgemeine Gruppen wie "Muscles of lower limb"
    const g = sammlungen.find((s) => /compartment/i.test(s)) ?? sammlungen.find((s) => /Muscles of|muscles$/i.test(s) && !/^(Muscles|Superficial muscles)$/.test(s));
    return g ? { de: deGruppe(g), en: g } : null;
  }
  if (ebene === 'nerven_gefaesse') {
    const g = sammlungen.find((s) => /plexus|Cranial nerves|Brainstem|Cerebellum|lobe|Aorta|Heart|Systemic|Pulmonary/i.test(s));
    return g ? { de: deGruppe(g), en: g } : null;
  }
  if (ebene === 'organe') {
    const g = sammlungen.find((s) => /Digestive|Respiratory|Urinary|Genital|Endocrine|Liver|Lungs|Bronchi|Mouth|Lymphoid system/i.test(s));
    const de = { 'Digestive system': 'Verdauungssystem', 'Respiratory system': 'Atmungssystem', 'Urinary system': 'Harnsystem', "Genital systems'": 'Geschlechtsorgane',
      'Endocrine glands': 'Hormondrüsen', Liver: 'Leber', Lungs: 'Lunge', Bronchi: 'Bronchien', Mouth: 'Mundhöhle', 'Lymphoid system': 'Lymphatisches System' }[g ?? ''];
    return g ? { de: de ?? deGruppe(g), en: g } : null;
  }
  return null;
}

const slug = (s) => sauber(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- Strukturen sammeln ----------
const strukturen = new Map();
const meshIndex = {};
const fehlendLatein = [];
for (const ebene of EBENEN) {
  const datei = zw(`${ebene}.meshes.json`);
  if (!fs.existsSync(datei)) { console.warn(`fehlt: ${datei}`); continue; }
  const { meshes } = JSON.parse(fs.readFileSync(datei, 'utf8'));
  for (const m of meshes) {
    if (meshIndex[m.name]) throw new Error(`Meshname doppelt: ${m.name}`);
    const seite = /\.l$/.test(m.name) ? 'l' : /\.r$/.test(m.name) ? 'r' : null;
    const en = m.name.replace(/\.[lr]$/, '');
    let id = slug(en);
    if (strukturen.has(id) && strukturen.get(id).ebene !== ebene) id = `${ebene}-${id}`;
    if (!strukturen.has(id)) {
      const la = latein(en);
      if (!la) fehlendLatein.push(en);
      const typ = typVon(ebene, en, m.materialien, m.sammlungen);
      // Für Muskeln, Bänder, Nerven, Gefäße ist im Deutschen die lateinische Kurzform üblich ("M. gluteus medius").
      const de = deutscherName(en) ?? (['knochen', 'haut'].includes(ebene) ? null : kurzLatein(la));
      const nerven = ebene.startsWith('muskeln')
        ? m.sammlungen.filter((s) => NERVEN_GRUPPEN.test(s)).map((s) => kurzLatein(latein(s)) ?? s)
        : [];
      const gruppe = gruppeVon(ebene, m.sammlungen);
      strukturen.set(id, {
        id, ebene, en: sauber(en), la, de, typ,
        region: ebene === 'knochen' ? regionKnochen(en, m.sammlungen) : regionKoerper(m.sammlungen, en),
        gruppe: gruppe?.de ?? null, gruppe_en: gruppe?.en ?? null,
        ...(nerven.length ? { nerven_modell: [...new Set(nerven)] } : {}),
        meshes: [],
      });
    }
    strukturen.get(id).meshes.push({ name: m.name, seite, mitte: m.mitte });
    meshIndex[m.name] = id;
  }
}

// ---------- Gelenke (Gruppen aus Kapsel, Bändern und Knochen) ----------
const gelenkTexte = texte('gelenke.json');
const gelenke = [];
const nachEn = new Map([...strukturen.values()].map((s) => [s.en, s]));
for (const [id, g] of Object.entries(gelenkTexte.eintraege)) {
  const mitglieder = new Set();
  for (const s of strukturen.values()) if (g.gruppen?.includes(s.gruppe_en)) mitglieder.add(s.id);
  for (const en of g.strukturen ?? []) {
    if (nachEn.has(en)) mitglieder.add(nachEn.get(en).id);
    else console.warn(`Gelenk ${id}: Struktur "${en}" gibt es im Modell nicht`);
  }
  for (const m of mitglieder) (strukturen.get(m).gelenke ??= []).push(id);
  gelenke.push({ id, mitglieder: [...mitglieder] });
}

// ---------- Ursprungs- und Ansatzflächen ----------
// Namen wie "Deltoid muscle.el" (e = Ansatz, o = Ursprung, Ziffer = weitere Fläche, l/r = Seite).
const ansaetze = {};
let ansatzOhneMuskel = 0;
if (fs.existsSync(zw('ansaetze.meshes.json'))) {
  const muskeln = [...strukturen.values()].filter((s) => s.typ === 'muskel');
  const norm = (t) => sauber(t).toLowerCase().replace(/ muscle\b/g, '').replace(/^m\. /, '').trim();
  for (const m of JSON.parse(fs.readFileSync(zw('ansaetze.meshes.json'), 'utf8')).meshes) {
    const treffer = m.name.match(/^(.*)\.([oe])\d*([lr])?$/);
    if (!treffer) continue;
    const [, basis, art, seite] = treffer;
    const b = norm(basis);
    // Muskel mit gleichem Namen, sonst alle Teile, deren Name den Basisnamen enthält (z. B. Deltoid -> 3 Anteile)
    let ziel = muskeln.filter((s) => norm(s.en) === b);
    if (!ziel.length) ziel = muskeln.filter((s) => norm(s.en).includes(b) || b.includes(norm(s.en)));
    if (!ziel.length) { ansatzOhneMuskel++; continue; }
    for (const s of ziel) {
      (ansaetze[s.id] ??= []).push({ mesh: m.name, art: art === 'o' ? 'ursprung' : 'ansatz', seite: seite ?? null });
    }
  }
}

// ---------- Markierungen (Ankerpunkte) ----------
const GRUPPENLABEL = /^(skeleton|bones? of|skeletal|cartilages|axial|appendicular|thoracic skeleton|vertebral column|cranium|ribs$|costal cartilages|teeth|auditory ossicles|pelvic girdle|bony pelvis|pectoral girdle|tarsal bones|lumbar vertebrae|extracranial bones|vertebra$|sternum$|bones of thorax|cartilages of ear|mandibular dental arch)/i;
const FALSCH_ZUGEORDNET = { 'atlas-c1': ['Foramen magnum'], sacrum: ['Greater sciatic foramen'] };
const basisnamen = new Set([...strukturen.values()].map((s) => s.en.toLowerCase()));
const markierungen = {};
let anzahlMarkierungen = 0;
for (const p of JSON.parse(fs.readFileSync(zw('knochen.markierungen.json'), 'utf8'))) {
  const name = p.name.replace(/^\[|\]$/g, '').trim();
  const strukturId = meshIndex[p.knochen];
  if (!strukturId || GRUPPENLABEL.test(name) || basisnamen.has(name.toLowerCase())) continue;
  if ([...basisnamen].some((b) => b.startsWith(name.toLowerCase()))) continue;
  if (FALSCH_ZUGEORDNET[strukturId]?.includes(name)) continue;
  const liste = (markierungen[strukturId] ??= []);
  if (liste.some((x) => x.en === name)) continue;
  liste.push({
    id: slug(name), en: name, la: latein(name), de: namenDe.markierungen[name] ?? null,
    seite: /\.l$/.test(p.knochen) ? 'l' : /\.r$/.test(p.knochen) ? 'r' : null, pos: p.pos,
  });
  anzahlMarkierungen++;
}

// ---------- Prüfen: passen alle Texteinträge zu Strukturen? ----------
for (const datei of ['knochen.json', 'muskeln.json', 'faszien.json', 'weitere.json']) {
  if (!fs.existsSync(path.join(WURZEL, 'public/inhalte/texte', datei))) continue;
  const t = texte(datei);
  const fehlend = Object.keys(t.eintraege).filter((en) => !basisnamen.has(en.toLowerCase()));
  if (fehlend.length) console.warn(`${datei}: Einträge ohne 3D-Struktur: ${fehlend.join(', ')}`);
  for (const v of t.vorlagen ?? []) {
    const re = new RegExp(v.muster);
    if (![...strukturen.values()].some((s) => re.test(s.en))) console.warn(`${datei}: Vorlage passt auf nichts: ${v.muster}`);
  }
}

// ---------- Schreiben ----------
const ziel = path.join(WURZEL, 'public/inhalte/generiert');
fs.mkdirSync(ziel, { recursive: true });
fs.writeFileSync(path.join(ziel, 'strukturen.json'), JSON.stringify({
  _hinweis: 'AUTOMATISCH ERZEUGT von werkzeuge/daten_bauen.mjs – nicht von Hand bearbeiten. Texte gehören nach public/inhalte/texte/.',
  strukturen: [...strukturen.values()],
  meshIndex, markierungen, gelenke, ansaetze,
}));

console.log(`Strukturen: ${strukturen.size} (Meshes: ${Object.keys(meshIndex).length})`);
for (const e of EBENEN) {
  const l = [...strukturen.values()].filter((s) => s.ebene === e);
  console.log(`  ${e}: ${l.length}, mit Anzeigename (dt./Kurzlatein): ${l.filter((s) => s.de).length}, mit Latein: ${l.filter((s) => s.la).length}`);
}
console.log(`Markierungen: ${anzahlMarkierungen} an ${Object.keys(markierungen).length} Strukturen`);
console.log(`Gelenke: ${gelenke.length} (${gelenke.map((g) => `${g.id}:${g.mitglieder.length}`).join(', ')})`);
console.log(`Ursprungs-/Ansatzflächen: an ${Object.keys(ansaetze).length} Muskeln, ${ansatzOhneMuskel} Flächen ohne passenden Muskel`);
console.log(`Ohne lateinischen Namen: ${fehlendLatein.length}`);
fs.writeFileSync(zw('ohne_latein.txt'), fehlendLatein.join('\n'));
