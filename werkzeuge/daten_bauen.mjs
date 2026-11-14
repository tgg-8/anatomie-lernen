// Baut aus den Export-Zwischendaten die Strukturliste für die App.
//
// Aufruf: node werkzeuge/daten_bauen.mjs
//
// Eingaben:
//   werkzeuge/zwischenstand/<ebene>.meshes.json   (von blender_export.py)
//   werkzeuge/zwischenstand/knochen.markierungen.json
//   werkzeuge/quellen/TA2.csv                     (lateinische Namen)
//   public/inhalte/texte/namen_de.json            (deutsche Namen, von Hand gepflegt)
// Ausgabe:
//   public/inhalte/generiert/strukturen.json
//
// Prüfungen: Jede Struktur bekommt eine eindeutige ID; doppelte IDs oder
// Meshnamen brechen den Lauf ab.
import fs from 'node:fs';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const zw = (d) => path.join(WURZEL, 'werkzeuge/zwischenstand', d);
const EBENEN = ['knochen', 'baender_gelenke', 'haut'];

// ---------- Lateinische Namen aus der TA2-Tabelle ----------
const ta2 = new Map();
for (const zeile of fs.readFileSync(path.join(WURZEL, 'werkzeuge/quellen/TA2.csv'), 'utf8').split('\n')) {
  const teile = zeile.trim().replace(/^"|"$/g, '').split(';');
  if (teile.length > 2 && teile[1] && !ta2.has(teile[1].trim().toLowerCase())) {
    ta2.set(teile[1].trim().toLowerCase(), teile[2].trim());
  }
}
const latein = (en) => ta2.get(en.toLowerCase()) ?? null;

// ---------- Deutsche Namen ----------
const namenDe = JSON.parse(fs.readFileSync(path.join(WURZEL, 'public/inhalte/texte/namen_de.json'), 'utf8'));
const ORDINAL = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12 };
const GLIED = { proximal: 'Grundglied', middle: 'Mittelglied', distal: 'Endglied' };

/** Erzeugt deutsche Namen für systematisch benannte Strukturen. */
function deutscherName(en) {
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
  return null;
}

// ---------- Typ, Region und Gruppe ----------
function typVon(ebene, en, materialien, sammlungen) {
  const n = en.toLowerCase();
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
    const mat = materialien[0] ?? '';
    if (/capsule/i.test(mat) || /capsule/.test(n)) return 'kapsel';
    if (/cartilage/i.test(mat)) return 'knorpel';
    if (/membrane/.test(n)) return 'membran';
    return 'band';
  }
  if (ebene === 'haut') return /nail|perionyx/.test(n) ? 'nagel' : 'hautregion';
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

function regionKoerper(sammlungen) {
  const s = sammlungen.join('|');
  if (/hand|Joints of hand|carp|Metacarpo|Interphalangeal joints of hand/i.test(s) && /upper limb/i.test(s)) return 'Hand';
  if (/foot|Subtalar|tars|Metatarso/i.test(s) && /lower limb/i.test(s)) return 'Fuß';
  if (/upper limb/i.test(s)) return 'Arm und Schulter';
  if (/lower limb/i.test(s)) return 'Bein und Hüfte';
  if (/Head|face|epicranium|Auricular/i.test(s)) return 'Kopf';
  if (/Neck/i.test(s)) return 'Hals';
  return 'Rumpf';
}

const GELENKE_DE = {
  'Knee joint': 'Kniegelenk', 'Hip joint': 'Hüftgelenk', 'Glenohumeral joint': 'Schultergelenk', 'Elbow joint': 'Ellenbogengelenk',
  'Sternoclavicular joint': 'Sternoklavikulargelenk', 'Acromioclavicular joint': 'Akromioklavikulargelenk',
  'Subtalar joint': 'Unteres Sprunggelenk', 'Ankle joint': 'Oberes Sprunggelenk', 'Radiocarpal joint': 'Proximales Handgelenk',
  'Temporomandibular joint': 'Kiefergelenk', 'Sacro-iliac joint': 'Iliosakralgelenk', 'Distal radio-ulnar joint': 'Distales Radioulnargelenk',
  'Intervertebral disc': 'Bandscheiben', 'Joints of hand': 'Gelenke der Hand', 'Metacarpophalangeal joints': 'Fingergrundgelenke',
  'Interphalangeal joints of hand': 'Fingergelenke', 'Interphalangeal joints of foot': 'Zehengelenke', 'Metatarsophalangeal joints': 'Zehengrundgelenke',
  'Intermetatarsal joints': 'Intermetatarsalgelenke', 'Intermetacarpal joints': 'Intermetakarpalgelenke',
  'Fibrous joints of vertebral column': 'Bandverbindungen der Wirbelsäule', 'Cranial syndesmosis': 'Bandhaften des Schädels',
};
function gruppeVon(ebene, sammlungen) {
  if (ebene !== 'baender_gelenke') return null;
  const g = sammlungen.find((s) => /joint|disc/i.test(s) && s !== '3: Joints');
  return g ? (GELENKE_DE[g] ?? g) : null;
}

