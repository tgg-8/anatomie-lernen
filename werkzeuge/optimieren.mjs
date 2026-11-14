// Verkleinert und komprimiert die von blender_export.py erzeugten GLB-Dateien
// für das iPad (Meshopt-Kompression + Vereinfachung).
//
// Aufruf: node werkzeuge/optimieren.mjs <export-ordner> <ziel-ordner>
//
// Wichtig: Meshes werden NICHT zusammengefügt (kein join/flatten), damit jede
// Struktur ein eigenes, antippbares Objekt mit ihrem Originalnamen bleibt.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, quantize, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';

// Wie stark jede Ebene vereinfacht wird (ratio = Anteil der Dreiecke, die bleiben sollen;
// error = maximal erlaubte Formabweichung relativ zur Meshgröße).
const EINSTELLUNGEN = {
  knochen: { ratio: 0.5, error: 0.0008 },
  baender_gelenke: { ratio: 0.5, error: 0.001 },
  haut: { ratio: 0.8, error: 0.001 },
  standard: { ratio: 0.5, error: 0.001 },
};

const [quelle, ziel] = process.argv.slice(2);
fs.mkdirSync(ziel, { recursive: true });
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

for (const datei of fs.readdirSync(quelle).filter((d) => d.endsWith('.roh.glb'))) {
  const ebene = datei.replace('.roh.glb', '');
  const e = EINSTELLUNGEN[ebene] ?? EINSTELLUNGEN.standard;
  const doc = await io.read(path.join(quelle, datei));
  const zaehle = () =>
    doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())
      .reduce((s, p) => s + (p.getIndices()?.getCount() ?? 0) / 3, 0);
  const vorher = zaehle();
  await doc.transform(
    dedup(),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: e.ratio, error: e.error }),
    prune(),
    quantize(),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  const nachher = zaehle();
  const aus = path.join(ziel, `${ebene}.glb`);
  await io.write(aus, doc);
  const kb = (fs.statSync(aus).size / 1024).toFixed(0);
  console.log(`${ebene}: ${Math.round(vorher)} -> ${Math.round(nachher)} Dreiecke, ${kb} KB`);
}
