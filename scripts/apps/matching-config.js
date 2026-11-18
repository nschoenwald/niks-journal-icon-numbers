import { I18N, MATCH_KEYS, MODULE_ID, TEMPLATES, getSetting, loc } from "../constants.js";
import { getDefaultStyle } from "../icon-svg.js";
import { PATTERNS, buildPatterns, getMatchSettings, matchLabel } from "../matching.js";
import { IconPreview } from "../style-ui.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Which note names get an automatic icon.
 */
export default class MatchingConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-matching`,
    tag: "form",
    classes: ["njin-config"],
    window: {
      title: "NJIN.Matching.Title",
      icon: "fa-solid fa-hashtag",
      contentClasses: ["standard-form"]
    },
    position: {width: 520},
    form: {
      handler: MatchingConfig.#onSubmit,
      closeOnSubmit: true
    }
  };

  static PARTS = {
    body: {template: TEMPLATES.matchingConfig, scrollable: [""]},
    footer: {template: "templates/generic/form-footer.hbs"}
  };

  /** @override */
  async _prepareContext(options) {
    const settings = getMatchSettings();
    return {
      rootId: this.id,
      sampleText: "42a Tavern",
      patterns: Object.keys(PATTERNS).map(key => ({
        key,
        label: `${I18N}.Matching.Patterns.${key}`,
        checked: settings[key]
      })),
      reg_custom: settings.reg_custom,
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
    this.#refresh();
  }

  #readSettings() {
    const form = this.element;
    const settings = {};
    for ( const key of Object.keys(PATTERNS) ) settings[key] = form.elements[key].checked;
    settings.reg_custom = form.elements.reg_custom.value;
    return settings;
  }

  #refresh() {
    const preview = this.#preview;
    const settings = this.#readSettings();
    const {error} = buildPatterns(settings);
    const errorEl = this.element.querySelector(".njin-regex-error");
    errorEl.hidden = !error;
    errorEl.querySelector("span").textContent = error ? loc("Matching.InvalidPattern", {error}) : "";

    const text = matchLabel(this.element.elements.sampleText.value, settings);
    this.element.querySelector(".njin-match-result").textContent = text
      ? loc("Matching.Result", {text})
      : loc("Matching.NoMatch");
    if ( text ) preview.showIcon(getDefaultStyle(), text);
    else preview.showImage("");
  }

  static async #onSubmit(event, form, formData) {
    const data = formData.object;
    for ( const key of MATCH_KEYS ) {
      const value = key === "reg_custom" ? String(data[key] ?? "").trim() : !!data[key];
      if ( getSetting(key) !== value ) await game.settings.set(MODULE_ID, key, value);
    }
  }
}
