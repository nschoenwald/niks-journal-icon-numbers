import { DEFAULT_UPLOAD_PATH, LEGACY_ID, MATCH_KEYS, MODULE_ID, SIZE_KEYS, STYLE_KEYS, debug, getSetting, loc, warn } from "./constants.js";
import { copyIntoUploadFolder, ensureIcon, normalizeFolder, normalizePath, uploadFolder } from "./icon-files.js";
import { styleOf } from "./notes.js";

/** Default upload folder of the original module. */
const LEGACY_FOLDER = `upload/${LEGACY_ID}`;

/** Default upload folder of this module in 14.0.0. */
const OLD_FOLDER = `upload/${MODULE_ID}`;

/**
 * World settings copied from the original module, under the same names. The upload folder isn't copied: icon files
 * are moved into this module's folder instead (see migrateIconFiles).
 */
const SETTING_KEYS = [...STYLE_KEYS, ...MATCH_KEYS, ...SIZE_KEYS, "folderIcon", "autoClose", "autoPageImage"];

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

/* -------------------------------------------- */
/*  Icon files                                  */
/* -------------------------------------------- */

/** The stored value of a world setting, or undefined if it was never set. */
function storedSetting(key) {
  return game.settings.storage.get("world").find(s => s.key === key)?.value;
}

/**
 * 14.0.0 copied the original module's upload folder setting. If ours still holds that copied value, go back to the
 * default, so the icons end up in this module's folder.
 */
async function resetCopiedUploadPath() {
  const legacy = storedSetting(`${LEGACY_ID}.uploadPath`);
  const ours = storedSetting(`${MODULE_ID}.uploadPath`);
  if ( (legacy === undefined) || (ours === undefined) || (normalizeFolder(legacy) !== normalizeFolder(ours)) ) return;
  await game.settings.set(MODULE_ID, "uploadPath", DEFAULT_UPLOAD_PATH);
  debug("Reset the upload folder copied from the original module");
}

/**
 * Move the icon images of map notes from the old upload folders (the original module's, and this module's 14.0.0
 * default) into the current upload folder, and point the notes at the copies. Images that can't be read are created
 * again from the note's automatic icon settings. The old files are left in place: Foundry has no API to delete files.
 * Runs once, on the active GM.
 */
export async function migrateIconFiles() {
  if ( !game.user.isActiveGM || getSetting("iconFilesMigrated") ) return;
  try {
    await resetCopiedUploadPath();
    const target = uploadFolder();
    const legacySetting = normalizeFolder(storedSetting(`${LEGACY_ID}.uploadPath`));
    const folders = [LEGACY_FOLDER, OLD_FOLDER, legacySetting].filter(f => f && (f !== target));
    const isOld = src => {
      const path = normalizePath(src ?? "");
      return folders.some(f => path.startsWith(`${f}/`));
    };

    const scenes = game.scenes.map(scene => ({scene, notes: scene.notes.filter(n => isOld(n.texture.src))}))
      .filter(s => s.notes.length);
    const total = scenes.reduce((n, s) => n + s.notes.length, 0);
    if ( total ) await moveFiles(scenes, total, target);
    await game.settings.set(MODULE_ID, "iconFilesMigrated", true);
  } catch(err) {
    warn("Moving the icon files failed.", err);
  }
}

async function moveFiles(scenes, total, target) {
  const progress = ui.notifications.info(loc("Notifications.FilesMigrating", {folder: target}), {progress: true});
  let done = 0;
  let failed = 0;
  for ( const {scene, notes} of scenes ) {
    const updates = [];
    for ( const note of notes ) {
      const src = await copyOrRecreate(note);
      if ( src ) updates.push({_id: note.id, "texture.src": src});
      else failed++;
      progress.update({pct: ++done / total});
    }
    if ( updates.length ) await scene.updateEmbeddedDocuments("Note", updates, {[MODULE_ID]: {migration: true}});
  }
  progress.update({pct: 1});
  if ( failed ) ui.notifications.warn(loc("Notifications.FilesMigratedFailed", {failed, total}), {permanent: true});
  else ui.notifications.info(loc("Notifications.FilesMigrated", {count: total, folder: target}));
}

/**
 * @param {NoteDocument} note
 * @returns {Promise<string|null>}  The new texture, or null if the image could neither be copied nor recreated.
 */
async function copyOrRecreate(note) {
  try {
    return await copyIntoUploadFolder(note.texture.src);
  } catch(err) {
    debug(`Could not copy ${note.texture.src}, recreating it`, err);
  }
  const flags = note.flags[MODULE_ID];
  if ( flags?.autoIcon && flags.iconText ) {
    try {
      return await ensureIcon(styleOf(flags), flags.iconText);
    } catch(err) {
      warn(`Could not recreate the icon of note ${note.uuid}.`, err);
    }
  } else warn(`Could not move the icon of note ${note.uuid} (${note.texture.src}).`);
  return null;
}
