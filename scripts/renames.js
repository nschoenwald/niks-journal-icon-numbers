import { MODULE_ID, debug, getSetting, warn } from "./constants.js";
import { matchLabel } from "./matching.js";

/** The last known name of each journal entry and page. Update hooks only receive the new name. */
const knownNames = new Map();

/**
 * Update the icon text of notes whose journal entry or page was renamed. A text that didn't come from the old name
 * was typed by hand and stays. So does the icon if the new name doesn't match any pattern.
 * @param {JournalEntry|JournalEntryPage} doc  The renamed document.
 * @param {string} oldName
 */
async function updateNotes(doc, oldName) {
  const isPage = doc.documentName === "JournalEntryPage";
  const entry = isPage ? doc.parent : doc;
  const oldText = matchLabel(oldName);
  const newText = matchLabel(doc.name);
  if ( !oldText || !newText || (oldText === newText) ) return;

  for ( const scene of game.scenes ) {
    const updates = [];
    for ( const note of scene.notes ) {
      const flags = note.flags?.[MODULE_ID];
      if ( !flags?.autoIcon || (flags.iconText !== oldText) || note.text?.trim() || (note.entryId !== entry.id) ) continue;
      // A note linked to a page is labeled by the page, any other by the entry.
      const labeledBy = entry.pages.get(note.pageId) ?? entry;
      if ( labeledBy === doc ) updates.push({_id: note.id, [`flags.${MODULE_ID}.iconText`]: newText});
    }
    if ( !updates.length ) continue;
    debug(`Renamed "${oldName}" to "${doc.name}": updating ${updates.length} notes in ${scene.name}`);
    try {
      await scene.updateEmbeddedDocuments("Note", updates); // The note hooks then create the new icons
    } catch(err) {
      warn(`Could not update the notes of scene ${scene.uuid}.`, err);
    }
  }
}

function onUpdate(doc, changes) {
  const oldName = knownNames.get(doc.uuid);
  knownNames.set(doc.uuid, doc.name);
  if ( !("name" in changes) || (oldName === undefined) || (oldName === doc.name) ) return;
  if ( game.user.isActiveGM && getSetting("followRenames") ) updateNotes(doc, oldName);
}

// These listeners return nothing on purpose: a hook listener that returns false stops the listeners after it.
function remember(doc) {
  knownNames.set(doc.uuid, doc.name);
}

function forget(doc) {
  knownNames.delete(doc.uuid);
}

/** Only GMs track names: the active GM updates the notes, and any GM may become the active one. */
export function registerRenameHooks() {
  if ( !game.user.isGM ) return;
  for ( const entry of game.journal ) {
    remember(entry);
    for ( const page of entry.pages ) remember(page);
  }
  for ( const type of ["JournalEntry", "JournalEntryPage"] ) {
    Hooks.on(`create${type}`, remember);
    Hooks.on(`update${type}`, onUpdate);
    Hooks.on(`delete${type}`, forget);
  }
}
