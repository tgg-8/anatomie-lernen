// Kleine Hilfsfunktion zum Erzeugen von HTML-Elementen.
// Texte werden immer als textContent gesetzt (nie als HTML), das ist sicher.
type Kind = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attribute: Record<string, string | boolean | ((e: Event) => void)> = {},
  ...kinder: (Kind | Kind[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attribute)) {
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false) el.setAttribute(k, v);
  }
  for (const kind of kinder.flat()) {
    if (kind === null || kind === undefined || kind === false) continue;
    el.append(kind);
  }
  return el;
}
