/**
 * Selectors from the product's declared test contract (contract/
 * data-hp-contract.json, houseplan-card#489). Hooks declared `since`
 * 1.73.0-beta.7 keep a legacy fallback (class or role) until that version is
 * the oldest one the suites run against; the contract lint keeps every
 * data-hp value here honest.
 */
export const HP = {
  ready: 'ha-card[data-hp-state="ready"]',
  empty: '[data-hp="empty"], .empty',
  createSpace: '[data-hp="create-space"], .empty button',
  dialog: (kind) => (kind ? `[data-hp="dialog"][data-kind="${kind}"], hp-dialog` : '[data-hp="dialog"], hp-dialog'),
  dialogConfirm: '[data-hp="dialog-confirm"]',
  dialogCancel: '[data-hp="dialog-cancel"]',
  pdf: '[data-hp="pdf"], .pdf-button',
  settings: '[data-hp="settings"], .settings-button',
  support: '[data-hp="support"], .support-button',
  spaceAdd: '[data-hp="space-add"], .tabadd',
  spaceTab: '[data-hp="space-tab"]',
  panelMenu: '[data-hp="panel-menu"], .menu',
  panelTitle: '[data-hp="panel-title"]',
  toolbar: (kind) => `[data-hp="toolbar"][data-kind="${kind}"]`,
  tool: (id) => `[data-hp="tool"][data-tool="${id}"]`,
  toast: '[data-hp="toast"], .toast',
  room: '[data-hp="room"]',
  device: (entityId) => `[data-hp="device"][data-entity="${entityId}"]`,
  editorTabs: '[data-editor-navigation]:not([data-editor-navigation="view"])',
  editorClose: '[data-hp="editor-close"]',
};

/** Confirm button of a dialog: the declared hook, else the Save button. */
export const confirmIn = (dialog) => dialog.locator(HP.dialogConfirm).or(dialog.getByRole('button', { name: /^save$/i })).first();
