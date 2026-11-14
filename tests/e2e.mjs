// Automatischer Browsertest (Chromium mit iPad-Bildschirmgröße und Touch).
// Aufruf: npm run build && npm test
// Ergebnisse: Konsole + Bildschirmfotos in tests/bilder/.
//
// Hinweis: Hier läuft Chromium mit Software-WebGL. Safari auf dem echten iPad
// kann sich anders verhalten – der letzte Test muss auf dem Gerät passieren.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 4173;
const URL = `http://localhost:${PORT}/`;
fs.mkdirSync('tests/bilder', { recursive: true });

const server = spawn('node_modules/.bin/vite', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((ok, nein) => {
  server.stdout.on('data', (d) => String(d).includes('Local') && ok());
  server.stderr.on('data', (d) => console.error(String(d)));
  server.on('exit', (code) => nein(new Error(`Vorschau-Server beendet (Code ${code}) – läuft schon einer auf Port ${PORT}?`)));
});

const ergebnisse = [];
const pruefe = (name, bedingung, info = '') => {
  ergebnisse.push({ name, ok: !!bedingung, info });
  console.log(`${bedingung ? '✔' : '✘'} ${name}${info ? ' – ' + info : ''}`);
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// iPad Air 11" (M2) im Querformat: 1180 × 820 CSS-Pixel
const kontext = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const seite = await kontext.newPage();
const fehler = [];
seite.on('pageerror', (e) => fehler.push(e.message));
seite.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));

const warteBereit = () => seite.waitForFunction(() => window.__anatomie?.bereit === true, null, { timeout: 90000 });
const tippe = async (x, y) => { await seite.touchscreen.tap(x, y); await seite.waitForTimeout(400); };

