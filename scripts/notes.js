import { MODULE_ID, STYLE_KEYS, debug, getSetting, loc, warn } from "./constants.js";
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
 * The icon size of a new note on a grid of the given size. Foundry rejects notes below its minimum icon size.
 * @param {number} gridSize
 * @returns {number}
 */
export function defaultIconSize(gridSize) {
  return Math.max(Math.round(gridSize * getSetting("iconScale")), NoteDocument.schema.fields.iconSize.min);
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

/** The latest icon request of each note. A slower, older request must not overwrite a newer one. */
const iconRequests = new WeakMap();

const noteExists = note => !!note.collection?.has(note.id);

/**
 * Generate the icon of a note and set it as the note's texture.
 * @param {NoteDocument} note
 */
export async function applyIcon(note) {
  const flags = note.flags?.[MODULE_ID];
  if ( !flags ) return;
  const request = (iconRequests.get(note) ?? 0) + 1;
  iconRequests.set(note, request);
  const isCurrent = () => (iconRequests.get(note) === request) && noteExists(note);
  try {
    const src = flags.autoIcon ? await ensureIcon(styleOf(flags), flags.iconText) : null;
    if ( !isCurrent() ) return;
    const update = {};
    if ( src && (src !== note.texture.src) ) update.texture = {src};
    if ( "pendingIcon" in flags ) update.flags = {[MODULE_ID]: {pendingIcon: _del}};
    if ( !foundry.utils.isEmpty(update) ) await note.update(update, {[MODULE_ID]: {iconUpdate: true}});
  } catch(err) {
    if ( !isCurrent() ) return; // Replaced or deleted meanwhile: this failure no longer matters
    warn("Could not create the note icon.", err);
    ui.notifications.error(loc("Notifications.UploadFailed"));
  }
}

/**
 * A user without upload rights changed a note while no GM is connected: mark it, so a GM creates the icon later.
 * @param {NoteDocument} note
 * @param {string} userId
 * @returns {boolean}  Whether the icon has to wait for a GM.
 */
function deferToGM(note, userId) {
  if ( (userId !== game.user.id) || canUpload() || game.users.activeGM ) return false;
  const flags = note.flags?.[MODULE_ID];
  if ( !flags?.autoIcon || !String(flags.iconText ?? "").trim() ) return true;
  ui.notifications.info(loc("Notifications.WaitingForGM"));
  if ( !flags.pendingIcon ) {
    note.update({flags: {[MODULE_ID]: {pendingIcon: true}}}, {[MODULE_ID]: {pendingIcon: true}})
      .catch(err => warn("Could not mark the note for a GM.", err));
  }
  return true;
}

/** Create the icons players asked for while no GM was connected. Runs on the active GM. */
export async function applyPendingIcons() {
  if ( !game.user.isActiveGM ) return;
  for ( const scene of game.scenes ) {
    for ( const note of scene.notes ) {
      if ( note.flags?.[MODULE_ID]?.pendingIcon ) await applyIcon(note);
    }
  }
}

function onCreateNote(note, options, userId) {
  if ( deferToGM(note, userId) || !isResponsible(userId) ) return;
  applyIcon(note);
}

function onUpdateNote(note, changes, options, userId) {
  // A GM who connected just as a player marked this note
  if ( options[MODULE_ID]?.pendingIcon ) {
    if ( game.user.isActiveGM ) applyIcon(note);
    return;
  }
  if ( options[MODULE_ID] ) return; // Our own texture update, or a migration
  const flagsChanged = foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`);
  const textureChanged = foundry.utils.hasProperty(changes, "texture.src");
  if ( !flagsChanged && !textureChanged ) return;
  if ( deferToGM(note, userId) || !isResponsible(userId) ) return;
  debug("Note changed", note.id, changes);
  applyIcon(note);
}

export function registerNoteHooks() {
  Hooks.on("createNote", onCreateNote);
  Hooks.on("updateNote", onUpdateNote);
}