const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- Strukturen sammeln ----------
const strukturen = new Map();
const meshIndex = {};
const fehlendLatein = [];
for (const ebene of EBENEN) {
  const { meshes } = JSON.parse(fs.readFileSync(zw(`${ebene}.meshes.json`), 'utf8'));
  for (const m of meshes) {
    if (meshIndex[m.name]) throw new Error(`Meshname doppelt: ${m.name}`);
    const seite = /\.l$/.test(m.name) ? 'l' : /\.r$/.test(m.name) ? 'r' : null;
    const en = m.name.replace(/\.[lr]$/, '');
    let id = slug(en);
    if (strukturen.has(id) && strukturen.get(id).ebene !== ebene) id = `${ebene}-${id}`;
    if (!strukturen.has(id)) {
      const la = latein(en);
      if (!la) fehlendLatein.push(en);
      strukturen.set(id, {
        id, ebene, en, la, de: deutscherName(en),
        typ: typVon(ebene, en, m.materialien, m.sammlungen),
        region: ebene === 'knochen' ? regionKnochen(en, m.sammlungen) : regionKoerper(m.sammlungen),
        gruppe: gruppeVon(ebene, m.sammlungen),
        meshes: [],
      });
    }
    const s = strukturen.get(id);
    s.meshes.push({ name: m.name, seite, mitte: m.mitte });
    meshIndex[m.name] = id;
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
  if ([...basisnamen].some((b) => b.startsWith(name.toLowerCase()))) continue; // abgeschnittene Labels wie "Axis (C2"
  if (FALSCH_ZUGEORDNET[strukturId]?.includes(name)) continue;
  const liste = (markierungen[strukturId] ??= []);
  if (liste.some((x) => x.en === name)) continue;
  liste.push({
    id: slug(name), en: name, la: latein(name), de: namenDe.markierungen[name] ?? null,
    seite: /\.l$/.test(p.knochen) ? 'l' : /\.r$/.test(p.knochen) ? 'r' : null, pos: p.pos,
  });
  anzahlMarkierungen++;
}

// ---------- Schreiben ----------
const ziel = path.join(WURZEL, 'public/inhalte/generiert');
fs.mkdirSync(ziel, { recursive: true });
const ausgabe = {
  _hinweis: 'AUTOMATISCH ERZEUGT von werkzeuge/daten_bauen.mjs – nicht von Hand bearbeiten. Texte gehören nach public/inhalte/texte/.',
  strukturen: [...strukturen.values()],
  meshIndex,
  markierungen,
};
fs.writeFileSync(path.join(ziel, 'strukturen.json'), JSON.stringify(ausgabe));

const ohneDe = [...strukturen.values()].filter((s) => !s.de);
console.log(`Strukturen: ${strukturen.size} (Meshes: ${Object.keys(meshIndex).length})`);
for (const e of EBENEN) {
  const l = [...strukturen.values()].filter((s) => s.ebene === e);
  console.log(`  ${e}: ${l.length}, mit deutschem Namen: ${l.filter((s) => s.de).length}, mit Latein: ${l.filter((s) => s.la).length}`);
}
console.log(`Markierungen: ${anzahlMarkierungen} an ${Object.keys(markierungen).length} Strukturen`);
console.log(`Ohne lateinischen Namen: ${fehlendLatein.join(', ') || '–'}`);
const ungenutzt = Object.keys(namenDe.strukturen).filter((en) => !basisnamen.has(en.toLowerCase()));
if (ungenutzt.length) console.log(`Hinweis: deutsche Namen ohne passendes 3D-Teil: ${ungenutzt.join(', ')}`);
fs.writeFileSync(path.join(WURZEL, 'werkzeuge/zwischenstand/ohne_deutschen_namen.txt'), ohneDe.map((s) => `${s.ebene}\t${s.en}`).join('\n'));
