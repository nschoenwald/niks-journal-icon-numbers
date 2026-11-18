import { MODULE_ID, TEMPLATES, debug, getSetting, warn } from "./constants.js";
import { matchLabel } from "./matching.js";
import { getNoteFlags, noteLabel } from "./notes.js";
import { IconPreview, activateColorFields, readStyle, styleFieldsContext } from "./style-ui.js";

const PREFIX = `flags.${MODULE_ID}.`;

/** Listener controllers by sheet. The sheet's form element survives re-renders, so old listeners must go. */
const controllers = new WeakMap();

/**
 * Add the automatic icon fields to the Note Config sheet.
 * @param {foundry.applications.sheets.NoteConfig} app
 * @param {HTMLElement} element
 * @param {object} context
 * @param {object} options
 */
export function onRenderNoteConfig(app, element, context, options) {
  if ( !app.isEditable || !app.form ) return;
  injectFields(app, options).catch(err => warn("Could not add the automatic icon fields.", err));
}

async function injectFields(app, options) {
  const form = app.form;
  const note = app.document;
  const isNew = !note.collection?.has(note.id);
  const flags = getNoteFlags(note);

  const html = await foundry.applications.handlebars.renderTemplate(TEMPLATES.noteConfig, {
    ...styleFieldsContext(flags, PREFIX, app.id),
    flags
  });
  if ( !form.isConnected ) return; // Closed or re-rendered meanwhile
  const fieldset = foundry.utils.parseHTML(html);
  const iconFieldset = form.querySelector('[name="icon.selected"]')?.closest("fieldset");
  if ( iconFieldset ) iconFieldset.after(fieldset);
  else (form.querySelector(".form-body") ?? form).append(fieldset);

  controllers.get(app)?.abort();
  const controller = new AbortController();
  controllers.set(app, controller);
  const {signal} = controller;

  activateColorFields(fieldset);
  const preview = new IconPreview(fieldset);
  const refresh = () => refreshPreview(form, fieldset, preview);

  // While the note has no stored icon settings, the icon text follows the note's label until the user edits it.
  let followLabel = !note.flags?.[MODULE_ID];
  form.elements[`${PREFIX}iconText`].addEventListener("input", () => followLabel = false);
  form.elements[`${PREFIX}autoIcon`].addEventListener("change", () => followLabel = false);

  form.addEventListener("change", event => {
    const name = event.target.name;
    if ( followLabel && ["text", "entryId", "pageId"].includes(name) ) updateFromLabel(form);
    if ( name === `${PREFIX}autoIcon` ) {
      fieldset.querySelector(".njin-auto-fields").hidden = !event.target.checked;
      app.setPosition({height: "auto"});
    }
    refresh();
  }, {signal});
  form.addEventListener("input", event => {
    if ( event.target.name?.startsWith(PREFIX) || event.target.closest?.(".njin-color") ) refresh();
  }, {signal});

  let quickAdd = false;
  if ( isNew && options.isFirstRender ) quickAdd = applyNewNoteDefaults(form, note, flags);

  refresh();
  app.setPosition({height: "auto"});

  if ( quickAdd && getSetting("autoClose") ) {
    debug("Quick Add: submitting the new note");
    form.requestSubmit();
  }
}

/**
 * Set the size and, for notes that get no automatic icon, a stock icon from the folder or an image page.
 * @returns {boolean}  Whether the note got an icon from this module (automatic, folder or page image).
 */
function applyNewNoteDefaults(form, note, flags) {
  const scene = note.parent ?? canvas.scene;
  const gridSize = scene?.grid.size ?? 100;
  setValue(form, "iconSize", Math.max(Math.round(gridSize * getSetting("iconScale")), 1));
  setValue(form, "fontSize", getSetting("fontSize"));
  if ( flags.autoIcon ) return true;

  const entry = game.journal.get(note.entryId);
  let matched = false;
  if ( getSetting("folderIcon") ) matched = applyFolderIcon(form, entry) || matched;
  if ( getSetting("autoPageImage") ) matched = applyPageImage(form, entry, note.pageId) || matched;
  return matched;
}

function setValue(form, name, value) {
  const input = form.elements[name];
  if ( !input ) return;
  input.value = value;
  input.dispatchEvent(new Event("change", {bubbles: true}));
}

/** Pick the stock icon named like the journal entry's folder ("Village", "Cave", ...). */
function applyFolderIcon(form, entry) {
  const folderName = entry?.folder?.name?.trim().toLocaleLowerCase(game.i18n.lang);
  if ( !folderName ) return false;
  const match = Object.entries(CONFIG.JournalEntry.noteIcons).find(([label]) => {
    return [label, game.i18n.localize(label)].some(l => l.toLocaleLowerCase(game.i18n.lang) === folderName);
  });
  if ( !match ) return false;
  setValue(form, "icon.selected", match[1]);
  return true;
}

/** Use the linked image page, or else the first image page of the entry, as a custom icon. */
function applyPageImage(form, entry, pageId) {
  if ( !entry ) return false;
  const isImage = p => (p?.type === "image") && p.src;
  const linked = entry.pages.get(pageId);
  const page = isImage(linked) ? linked : entry.pages.contents.sort((a, b) => a.sort - b.sort).find(isImage);
  if ( !page ) return false;
  setValue(form, "icon.custom", page.src);
  setValue(form, "icon.selected", "");
  return true;
}

/** Recompute the icon text from the label fields of the form. */
function updateFromLabel(form) {
  const label = noteLabel({
    text: form.elements.text?.value,
    entryId: form.elements.entryId?.value,
    pageId: form.elements.pageId?.value
  });
  const iconText = matchLabel(label) ?? "";
  form.elements[`${PREFIX}iconText`].value = iconText;
  const auto = form.elements[`${PREFIX}autoIcon`];
  if ( auto.checked !== !!iconText ) {
    auto.checked = !!iconText;
    form.querySelector(".njin-auto-fields").hidden = !iconText;
  }
}

function refreshPreview(form, fieldset, preview) {
  if ( form.elements[`${PREFIX}autoIcon`].checked ) {
    preview.showIcon(readStyle(fieldset, PREFIX), form.elements[`${PREFIX}iconText`].value.trim());
  } else {
    const src = form.elements["icon.selected"]?.value || form.elements["icon.custom"]?.value || "";
    preview.showImage(src);
  }
}
