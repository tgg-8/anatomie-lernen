// Dialoge: Hinweis beim ersten Start sowie Quellen und Lizenzen.
import { h } from './dom';
import type { Daten } from '../typen';

function oeffne(dialog: HTMLDialogElement, titel: string, inhalt: (Node | string)[], knopfText = 'Schließen', beiSchliessen?: () => void) {
  dialog.replaceChildren(
    h('div', { class: 'dialog-inhalt' }, h('h2', {}, titel), ...inhalt),
    h('div', { class: 'dialog-fuss' }, h('button', { class: 'knopf', onclick: () => { dialog.close(); beiSchliessen?.(); } }, knopfText)),
  );
  dialog.showModal();
}

export const HINWEIS_TEXT =
  'Diese App ist ein reines Lernmodell für die Ausbildung. Sie ersetzt keine medizinische Beratung oder Diagnose ' +
  'und auch nicht den Unterricht und die Lehrbücher der Schule. Die Texte sind Entwürfe und können Fehler enthalten – ' +
  'bitte immer mit dem Schulbuch abgleichen. Angaben, die noch nicht gesichert sind, stehen als „noch zu prüfen“ da.';

export function zeigeStarthinweis(dialog: HTMLDialogElement, fertig: () => void) {
  oeffne(dialog, 'Willkommen!', [
    h('p', {}, 'Drehen: ein Finger · Zoomen: zwei Finger spreizen · Verschieben: zwei Finger ziehen · Auswählen: kurz antippen.'),
    h('p', { class: 'hinweisbox' }, HINWEIS_TEXT),
  ], 'Verstanden', fertig);
}

export function zeigeInfo(dialog: HTMLDialogElement, daten: Daten) {
  oeffne(dialog, 'Hinweise, Quellen und Lizenzen', [
    h('p', { class: 'hinweisbox' }, HINWEIS_TEXT),
    h('h3', {}, 'Bedienung'),
    h('ul', {},
      h('li', {}, 'Ein Finger: drehen. Zwei Finger: zoomen und verschieben.'),
      h('li', {}, 'Kurz antippen: Struktur auswählen. Ins Leere tippen: Auswahl aufheben.'),
      h('li', {}, 'Ebenen (☰): Schichten ein- und ausblenden, Transparenz regeln.'),
      h('li', {}, 'Info-Panel: Detailstufe wählen (Überblick, Details, Feinbau).'),
    ),
    h('h3', {}, 'Quellen und Lizenzen'),
    h('ul', {}, Object.values(daten.quellen).map((q) => h('li', {},
      h('a', { href: q.url, target: '_blank', rel: 'noopener' }, q.titel), ` – ${q.lizenz} (${q.art})`))),
    h('p', {}, '3D-Modelle: abgeleitet von Z-Anatomy (CC BY-SA 4.0), das auf BodyParts3D basiert. Die umgewandelten Modelle in dieser App stehen ebenfalls unter CC BY-SA 4.0. Teile mit nicht-kommerzieller Lizenz (Innenohr, Niere) wurden nicht übernommen.'),
    h('p', { class: 'klein-leise' }, 'Vollständige Liste: QUELLEN_UND_LIZENZEN.md im Projekt.'),
  ]);
}
