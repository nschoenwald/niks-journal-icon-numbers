import { ICON_TYPES, STYLE_KEYS } from "./constants.js";
import { buildPreviewSrc, joinColor, splitColor } from "./icon-svg.js";

const COLOR_LABELS = {
  foreColor: "NJIN.Fields.foreColor",
  backColor: "NJIN.Fields.backColor"
};

const alphaLabel = alpha => `${Math.round(alpha * 100)}%`;

/**
 * Template data for the style fields partial.
 * @param {object} style
 * @param {string} prefix  Prefix of the input names.
 * @param {string} rootId  Prefix of the input ids.
 */
export function styleFieldsContext(style, prefix, rootId) {
  const colors = Object.entries(COLOR_LABELS).map(([key, label]) => {
    const {rgb, alpha} = splitColor(style[key]);
    return {key, label, rgb, alpha, alphaLabel: alphaLabel(alpha), value: joinColor(rgb, alpha)};
  });
  return {style, prefix, rootId, colors, iconTypes: ICON_TYPES};
}

/**
 * Keep the hidden #rrggbbaa inputs in sync with their color picker and opacity slider. The listeners run on the
 * controls themselves, so the hidden value is up to date before the change bubbles to the form.
 * @param {HTMLElement} root
 */
export function activateColorFields(root) {
  for ( const group of root.querySelectorAll(".njin-color") ) {
    const picker = group.querySelector("color-picker");
    const range = group.querySelector(".njin-alpha");
    const label = group.querySelector(".njin-alpha-value");
    const hidden = group.querySelector("input[type=hidden]");
    const sync = () => {
      hidden.value = joinColor(picker.value || "#000000", range.value);
      label.textContent = alphaLabel(Number(range.value));
    };
    for ( const el of [picker, range] ) {
      el.addEventListener("input", sync);
      el.addEventListener("change", sync);
    }
  }
}

/**
 * Read the style from the fields.
 * @param {HTMLFormElement|HTMLElement} root
 * @param {string} prefix
 * @returns {object}
 */
export function readStyle(root, prefix) {
  const style = {};
  for ( const key of STYLE_KEYS ) {
    const input = root.querySelector(`[name="${prefix}${key}"]`);
    if ( !input ) continue;
    style[key] = input.type === "checkbox" ? input.checked : input.value;
  }
  return style;
}

/**
 * Renders previews into an image, ignoring results that arrive after a newer request.
 */
export class IconPreview {
  /**
   * @param {HTMLElement} root  An element containing `.njin-preview img` and optionally `.njin-font-warning`.
   */
  constructor(root) {
    this.root = root;
  }

  #request = 0;

  #timeout = null;

  get img() {
    return this.root.querySelector(".njin-preview img");
  }

  get fontWarning() {
    return this.root.querySelector(".njin-font-warning");
  }

  /**
   * Show a generated icon. Debounced, since typing a font name fires many changes.
   * @param {object} style
   * @param {string} text
   */
  showIcon(style, text) {
    clearTimeout(this.#timeout);
    const request = ++this.#request;
    this.#timeout = setTimeout(async () => {
      const {src, fontFound} = await buildPreviewSrc(style, text);
      if ( request !== this.#request ) return;
      this.#setImage(src);
      if ( this.fontWarning ) this.fontWarning.hidden = fontFound;
    }, 250);
  }

  /**
   * Show a plain image, e.g. the stock icon chosen for the note.
   * @param {string} src
   */
  showImage(src) {
    clearTimeout(this.#timeout);
    this.#request++;
    this.#setImage(src);
    if ( this.fontWarning ) this.fontWarning.hidden = true;
  }

  #setImage(src) {
    const img = this.img;
    if ( !img ) return;
    img.hidden = !src;
    if ( src ) img.src = src;
    else img.removeAttribute("src");
  }
}
