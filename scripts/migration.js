import { LEGACY_ID, MATCH_KEYS, MODULE_ID, SIZE_KEYS, STYLE_KEYS, debug, getSetting, loc, warn } from "./constants.js";

/** World settings copied from the original module, under the same names. */
const SETTING_KEYS = [...STYLE_KEYS, ...MATCH_KEYS, ...SIZE_KEYS, "folderIcon", "autoClose", "autoPageImage", "uploadPath"];

/** Note flags copied from the original module. */
const FLAG_KEYS = ["autoIcon", "iconText", ...STYLE_KEYS];

/**
 * Copy the world settings and note flags of the original "Automatic Journal Icon Numbers" module once, so worlds that
 * switch to this fork keep their icons and defaults. The original data is left untouched.
 * Runs on the active GM only.
 */
export async function migrateFromLegacy() {
  if ( !game.user.isActiveGM || getSetting("legacyMigrated") ) return;
  try {
    const settings = await migrateSettings();
    const notes = await migrateNotes();
    if ( settings || notes ) ui.notifications.info(loc("Notifications.Migrated", {notes}));
    await game.settings.set(MODULE_ID, "legacyMigrated", true);
  } catch(err) {
    warn("Migration from Automatic Journal Icon Numbers failed.", err);
  }
}

async function migrateSettings() {
  const storage = game.settings.storage.get("world");
  const find = key => storage.find(s => s.key === key);
  let count = 0;
  for ( const key of SETTING_KEYS ) {
    const legacy = find(`${LEGACY_ID}.${key}`);
    if ( !legacy || find(`${MODULE_ID}.${key}`) ) continue; // Nothing to copy, or already set in this module
    try {
      await game.settings.set(MODULE_ID, key, legacy.value);
      count++;
    } catch(err) {
      warn(`Could not copy the setting "${key}".`, err);
    }
  }
  debug(`Migrated ${count} settings`);
  return count;
}

async function migrateNotes() {
  let count = 0;
  for ( const scene of game.scenes ) {
    const updates = [];
    for ( const note of scene.notes ) {
      if ( note.flags[MODULE_ID] ) continue;
      // "autoIconFlags" is where versions before 1.0.4 stored the same data.
      const legacy = {...note.flags.autoIconFlags, ...note.flags[LEGACY_ID]};
      const flags = Object.fromEntries(FLAG_KEYS.filter(k => k in legacy).map(k => [k, legacy[k]]));
      if ( !Object.keys(flags).length ) continue;
      updates.push({_id: note.id, [`flags.${MODULE_ID}`]: flags});
    }
    if ( !updates.length ) continue;
    await scene.updateEmbeddedDocuments("Note", updates, {[MODULE_ID]: {migration: true}});
    count += updates.length;
  }
  debug(`Migrated ${count} notes`);
  return count;
}
