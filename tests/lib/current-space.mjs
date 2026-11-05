/** Read one public DOM snapshot; lazy navigation can replace tabs between awaits. */
export function readCurrentSpace(card, selectors) {
  const root = card.shadowRoot ?? card;
  const select = root.querySelector(selectors.value);
  if (select) return select.value;
  return root.querySelector(selectors.tab)?.getAttribute('data-space') ?? null;
}
