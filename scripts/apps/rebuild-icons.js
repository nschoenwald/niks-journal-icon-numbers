import { MODULE_ID, STYLE_KEYS, TEMPLATES, loc, warn } from "../constants.js";
import { clearFileCache, ensureIcon } from "../icon-files.js";
import { getDefaultStyle } from "../icon-svg.js";
import { defaultIconSize, styleOf } from "../notes.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Regenerate the icon files of all notes with an automatic icon, in every scene of the world.
 * @param {object} options
 * @param {boolean} options.useDefaults  Replace each note's style and size with the world defaults.
 * @returns {Promise<number>}  The number of notes rebuilt.
 */
export async function rebuildIcons({useDefaults=false}={}) {
  clearFileCache();
  const scenes = game.scenes.map(scene => ({
    scene,
    notes: scene.notes.filter(n => n.flags?.[MODULE_ID]?.autoIcon && n.flags[MODULE_ID].iconText)
  })).filter(s => s.notes.length);
  const total = scenes.reduce((n, s) => n + s.notes.length, 0);
  if ( !total ) {
    ui.notifications.info(loc("Rebuild.None"));
    return 0;
  }

  const defaults = getDefaultStyle();
  const progress = ui.notifications.info(loc("Rebuild.Progress"), {progress: true});
  let done = 0;
  let failed = 0;
  for ( const {scene, notes} of scenes ) {
    const updates = [];
    for ( const note of notes ) {
      const flags = useDefaults ? {...note.flags[MODULE_ID], ...defaults} : note.flags[MODULE_ID];
      try {
        const src = await ensureIcon(styleOf(flags), flags.iconText);
        if ( !src ) throw new Error("The note has no icon text");
        const update = {_id: note.id, "texture.src": src};
        if ( useDefaults ) {
          for ( const key of STYLE_KEYS ) update[`flags.${MODULE_ID}.${key}`] = defaults[key];
          update.iconSize = defaultIconSize(scene.grid.size);
        }
        updates.push(update);
      } catch(err) {
        failed++;
        warn(`Could not rebuild the icon of note ${note.uuid}.`, err);
      }
      progress.update({pct: ++done / total});
    }
    if ( !updates.length ) continue;
    try {
      await scene.updateEmbeddedDocuments("Note", updates, {[MODULE_ID]: {rebuild: true}});
    } catch(err) {
      failed += updates.length;
      warn(`Could not update the notes of scene ${scene.uuid}.`, err);
    }
  }
  progress.update({pct: 1});
  if ( failed ) ui.notifications.warn(loc("Rebuild.Failed", {failed, total}));
  else ui.notifications.info(loc("Rebuild.Done", {count: total}));
  return total - failed;
}

/**
 * Settings menu that asks how to rebuild the icons.
 */
export default class RebuildIcons extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-rebuild`,
    tag: "form",
    classes: ["njin-config"],
    window: {
      title: "NJIN.Rebuild.Title",
      icon: "fa-solid fa-arrows-rotate",
      contentClasses: ["standard-form"]
    },
    position: {width: 480},
    form: {
      handler: RebuildIcons.#onSubmit,
      closeOnSubmit: true
    }
  };

  static PARTS = {
    body: {template: TEMPLATES.rebuild},
    footer: {template: "templates/generic/form-footer.hbs"}
  };

  /** @override */
  async _prepareContext(options) {
    return {
      rootId: this.id,
      buttons: [{type: "submit", icon: "fa-solid fa-arrows-rotate", label: "NJIN.Rebuild.Submit"}]
    };
  }

  static async #onSubmit(event, form, formData) {
    rebuildIcons({useDefaults: formData.object.mode === "defaults"});
  }
}