try {
  const t0 = Date.now();
  await seite.goto(URL);
  await warteBereit();
  pruefe('App lädt und Skelett erscheint', true, `${((Date.now() - t0) / 1000).toFixed(1)} s (Software-WebGL)`);
  pruefe('Starthinweis (keine medizinische Beratung) wird angezeigt', await seite.locator('dialog[open]').getByText('ersetzt keine medizinische Beratung').count());
  await seite.getByRole('button', { name: 'Verstanden' }).click();
  await seite.waitForTimeout(800);
  await seite.screenshot({ path: 'tests/bilder/01-start.png' });

  const info = await seite.evaluate(() => {
    const { modell, szene } = window.__anatomie;
    const r = szene.renderer.info.render;
    return { teile: modell.teile.size, dreiecke: r.triangles, drawCalls: r.calls };
  });
  pruefe('Alle Knochen als einzelne Teile geladen', info.teile === 277, `${info.teile} Teile, ${info.dreiecke} Dreiecke, ${info.drawCalls} Draw Calls`);

  // --- Femur antippen ---
  let p = await seite.evaluate(() => window.__anatomie.bildschirmPunkt('Femur.r'));
  await tippe(p.x, p.y);
  let titel = await seite.locator('#panel-info h2').textContent().catch(() => null);
  pruefe('Antippen des rechten Femurs öffnet Info-Panel', titel === 'Oberschenkelknochen (rechts)', `Titel: ${titel}`);
  pruefe('Lateinischer Name wird angezeigt', await seite.locator('#panel-info .la').first().textContent() === 'Os femoris');
  pruefe('Beschriftung am Modell sichtbar', await seite.locator('.beschriftung .kasten').first().isVisible());
  await seite.screenshot({ path: 'tests/bilder/02-femur-ausgewaehlt.png' });

  // --- Detailstufe und Markierungen ---
  await seite.getByRole('button', { name: 'Details' }).click();
  const anzahlMarkierungen = await seite.locator('.markierungsliste li').count();
  pruefe('Detailstufe zeigt Markierungen am Modell', anzahlMarkierungen >= 20, `${anzahlMarkierungen} Markierungen`);
  await seite.locator('.markierungsliste button', { hasText: 'Großer Rollhügel' }).click();
  pruefe('Markierung „Großer Rollhügel“ wird beschriftet', await seite.locator('.beschriftung.markierung .kasten').textContent().then((t) => t.includes('Großer Rollhügel')));
  await seite.evaluate(() => { const { szene, modell } = window.__anatomie; szene.fokussiere(modell.box('Femur.r')); });
  await seite.waitForTimeout(900);
  await seite.screenshot({ path: 'tests/bilder/03-markierungen.png' });
  pruefe('Felder „noch zu prüfen“ werden markiert', await seite.locator('#panel-info .offen').count() > 0);
  await seite.getByRole('button', { name: 'Feinbau' }).click();
  pruefe('Feinbau-Schema (Röhrenknochen) wird angezeigt', await seite.locator('#panel-info img.schema').count() === 1);
  await seite.screenshot({ path: 'tests/bilder/04-feinbau.png' });

  // --- Isolieren / Transparent / Ausblenden ---
  await seite.getByRole('button', { name: 'Isolieren' }).click();
  let sichtbar = await seite.evaluate(() => [...window.__anatomie.modell.teile.values()].filter((t) => t.objekt.visible).length);
  pruefe('Isolieren zeigt nur noch eine Struktur', sichtbar === 1, `${sichtbar} sichtbar`);
  await seite.getByRole('button', { name: 'Alle zeigen' }).click();
  await seite.getByRole('button', { name: 'Transparent' }).click();
  const deckkraft = await seite.evaluate(() => window.__anatomie.modell.teile.get('Femur.r').meshes[0].material.opacity);
  pruefe('Transparent schalten', deckkraft < 0.5, `Deckkraft ${deckkraft}`);
  await seite.getByRole('button', { name: 'Ausblenden' }).click();
  sichtbar = await seite.evaluate(() => window.__anatomie.modell.teile.get('Femur.r').objekt.visible);
  pruefe('Ausblenden versteckt die Struktur und schließt das Panel', !sichtbar && await seite.locator('#panel-info').isHidden());

  // --- Ebenen-Panel ---
  await seite.locator('#knopf-panel-links').click();
  pruefe('Ebenen-Panel listet alle 9 Ebenen, alle verfügbar', await seite.locator('.ebene').count() === 9 && await seite.locator('.ebene.nicht-verfuegbar').count() === 0);
  await seite.getByRole('button', { name: 'Alle wieder einblenden' }).click();
  await seite.locator('[data-ebene="haut"] .schalter input').check({ force: true });
  await seite.waitForFunction(() => window.__anatomie.modell.ebenen.get('haut').geladen, null, { timeout: 60000 });
  await seite.waitForTimeout(600);
  await seite.screenshot({ path: 'tests/bilder/05-haut-transparent.png' });
  pruefe('Haut-Ebene lädt nach und ist halbtransparent', await seite.evaluate(() => window.__anatomie.modell.ebenen.get('haut').deckkraft) < 1);
  // Durch die halbtransparente Haut hindurch einen Knochen antippen
  await seite.locator('#knopf-panel-links').click();
  p = await seite.evaluate(() => { window.__anatomie.szene.ansicht('zuruecksetzen'); return null; });
  await seite.waitForTimeout(900);
  p = await seite.evaluate(() => window.__anatomie.bildschirmPunkt('Body of sternum'));
  await tippe(p.x, p.y);
  titel = await seite.locator('#panel-info h2').textContent().catch(() => null);
  pruefe('Knochen ist durch transparente Haut antippbar', titel === 'Brustbeinkörper', `Titel: ${titel}`);
  await seite.locator('#knopf-panel-links').click();
  await seite.locator('[data-ebene="baender_gelenke"] .schalter input').check({ force: true });
  await seite.waitForFunction(() => window.__anatomie.modell.ebenen.get('baender_gelenke').geladen, null, { timeout: 60000 });
  pruefe('Bänder-Ebene lädt', true);
  await seite.locator('[data-ebene="haut"] .schalter input').uncheck({ force: true });
  await seite.locator('#knopf-panel-links').click();

  // --- Suche ---
  await seite.locator('#suchfeld').fill('os coxae');
  await seite.waitForTimeout(200);
  const erster = await seite.locator('#suchergebnisse li').first().textContent();
  pruefe('Suche per Latein („os coxae“) findet das Hüftbein', erster?.includes('Hüftbein'), erster ?? '');
  await seite.locator('#suchfeld').fill('kreuzb');
  await seite.waitForTimeout(200);
  pruefe('Suche mit Wortanfang („kreuzb“) findet Kreuzbein/Kreuzband', (await seite.locator('#suchergebnisse li').allTextContents()).some((t) => t.includes('Kreuzbein')));
  await seite.locator('#suchfeld').fill('Trochanter major');
  await seite.waitForTimeout(200);
  await seite.locator('#suchergebnisse li button').first().click();
  await seite.waitForTimeout(1000);
  titel = await seite.locator('#panel-info h2').textContent().catch(() => null);
  pruefe('Suche nach Markierung springt zum Knochen', titel?.startsWith('Oberschenkelknochen'), `Titel: ${titel}`);
  await seite.screenshot({ path: 'tests/bilder/06-suche-markierung.png' });

  // --- Baum ---
  await seite.locator('#knopf-panel-links').click();
  await seite.getByRole('tab', { name: 'Strukturen' }).click();
  await seite.locator('#reiter-baum > details > summary', { hasText: 'Knochen' }).click();
  await seite.locator('#reiter-baum details[open] summary', { hasText: 'Hand' }).first().click();
  await seite.waitForSelector('#reiter-baum .baum-eintrag', { timeout: 5000 }).catch(() => {});
  pruefe('Baumansicht listet Strukturen nach Region', await seite.locator('#reiter-baum .baum-eintrag').count() > 10);
  await seite.screenshot({ path: 'tests/bilder/07-baum.png' });
  await seite.locator('#knopf-panel-links').click();

  // --- Standardansichten ---
  await tippe(60, 400); // ins Leere tippen -> Auswahl aufheben
  pruefe('Tippen ins Leere hebt Auswahl auf', await seite.locator('#panel-info').isHidden());
  await seite.getByRole('button', { name: 'hinten' }).click();
  await seite.waitForTimeout(900);
  const kz = await seite.evaluate(() => window.__anatomie.szene.kamera.position.z);
  pruefe('Ansicht „hinten“ dreht die Kamera hinter das Modell', kz < 0, `z = ${kz.toFixed(2)}`);
  await seite.screenshot({ path: 'tests/bilder/08-hinten.png' });
  await seite.getByRole('button', { name: 'Ansicht zurücksetzen' }).click();
  await seite.waitForTimeout(900);

  // --- Alle Ebenen laden ---
  await seite.evaluate(async () => {
    const m = window.__anatomie.modell;
    for (const id of m.ebenen.keys()) await m.setzeEbeneSichtbar(id, true);
  });
  await seite.waitForTimeout(1500);
  const alle = await seite.evaluate(() => {
    const { modell, szene } = window.__anatomie;
    const r = szene.renderer.info.render;
    return { geladen: [...modell.ebenen.values()].filter((e) => e.geladen).length, teile: modell.teile.size, dreiecke: r.triangles, calls: r.calls };
  });
  pruefe('Alle 9 Ebenen laden', alle.geladen === 9, `${alle.teile} Teile, ${alle.dreiecke} Dreiecke, ${alle.calls} Draw Calls (alles gleichzeitig sichtbar)`);
  await seite.screenshot({ path: 'tests/bilder/11-alle-ebenen.png' });
  await seite.evaluate(async () => {
    const m = window.__anatomie.modell;
    for (const id of m.ebenen.keys()) await m.setzeEbeneSichtbar(id, ['knochen', 'muskeln_oberflaechlich'].includes(id));
  });

  // --- Muskel mit Ursprung/Ansatz ---
  await seite.locator('#suchfeld').fill('gluteus medius');
  await seite.waitForTimeout(300);
  await seite.locator('#suchergebnisse li button').first().click();
  await seite.waitForTimeout(1000);
  titel = await seite.locator('#panel-info h2').textContent().catch(() => null);
  pruefe('Muskel über Suche: M. gluteus medius', titel?.startsWith('M. gluteus medius'), `Titel: ${titel}`);
  pruefe('Muskel-Panel zeigt Ursprung und Ansatz', (await seite.locator('#panel-info .feld h3').allTextContents()).filter((t) => /Ursprung|Ansatz/i.test(t)).length >= 2);
  await seite.getByRole('button', { name: 'Details' }).click();
  pruefe('Muskel-Details: Innervation mit Segment', await seite.locator('#panel-info').getByText('N. gluteus superior (L4–S1)').count() > 0);
  await seite.getByRole('button', { name: 'Ursprung/Ansatz zeigen' }).click();
  await seite.waitForTimeout(1500);
  const flaechen = await seite.evaluate(() => {
    const g = window.__anatomie.szene.szene.children.find((c) => c.children?.some((k) => /\.[oe]\d*[lr]?$/.test(k.name)));
    return g ? g.children.filter((k) => k.visible).length : 0;
  });
  pruefe('Ursprungs-/Ansatzflächen werden am Knochen gezeigt', flaechen >= 2, `${flaechen} Flächen`);
  await seite.screenshot({ path: 'tests/bilder/12-muskel-ursprung-ansatz.png' });

  // --- Gelenk ---
  await seite.locator('#suchfeld').fill('Kniegelenk');
  await seite.waitForTimeout(300);
  await seite.locator('#suchergebnisse li button').first().click();
  await seite.waitForTimeout(1500);
  pruefe('Gelenk über Suche: Kniegelenk mit Neutral-Null-Tabelle', await seite.locator('#panel-info details.gelenk[open] .tabelle').count() > 0);
  await seite.screenshot({ path: 'tests/bilder/13-kniegelenk.png' });

  // --- Faszie ---
  await seite.locator('#suchfeld').fill('Tractus iliotibialis');
  await seite.waitForTimeout(300);
  await seite.locator('#suchergebnisse li button').first().click();
  await seite.waitForTimeout(1200);
  titel = await seite.locator('#panel-info h2').textContent().catch(() => null);
  pruefe('Faszie über Suche: Tractus iliotibialis', /Tractus iliotibialis/.test(titel ?? ''), `Titel: ${titel}`);
  await seite.getByRole('button', { name: 'Feinbau' }).click();
  pruefe('Faszien-Feinbau mit Hinweis zur Evidenz von Faszienketten', await seite.locator('#panel-info').getByText('unterschiedlicher Evidenz').count() > 0);
  await seite.screenshot({ path: 'tests/bilder/14-faszie.png' });

  // --- Merkliste ---
  await seite.locator('#panel-info .merken').click();
  pruefe('Struktur auf die Merkliste setzen', await seite.evaluate(() => window.__anatomie.speicher.daten.merkliste.length) === 1);

  // --- Lernmodus: Quiz ---
  await seite.locator('#panel-info .schliessen').click();
  await seite.locator('#knopf-lernen').click();
  pruefe('Lernmodus öffnet sich', await seite.getByRole('button', { name: /Quiz starten/ }).isVisible());
  await seite.locator('#reiter-lernen select').nth(1).selectOption('zeigen');
  await seite.getByRole('button', { name: /Quiz starten/ }).click();
  await seite.waitForTimeout(1500);
  const frage = await seite.locator('.quiz-frage').textContent();
  pruefe('Quiz stellt Frage „Tippe im Modell auf …“', frage?.startsWith('Tippe im Modell auf'), frage ?? '');
  // richtige Antwort über die Programmlogik (Antippen der gesuchten Struktur)
  const ok = await seite.evaluate(() => {
    const { lernmodus, modell } = window.__anatomie;
    const f = lernmodus.quiz.fragen[lernmodus.quiz.index];
    return lernmodus.beiTipp(modell.teile.get(f.meshName));
  });
  await seite.waitForTimeout(500);
  pruefe('Antippen der gesuchten Struktur wird als richtig gewertet', ok && await seite.locator('.rueckmeldung.gut').count() === 1);
  await seite.screenshot({ path: 'tests/bilder/15-quiz-zeigen.png' });
  await seite.getByRole('button', { name: 'Weiter' }).click();
  await seite.waitForTimeout(1200);
  // echter Fingertipp auf eine falsche Stelle (ins Leere wird ignoriert, deshalb auf eine andere Struktur)
  const andere = await seite.evaluate(() => {
    const { lernmodus, modell } = window.__anatomie;
    const f = lernmodus.quiz.fragen[lernmodus.quiz.index];
    window.__anatomie.szene.ansicht('zuruecksetzen');
    return f.struktur.id === 'femur' ? 'Tibia.l' : 'Femur.l';
  });
  await seite.waitForTimeout(900);
  p = await seite.evaluate((n) => window.__anatomie.bildschirmPunkt(n), andere);
  await tippe(p.x, p.y);
  pruefe('Falscher Tipp im Quiz wird erkannt', await seite.locator('.rueckmeldung').count() === 1);
  await seite.getByRole('button', { name: 'Quiz beenden' }).click();

  // Benennen / Wissen
  await seite.locator('#reiter-lernen select').nth(1).selectOption('wissen');
  await seite.getByRole('button', { name: /Quiz starten/ }).click();
  await seite.waitForTimeout(800);
  const wfrage = await seite.locator('.quiz-frage').textContent();
  await seite.locator('.antwort').first().click();
  pruefe('Wissensfrage mit 4 Antworten und Rückmeldung', await seite.locator('.antwort').count() === 4 && await seite.locator('.rueckmeldung').count() === 1, wfrage ?? '');
  await seite.screenshot({ path: 'tests/bilder/16-quiz-wissen.png' });
  await seite.getByRole('button', { name: 'Quiz beenden' }).click();
  await seite.locator('#reiter-lernen select').nth(1).selectOption('benennen');
  await seite.getByRole('button', { name: /Quiz starten/ }).click();
  await seite.waitForTimeout(1200);
  pruefe('Benennen-Frage hebt Struktur hervor ohne Namen zu zeigen', await seite.locator('.antwort').count() === 4 && await seite.locator('#panel-info').isHidden());
  await seite.getByRole('button', { name: 'Quiz beenden' }).click();

  // --- Lernkarten ---
  await seite.getByRole('button', { name: '+10 neue aus dem Lernpfad' }).click();
  await seite.getByRole('button', { name: 'Karten üben', exact: true }).click();
  await seite.getByRole('button', { name: 'Aufdecken' }).click();
  pruefe('Lernkarte aufdecken zeigt Inhalt', await seite.locator('.karte-rueckseite').count() === 1);
  await seite.screenshot({ path: 'tests/bilder/17-lernkarte.png' });
  await seite.getByRole('button', { name: 'Gut' }).click();
  const karte = await seite.evaluate(() => Object.values(window.__anatomie.speicher.daten.karten).filter((k) => k.stufe >= 1).length);
  pruefe('Bewertung „Gut“ verschiebt die Karte (Wiederholungsabstand)', karte >= 1);
  await seite.getByRole('button', { name: 'Beenden' }).click();

  // --- Lernpfad ---
  await seite.getByRole('button', { name: '1. Jahr' }).click();
  await seite.getByRole('tab', { name: 'Strukturen' }).click();
  const imBaum = await seite.locator('#reiter-baum > details > summary').allTextContents();
  pruefe('Lernpfad 1. Jahr blendet Organe im Baum aus', !imBaum.some((t) => t.startsWith('Organe')), imBaum.join(' | '));
  await seite.getByRole('tab', { name: 'Lernen' }).click();
  await seite.getByRole('button', { name: 'Alles' }).click();
  await seite.locator('#knopf-panel-links').click();

  // --- Dunkelmodus ---
  await seite.locator('#knopf-thema').click();
  await seite.waitForTimeout(300);
  await seite.screenshot({ path: 'tests/bilder/09-dunkel.png' });
  pruefe('Dunkelmodus schaltet um', await seite.evaluate(() => document.documentElement.dataset.theme) === 'dark');

  // --- Offline ---
  await seite.evaluate(() => navigator.serviceWorker.ready);
  await seite.waitForTimeout(3000); // Precache abwarten
  await kontext.setOffline(true);
  await seite.reload();
  await warteBereit();
  pruefe('App startet offline (Service Worker)', true);
  pruefe('Merkliste und Lernkarten bleiben nach Neustart erhalten', await seite.evaluate(() => window.__anatomie.speicher.daten.merkliste.length === 1 && Object.keys(window.__anatomie.speicher.daten.karten).length >= 10));
  await kontext.setOffline(false);

  // --- Hochformat ---
  await seite.setViewportSize({ width: 820, height: 1180 });
  await seite.waitForTimeout(600);
  await seite.screenshot({ path: 'tests/bilder/10-hochformat.png' });
  pruefe('Hochformat: Leinwand füllt den Bildschirm', await seite.evaluate(() => document.querySelector('#leinwand').clientHeight) === 1180);
} catch (e) {
  pruefe('Testlauf ohne Abbruch', false, e.message.split('\n')[0]);
  await seite.screenshot({ path: 'tests/bilder/fehler.png' }).catch(() => {});
}

pruefe('Keine JavaScript-Fehler', fehler.length === 0, fehler.slice(0, 3).join(' | '));
await browser.close();
server.kill();
const fehlgeschlagen = ergebnisse.filter((e) => !e.ok);
console.log(`\n${ergebnisse.length - fehlgeschlagen.length}/${ergebnisse.length} Prüfungen bestanden.`);
process.exit(fehlgeschlagen.length ? 1 : 0);
