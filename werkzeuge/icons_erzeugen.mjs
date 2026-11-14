// Erzeugt PNG-Icons aus public/icons/icon.svg (mit dem Chromium von Playwright).
// Aufruf: node werkzeuge/icons_erzeugen.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
const svg = fs.readFileSync('public/icons/icon.svg', 'utf8');
const browser = await chromium.launch();
for (const [name, groesse, rand] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['apple-touch-icon.png', 180, 0]]) {
  const seite = await browser.newPage({ viewport: { width: groesse, height: groesse } });
  await seite.setContent(`<style>html,body{margin:0}</style><div style="width:${groesse}px;height:${groesse}px;padding:${rand}px">${svg.replace('<svg ', `<svg width="${groesse}" height="${groesse}" `)}</div>`);
  await seite.screenshot({ path: `public/icons/${name}`, omitBackground: true });
  await seite.close();
}
await browser.close();
console.log('Icons erzeugt.');
