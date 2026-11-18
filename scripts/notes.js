import { MODULE_ID, STYLE_KEYS, debug, loc, warn } from "./constants.js";
import { canUpload, ensureIcon } from "./icon-files.js";
import { getDefaultStyle, normalizeStyle } from "./icon-svg.js";
import { matchLabel } from "./matching.js";

/**
 * The label a note's icon text is matched against: its text, else its page name, else its journal entry name.
 * @param {{text?: string, entryId?: string, pageId?: string}} data
 */
export function noteLabel({text, entryId, pageId}={}) {
  if ( text?.trim() ) return text.trim();
  const entry = game.journal.get(entryId);
  return entry?.pages.get(pageId)?.name ?? entry?.name ?? "";
}

/**
 * The module flags of a note, filled up with defaults. A note without flags gets the world style and the icon text
 * matched from its label.
 * @param {NoteDocument} note
 * @returns {object}
 */
export function getNoteFlags(note) {
  const stored = note.flags?.[MODULE_ID];
  if ( stored ) {
    return {
      ...normalizeStyle({...getDefaultStyle(), ...stored}),
      autoIcon: !!stored.autoIcon,
      iconText: String(stored.iconText ?? "")
    };
  }
  const iconText = matchLabel(noteLabel(note)) ?? "";
  return {...getDefaultStyle(), autoIcon: !!iconText, iconText};
}

/** Pick the style fields out of a flags object. */
export function styleOf(flags) {
  return Object.fromEntries(STYLE_KEYS.map(k => [k, flags[k]]));
}

/**
 * Should this client generate the icon for a change made by the given user? The user who made the change does it
 * if they may upload files; otherwise the active GM does it for them.
 * @param {string} userId
 */
function isResponsible(userId) {
  const author = game.users.get(userId);
  if ( userId === game.user.id ) return canUpload();
  if ( author && canUpload(author) ) return false;
  return game.user === game.users.activeGM;
}

/**
 * Generate the icon of a note and set it as the note's texture.
 * @param {NoteDocument} note
 */
export async function applyIcon(note) {
  const flags = note.flags?.[MODULE_ID];
  if ( !flags?.autoIcon ) return;
  try {
    const src = await ensureIcon(styleOf(flags), flags.iconText);
    if ( !src || (src === note.texture.src) ) return;
    await note.update({"texture.src": src}, {[MODULE_ID]: {iconUpdate: true}});
  } catch(err) {
    warn("Could not create the note icon.", err);
    ui.notifications.error(loc("Notifications.UploadFailed"));
  }
}

function onCreateNote(note, options, userId) {
  if ( !isResponsible(userId) ) return;
  applyIcon(note);
}

function onUpdateNote(note, changes, options, userId) {
  if ( options[MODULE_ID] ) return; // Our own texture update, or a migration
  if ( !isResponsible(userId) ) return;
  const flagsChanged = foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`);
  const textureChanged = foundry.utils.hasProperty(changes, "texture.src");
  if ( !flagsChanged && !textureChanged ) return;
  debug("Note changed", note.id, changes);
  applyIcon(note);
}

export function registerNoteHooks() {
  Hooks.on("createNote", onCreateNote);
  Hooks.on("updateNote", onUpdateNote);
}
