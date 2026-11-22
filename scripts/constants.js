export const MODULE_ID = "niks-journal-icon-numbers";

/** The module this one is forked from. Its settings and note flags are migrated once. */
export const LEGACY_ID = "journal-icon-numbers";

/** Root key of the module's translations. */
export const I18N = "NJIN";

/** Default folder for the icon images, relative to the user data root. */
export const DEFAULT_UPLOAD_PATH = `assets/${MODULE_ID}`;

export const TEMPLATES = {
  noteConfig: `modules/${MODULE_ID}/templates/note-config.hbs`,
  styleFields: `modules/${MODULE_ID}/templates/style-fields.hbs`,
  styleConfig: `modules/${MODULE_ID}/templates/style-config.hbs`,
  matchingConfig: `modules/${MODULE_ID}/templates/matching-config.hbs`,
  rebuild: `modules/${MODULE_ID}/templates/rebuild.hbs`,
  folderIcons: `modules/${MODULE_ID}/templates/folder-icons.hbs`,
  folderIconRow: `modules/${MODULE_ID}/templates/folder-icon-row.hbs`
};

/** Shape keys and their label keys. */
export const ICON_TYPES = {
  circle: `${I18N}.Shapes.circle`,
  square: `${I18N}.Shapes.square`,
  diamond: `${I18N}.Shapes.diamond`,
  hexh: `${I18N}.Shapes.hexh`,
  hexv: `${I18N}.Shapes.hexv`,
  none: `${I18N}.Shapes.none`
};

/** The style fields stored per note (flags) and as world defaults (settings of the same name). */
export const STYLE_KEYS = [
  "iconType", "foreColor", "backColor", "fontFamily", "fontBold", "fontItalics", "strokeWidth", "iconFontSize",
  "autoFit"
];

/** Name matching settings. */
export const MATCH_KEYS = [
  "reg_alpha_num", "reg_num_alpha", "reg_num", "reg_alpha_space", "reg_alpha_dot", "reg_num_dot", "reg_custom"
];

/** Settings that only size new notes. */
export const SIZE_KEYS = ["iconScale", "fontSize"];

/**
 * Log to the console. Debug output is enabled with `CONFIG.debug.niksJournalIconNumbers = true`.
 * @param {...any} args
 */
export function debug(...args) {
  if ( CONFIG.debug.niksJournalIconNumbers ) console.debug(`${MODULE_ID} |`, ...args);
}

export function warn(...args) {
  console.warn(`${MODULE_ID} |`, ...args);
}

export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}

/** Localize a key below the module's root key. */
export function loc(key, data) {
  return data ? game.i18n.format(`${I18N}.${key}`, data) : game.i18n.localize(`${I18N}.${key}`);
}
