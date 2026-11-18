import { MODULE_ID, SIZE_KEYS, STYLE_KEYS, TEMPLATES, getSetting } from "../constants.js";
import { getDefaultStyle, normalizeStyle } from "../icon-svg.js";
import { IconPreview, activateColorFields, readStyle, styleFieldsContext } from "../style-ui.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The world default icon style, and the size of new notes.
 */
export default class StyleConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-style`,
    tag: "form",
    classes: ["njin-config"],
    window: {
      title: "NJIN.StyleConfig.Title",
      icon: "fa-solid fa-palette",
      contentClasses: ["standard-form"]
    },
    position: {width: 520},
    form: {
      handler: StyleConfig.#onSubmit,
      closeOnSubmit: true
    }
  };

  static PARTS = {
    body: {template: TEMPLATES.styleConfig, scrollable: [""]},
    footer: {template: "templates/generic/form-footer.hbs"}
  };

  /** @override */
  async _prepareContext(options) {
    return {
      ...styleFieldsContext(getDefaultStyle(), "", this.id),
      sampleText: "42a",
      iconScale: getSetting("iconScale"),
      fontSize: getSetting("fontSize"),
      buttons: [{type: "submit", icon: "fa-solid fa-floppy-disk", label: "SETTINGS.Save"}]
    };
  }

  #preview;

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this.#preview = new IconPreview(this.element);
    // The form element survives re-renders, so its listeners are added once.
    this.element.addEventListener("input", () => this.#refresh());
    this.element.addEventListener("change", () => this.#refresh());
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    activateColorFields(this.element);
    this.#refresh();
  }

  #refresh() {
    this.#preview.showIcon(readStyle(this.element, ""), this.element.elements.sampleText.value.trim());
  }

  static async #onSubmit(event, form, formData) {
    const data = formData.object;
    const style = normalizeStyle(data);
    const updates = STYLE_KEYS.map(k => [k, style[k]]);
    const iconScale = Number(data.iconScale);
    if ( Number.isFinite(iconScale) && (iconScale > 0) ) updates.push(["iconScale", iconScale]);
    const fontSize = Math.round(Number(data.fontSize));
    if ( Number.isFinite(fontSize) ) updates.push(["fontSize", Math.clamp(fontSize, 8, 128)]);
    for ( const [key, value] of updates ) {
      if ( (STYLE_KEYS.includes(key) || SIZE_KEYS.includes(key)) && (getSetting(key) !== value) ) {
        await game.settings.set(MODULE_ID, key, value);
      }
    }
  }
}
