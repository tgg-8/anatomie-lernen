// Einstiegspunkt: verbindet Daten, 3D-Ansicht und Oberfläche.
import './stil.css';
import * as THREE from 'three';
import { ladeDaten } from './daten/laden';
import { Suche } from './daten/suche';
import { Szene, type Ansicht } from './viewer/szene';
import { Modell, type Teil } from './viewer/modell';
import { Beschriftungen, Markierungspunkte } from './viewer/beschriftung';
import { zeichneInfo } from './ui/infopanel';
import { zeichneBaum, zeichneEbenen } from './ui/panels';
import { zeigeInfo, zeigeStarthinweis } from './ui/dialoge';
import { h } from './ui/dom';
import * as einstellungen from './einstellungen';
import { anzeigename, type Markierung, type Struktur } from './typen';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

async function start() {
  const app = $('#app');
  const leinwand = $<HTMLCanvasElement>('#leinwand');
  const panelLinks = $('#panel-links');
  const panelInfo = $('#panel-info');
  const ladeanzeige = $('#ladeanzeige');
  const dialog = $<HTMLDialogElement>('#dialog');

  // ---------- Thema (hell/dunkel) ----------
  const szene = new Szene(leinwand);
  const setzeThema = (thema: 'auto' | 'light' | 'dark') => {
    if (thema === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = thema;
    szene.hintergrundAusCss();
  };
  setzeThema(einstellungen.lies().thema ?? 'auto');
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => szene.hintergrundAusCss());
  $('#knopf-thema').addEventListener('click', () => {
    const dunkelJetzt = getComputedStyle(document.documentElement).colorScheme.includes('dark');
    const neu = dunkelJetzt ? 'light' : 'dark';
    einstellungen.speichere({ thema: neu });
    setzeThema(neu);
  });

  // ---------- Daten und Modell ----------
  const daten = await ladeDaten();
  const modell = new Modell(szene, daten);
  const beschriftungen = new Beschriftungen(szene, $('#beschriftungen'));
  const punkte = new Markierungspunkte(szene);
  const suche = new Suche(daten);

  let stufe: 1 | 2 | 3 = einstellungen.lies().detailstufe ?? 1;
  let aktiveMarkierung: string | null = null;

  // ---------- Auswahl ----------
  function infoZeichnen() {
    const t = modell.auswahl;
    if (!t) { panelInfo.hidden = true; aktualisierePanelKlasse(); return; }
    const s = daten.strukturen.get(t.strukturId)!;
    const seite = s.meshes.find((m) => m.name === t.meshName)?.seite ?? null;
    zeichneInfo(panelInfo, daten, {
      struktur: s, seite, stufe, istTransparent: t.zustand === 'transparent',
      istIsoliert: modell.isoliertesTeil(t.meshName), aktiveMarkierung,
    }, {
      schliessen: () => waehleTeil(null),
      ausblenden: () => { modell.setzeZustand(t.meshName, 'versteckt'); waehleTeil(null); },
      transparent: () => { modell.setzeZustand(t.meshName, t.zustand === 'transparent' ? 'normal' : 'transparent'); infoZeichnen(); },
      isolieren: () => {
        modell.isoliere(modell.isoliertesTeil(t.meshName) ? null : [t.meshName]);
        infoZeichnen();
      },
      fokus: () => { const b = modell.box(t.meshName); if (b) szene.fokussiere(b); },
      markierungWaehlen: (m) => zeigeMarkierung(m),
      stufeWechseln: (n) => {
        stufe = n;
        einstellungen.speichere({ detailstufe: n });
        aktualisiereMarkierungen();
        infoZeichnen();
      },
    });
    panelInfo.hidden = false;
    aktualisierePanelKlasse();
  }

  function aktualisiereMarkierungen() {
    const t = modell.auswahl;
    punkte.entferne();
    beschriftungen.entferne('markierung');
    if (!t || stufe < 2) return;
    const s = daten.strukturen.get(t.strukturId)!;
    const seite = s.meshes.find((m) => m.name === t.meshName)?.seite ?? null;
    punkte.zeige(daten.markierungen[s.id] ?? [], seite);
    const aktiv = daten.markierungen[s.id]?.find((m) => m.id === aktiveMarkierung);
    if (aktiv) zeigeMarkierung(aktiv, false);
  }

  /** Wählt ein 3D-Teil aus (oder hebt die Auswahl auf). */
  function waehleTeil(meshName: string | null, punkt?: THREE.Vector3) {
    aktiveMarkierung = null;
    modell.waehle(meshName);
    beschriftungen.entferne('auswahl');
    const t = modell.auswahl;
    if (t) {
      const s = daten.strukturen.get(t.strukturId)!;
      const ort = punkt ?? modell.box(t.meshName)!.getCenter(new THREE.Vector3());
      beschriftungen.zeige('auswahl', ort, anzeigename(s), s.la);
    }
    aktualisiereMarkierungen();
    infoZeichnen();
  }

  function zeigeMarkierung(m: Markierung, panelNeuZeichnen = true) {
    aktiveMarkierung = m.id;
    punkte.hebeHervor(m.id);
    const pos = punkte.position(m.id);
    if (pos) beschriftungen.zeige('markierung', pos, m.de ?? m.la ?? m.en, m.de ? m.la : null, 'markierung');
    if (panelNeuZeichnen) infoZeichnen();
  }

  /** Wählt eine Struktur aus der Suche oder dem Baum; macht ihre Ebene sichtbar und zoomt hin. */
  async function waehleStruktur(s: Struktur, meshName?: string, markierungId?: string) {
    await modell.setzeEbeneSichtbar(s.ebene, true);
    zeichneEbenen($('#reiter-ebenen'), modell, alleEinblenden);
    const name = meshName ?? (s.meshes.find((m) => m.seite === 'r') ?? s.meshes[0]).name;
    const teil: Teil | undefined = modell.teile.get(name);
    if (teil && teil.zustand === 'versteckt') modell.setzeZustand(name, 'normal');
    if (modell.istIsoliert && !modell.isoliertesTeil(name)) modell.isoliere(null);
    waehleTeil(name);
    const box = modell.box(name);
    if (box) szene.fokussiere(box);
    if (markierungId) {
      if (stufe < 2) { stufe = 2; aktualisiereMarkierungen(); }
      const m = daten.markierungen[s.id]?.find((x) => x.id === markierungId);
      if (m) zeigeMarkierung(m);
    }
  }

  function alleEinblenden() {
    modell.alleEinblenden();
    infoZeichnen();
  }

  // ---------- Antippen auf der Leinwand ----------
  // Ein "Tipp" ist eine kurze Berührung ohne Bewegung; Ziehen dreht das Modell.
  let start: { x: number; y: number; t: number; finger: number } | null = null;
  let aktiveFinger = 0;
  leinwand.addEventListener('pointerdown', (e) => {
    aktiveFinger++;
    start = { x: e.clientX, y: e.clientY, t: performance.now(), finger: aktiveFinger };
  });
  const fingerWeg = (e: PointerEvent) => {
    aktiveFinger = Math.max(0, aktiveFinger - 1);
    if (!start || start.finger > 1 || e.type === 'pointercancel') { if (aktiveFinger === 0) start = null; return; }
    const bewegt = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    const dauer = performance.now() - start.t;
    start = null;
    if (bewegt > 10 || dauer > 500) return;
    const rect = leinwand.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Zuerst Markierungspunkte prüfen (klein, haben Vorrang), dann 3D-Teile.
    const m = punkte.treffer(x, y);
    if (m) { zeigeMarkierung(m); return; }
    const treffer = modell.treffer(x, y);
    waehleTeil(treffer ? treffer.teil.meshName : null, treffer?.punkt);
  };
  leinwand.addEventListener('pointerup', fingerWeg);
  leinwand.addEventListener('pointercancel', fingerWeg);
  // Safari: eigene Pinch-Geste der Seite unterdrücken (sonst zoomt die ganze Seite)
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  // ---------- Kopfleiste, Panels ----------
  function aktualisierePanelKlasse() {
    app.classList.toggle('panel-offen', !panelLinks.hidden || !panelInfo.hidden);
    // Bildmitte so verschieben, dass das Modell im freien Bereich neben/über den Panels liegt.
    let x = 0, y = 0;
    for (const [panel, richtung] of [[panelInfo, 1], [panelLinks, -1]] as const) {
      if (panel.hidden) continue;
      const r = panel.getBoundingClientRect();
      const unten = r.top > window.innerHeight * 0.3; // Hochformat: Panel als Schublade unten
      if (unten) y = Math.max(y, r.height);
      else x += richtung * (r.width + 10);
    }
    szene.setzeVersatz(x, y);
  }
  $('#knopf-panel-links').addEventListener('click', () => {
    panelLinks.hidden = !panelLinks.hidden;
    if (!panelLinks.hidden) zeichneEbenen($('#reiter-ebenen'), modell, alleEinblenden);
    aktualisierePanelKlasse();
  });
  for (const knopf of document.querySelectorAll<HTMLButtonElement>('.reiter-knopf')) {
    knopf.addEventListener('click', () => {
      for (const k of document.querySelectorAll('.reiter-knopf')) k.classList.toggle('aktiv', k === knopf);
      $('#reiter-ebenen').hidden = knopf.dataset.reiter !== 'ebenen';
      $('#reiter-baum').hidden = knopf.dataset.reiter !== 'baum';
    });
  }
  for (const knopf of document.querySelectorAll<HTMLButtonElement>('[data-ansicht]')) {
    knopf.addEventListener('click', () => szene.ansicht(knopf.dataset.ansicht as Ansicht));
  }
  $('#knopf-info').addEventListener('click', () => zeigeInfo(dialog, daten));

  modell.beiAenderung.push(() => {
    // Ebenen-Panel nur neu zeichnen, wenn es sichtbar ist und der Nutzer gerade keinen Regler zieht.
    if (!panelLinks.hidden && !(document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'range')) {
      zeichneEbenen($('#reiter-ebenen'), modell, alleEinblenden);
    }
  });
  zeichneEbenen($('#reiter-ebenen'), modell, alleEinblenden);
  zeichneBaum($('#reiter-baum'), daten, (s, meshName) => waehleStruktur(s, meshName));

  // ---------- Suche ----------
  const suchfeld = $<HTMLInputElement>('#suchfeld');
  const ergebnisse = $<HTMLUListElement>('#suchergebnisse');
  suchfeld.addEventListener('input', () => {
    const treffer = suche.suche(suchfeld.value);
    ergebnisse.replaceChildren(...treffer.map((t) => h('li', {},
      h('button', {
        onclick: () => {
          ergebnisse.hidden = true;
          suchfeld.blur();
          const s = daten.strukturen.get(t.strukturId);
          if (s) waehleStruktur(s, undefined, t.markierungId);
        },
      }, h('div', {}, t.titel), h('div', { class: 'klein-leise' }, t.untertitel)))));
    if (!treffer.length && suchfeld.value.trim().length >= 2) {
      ergebnisse.replaceChildren(h('li', { class: 'klein-leise' }, 'Nichts gefunden.'));
    }
    ergebnisse.hidden = suchfeld.value.trim().length < 2;
  });
  suchfeld.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') (ergebnisse.querySelector('button') as HTMLButtonElement | null)?.click();
    if (e.key === 'Escape') { suchfeld.value = ''; ergebnisse.hidden = true; }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!(e.target as HTMLElement).closest('.suche')) ergebnisse.hidden = true;
  });

  // ---------- Laden ----------
  await modell.ladeStartEbenen();
  ladeanzeige.hidden = true;
  if (!einstellungen.lies().hinweisGelesen) {
    zeigeStarthinweis(dialog, () => einstellungen.speichere({ hinweisGelesen: true }));
  }

  // Schnittstelle für automatische Tests (tests/e2e.mjs)
  (window as unknown as Record<string, unknown>).__anatomie = {
    bereit: true,
    modell, szene, daten,
    bildschirmPunkt(meshName: string) {
      const b = modell.box(meshName);
      if (!b) return null;
      const p = szene.aufBildschirm(b.getCenter(new THREE.Vector3()));
      const r = leinwand.getBoundingClientRect();
      return { x: p.x + r.left, y: p.y + r.top };
    },
  };
}

start().catch((fehler) => {
  console.error(fehler);
  const l = document.querySelector('#ladeanzeige');
  if (l) l.textContent = `Fehler beim Laden: ${fehler instanceof Error ? fehler.message : fehler}`;
});
