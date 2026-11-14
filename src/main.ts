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
import { anzeigename, type Gelenk, type Markierung, type Struktur } from './typen';
import { Speicher } from './lernen/speicher';
import { Lernmodus } from './lernen/lernmodus';

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
  const speicher = new Speicher();
  await speicher.laden();

  let stufe: 1 | 2 | 3 = einstellungen.lies().detailstufe ?? 1;
  let aktiveMarkierung: string | null = null;
  let ansaetzeSichtbar = false;
  let offenesGelenk: string | null = null;

  /** Zeigt bzw. versteckt Ursprungs-/Ansatzflächen des gewählten Muskels (und blendet dafür die Knochen ein). */
  async function setzeAnsaetze(an: boolean) {
    ansaetzeSichtbar = an;
    const t = modell.auswahl;
    const flaechen = an && t ? (daten.ansaetze[t.strukturId] ?? []).filter((f) => {
      const seite = daten.strukturen.get(t.strukturId)?.meshes.find((m) => m.name === t.meshName)?.seite;
      return !f.seite || !seite || f.seite === seite;
    }) : null;
    if (an) await modell.setzeEbeneSichtbar('knochen', true);
    await modell.zeigeAnsaetze(flaechen);
  }

  // ---------- Auswahl ----------
  function infoZeichnen() {
    const t = modell.auswahl;
    if (!t) { panelInfo.hidden = true; aktualisierePanelKlasse(); return; }
    const s = daten.strukturen.get(t.strukturId)!;
    const seite = s.meshes.find((m) => m.name === t.meshName)?.seite ?? null;
    zeichneInfo(panelInfo, daten, {
      struktur: s, seite, stufe, istTransparent: t.zustand === 'transparent',
      istIsoliert: modell.isoliertesTeil(t.meshName), aktiveMarkierung,
      istGemerkt: speicher.istGemerkt(s.id), ansaetzeSichtbar, offenesGelenk,
    }, {
      merken: () => { speicher.merkenUmschalten(s.id); infoZeichnen(); lernmodus.zeichnen(); },
      ansaetzeUmschalten: async () => { await setzeAnsaetze(!ansaetzeSichtbar); infoZeichnen(); },
      gelenkZeigen: (g) => zeigeGelenk(g),
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
    offenesGelenk = null;
    if (ansaetzeSichtbar) setzeAnsaetze(false);
    modell.markiere([]);
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

  /** Hebt alle Teile eines Gelenks grün hervor (auf der Seite der aktuellen Auswahl). */
  async function zeigeGelenk(g: Gelenk) {
    const t = modell.auswahl;
    const seite = t ? daten.strukturen.get(t.strukturId)?.meshes.find((m) => m.name === t.meshName)?.seite ?? 'r' : 'r';
    // Nur Kapsel/Bänder/Menisken markieren; Knochen nur, wenn das Gelenk im Modell keine Bänder hat (z. B. OSG).
    const mitglieder = g.mitglieder.map((id) => daten.strukturen.get(id)!).filter(Boolean);
    const weich = mitglieder.filter((s) => s.ebene === 'baender_gelenke');
    const meshes = (weich.length ? weich : mitglieder).flatMap((s) => s.meshes)
      .filter((m) => !m.seite || m.seite === seite).map((m) => m.name);
    // Schichten, die das Gelenk verdecken, ausblenden
    for (const id of ['haut', 'unterhaut', 'faszien', 'muskeln_oberflaechlich', 'muskeln_tief']) await modell.setzeEbeneSichtbar(id, false);
    await modell.setzeEbeneSichtbar('baender_gelenke', true);
    await modell.setzeEbeneSichtbar('knochen', true);
    offenesGelenk = g.id;
    modell.markiere(meshes);
    const box = new THREE.Box3();
    for (const m of meshes) { const b = modell.box(m); if (b) box.union(b); }
    if (!box.isEmpty()) szene.fokussiere(box);
    infoZeichnen();
  }

  /** Öffnet ein Gelenk aus der Suche: wählt die Kapsel (oder das erste Teil) und klappt den Gelenkabschnitt auf. */
  async function waehleGelenk(g: Gelenk) {
    const mitglieder = g.mitglieder.map((id) => daten.strukturen.get(id)!).filter(Boolean);
    const start = mitglieder.find((s) => s.typ === 'kapsel') ?? mitglieder.find((s) => s.ebene === 'baender_gelenke') ?? mitglieder[0];
    if (!start) return;
    await waehleStruktur(start);
    await zeigeGelenk(g);
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
    const treffer = modell.treffer(x, y);
    // Im Quiz „Tippe auf …“ wertet der Lernmodus den Tipp aus.
    if (lernmodus.beiTipp(treffer?.teil ?? null)) return;
    const m = punkte.treffer(x, y);
    if (m) { zeigeMarkierung(m); return; }
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
      $('#reiter-lernen').hidden = knopf.dataset.reiter !== 'lernen';
      if (knopf.dataset.reiter === 'lernen') lernmodus.zeichnen();
    });
  }
  $('#knopf-lernen').addEventListener('click', () => {
    const offen = !panelLinks.hidden && !$('#reiter-lernen').hidden;
    panelLinks.hidden = offen;
    if (!offen) document.querySelector<HTMLButtonElement>('.reiter-knopf[data-reiter="lernen"]')!.click();
    aktualisierePanelKlasse();
  });
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
  // ---------- Lernmodus ----------
  const lernmodus = new Lernmodus($('#reiter-lernen'), {
    daten, modell, speicher,
    zeigeStruktur: async (s, meshName) => { await waehleStruktur(s, meshName); },
    zeigeVerdeckt: async (meshName) => {
      const id = daten.meshIndex[meshName];
      const s = id ? daten.strukturen.get(id) : undefined;
      if (s) await modell.setzeEbeneSichtbar(s.ebene, true);
      waehleTeil(null);
      modell.waehle(meshName); // nur einfärben, kein Name, kein Info-Panel
      const box = modell.box(meshName);
      if (box) szene.fokussiere(box);
    },
    auswahlAufheben: () => waehleTeil(null),
    lernpfadGeaendert: () => baumZeichnen(),
  });
  const baumZeichnen = () => zeichneBaum($('#reiter-baum'), daten, (s, meshName) => waehleStruktur(s, meshName),
    (s) => lernmodus.imLernpfad(s), (g) => waehleGelenk(g));

  zeichneEbenen($('#reiter-ebenen'), modell, alleEinblenden);
  baumZeichnen();

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
          if (t.art === 'gelenk') { const g = daten.gelenke.get(t.strukturId); if (g) waehleGelenk(g); return; }
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
    modell, szene, daten, speicher, lernmodus,
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
