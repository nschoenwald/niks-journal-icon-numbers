import { MODULE_ID, TEMPLATES, getSetting } from "../constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Stock icons as {path: name}, sorted by name. */
function stockIcons() {
  const icons = Object.entries(CONFIG.JournalEntry.noteIcons).sort(([a], [b]) => a.localeCompare(b, game.i18n.lang));
  return Object.fromEntries(icons.map(([name, src]) => [src, name]));
}

/**
 * The stock icon the GM mapped to a folder name.
 * @param {string} folderName
 * @returns {string|undefined}
 */
export function getMappedFolderIcon(folderName) {
  const name = folderName.trim().toLowerCase();
  const icons = Object.values(CONFIG.JournalEntry.noteIcons);
  const row = (getSetting("folderIcons")?.rows ?? []).find(r => r.folder?.toLowerCase() === name);
  return icons.includes(row?.icon) ? row.icon : undefined;
}

/**
 * Maps journal folder names to stock icons, so a folder can have any name in any language.
 */
export default class FolderIconsConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-folder-icons`,
    tag: "form",
    classes: ["njin-config"],
    window: {
      title: "NJIN.FolderIcons.Title",
      icon: "fa-solid fa-folder-tree",
      contentClasses: ["standard-form"]
    },
    position: {width: 520},
    actions: {
      addRow: FolderIconsConfig.#onAddRow,
      removeRow: FolderIconsConfig.#onRemoveRow
    },
    form: {
      handler: FolderIconsConfig.#onSubmit,
      closeOnSubmit: true
    }
  };

  static PARTS = {
    body: {template: TEMPLATES.folderIcons, scrollable: [".njin-folder-rows"]},
    footer: {template: "templates/generic/form-footer.hbs"}
  };

  /** @override */
  async _prepareContext(options) {
    const folders = game.folders.filter(f => f.type === "JournalEntry").map(f => f.name);
    return {
      rootId: this.id,
      rows: getSetting("folderIcons")?.rows ?? [],
      icons: stockIcons(),
      folders: [...new Set(folders)].sort((a, b) => a.localeCompare(b, game.i18n.lang)),
      buttons: [{type: "submit", icon: "fa-solid fa-floppy-disk", label: "SETTINGS.Save"}]
    };
  }

  static #onAddRow() {
    const row = this.element.querySelector("template.njin-folder-row-template").content.cloneNode(true);
    const input = row.querySelector(".njin-folder-name");
    this.element.querySelector(".njin-folder-rows").append(row);
    input.focus();
    this.setPosition({height: "auto"});
  }

  static #onRemoveRow(event, target) {
    target.closest(".njin-folder-row").remove();
    this.setPosition({height: "auto"});
  }

  static async #onSubmit(event, form) {
    const seen = new Set();
    const rows = [];
    for ( const row of form.querySelectorAll(".njin-folder-rows .njin-folder-row") ) {
      const folder = row.querySelector(".njin-folder-name").value.trim();
      const icon = row.querySelector(".njin-folder-icon").value;
      const key = folder.toLowerCase();
      if ( !folder || !icon || seen.has(key) ) continue;
      seen.add(key);
      rows.push({folder, icon});
    }
    await game.settings.set(MODULE_ID, "folderIcons", {rows});
  }
}
