import { ICON_TYPES, STYLE_KEYS, debug, getSetting, warn } from "./constants.js";

const SIZE = 512;
const STOCK_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** The world default style. */
export function getDefaultStyle() {
  return Object.fromEntries(STYLE_KEYS.map(k => [k, getSetting(k)]));
}

/**
 * Bring a style object into a safe, canonical shape. Unknown or broken values fall back to the world defaults.
 * @param {object} style
 * @returns {object}
 */
export function normalizeStyle(style={}) {
  const defaults = getDefaultStyle();
  const num = (v, d, min, max) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.clamp(n, min, max) : d;
  };
  const color = (v, d) => (typeof v === "string") && HEX_COLOR.test(v.trim()) ? v.trim().toLowerCase() : d;
  return {
    iconType: style.iconType in ICON_TYPES ? style.iconType : defaults.iconType,
    foreColor: color(style.foreColor, defaults.foreColor),
    backColor: color(style.backColor, defaults.backColor),
    fontFamily: typeof style.fontFamily === "string" ? style.fontFamily.trim() : defaults.fontFamily,
    fontBold: !!(style.fontBold ?? defaults.fontBold),
    fontItalics: !!(style.fontItalics ?? defaults.fontItalics),
    strokeWidth: num(style.strokeWidth, defaults.strokeWidth, 0, 100),
    iconFontSize: num(style.iconFontSize, defaults.iconFontSize, 10, 500),
    autoFit: !!(style.autoFit ?? defaults.autoFit)
  };
}

/* -------------------------------------------- */
/*  Colors                                      */
/* -------------------------------------------- */

/**
 * Split a #rrggbb[aa] color into the RGB part and an opacity between 0 and 1.
 * @param {string} value
 * @returns {{rgb: string, alpha: number}}
 */
export function splitColor(value) {
  let hex = (typeof value === "string") && HEX_COLOR.test(value) ? value.slice(1) : "000000";
  if ( hex.length <= 4 ) hex = [...hex].map(c => c + c).join("");
  const alpha = hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1;
  return {rgb: `#${hex.slice(0, 6)}`.toLowerCase(), alpha: Math.round(alpha * 100) / 100};
}

/**
 * Combine an RGB color and an opacity into #rrggbbaa.
 * @param {string} rgb
 * @param {number} alpha
 * @returns {string}
 */
export function joinColor(rgb, alpha) {
  const {rgb: base} = splitColor(rgb);
  const a = Math.round(Math.clamp(Number(alpha) || 0, 0, 1) * 255);
  return `${base}${a.toString(16).padStart(2, "0")}`;
}

/* -------------------------------------------- */
/*  Shapes                                      */
/* -------------------------------------------- */

const escapeXML = str => String(str)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function shapeStyle(fill, stroke, width) {
  return `fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-miterlimit="10"`;
}

function hexPoints(width) {
  const r = (SIZE - width) / 2;
  const x1 = 0.27 * r / 2;
  const x2 = (1.73 * r / 2) + (0.27 * r / 2);
  const x3 = (1.73 * r) + (0.27 * r / 2);
  return {x1, x2, x3, y0: 0, y1: r / 2, y2: 3 * r / 2, y3: 2 * r};
}

const SHAPES = {
  circle: (fill, stroke, w) => {
    return `<circle ${shapeStyle(fill, stroke, w)} cx="${SIZE / 2}" cy="${SIZE / 2}" r="${(SIZE - w) / 2}"/>`;
  },
  square: (fill, stroke, w) => {
    return `<rect ${shapeStyle(fill, stroke, w)} x="${w / 2}" y="${w / 2}" width="${SIZE - w}" height="${SIZE - w}"/>`;
  },
  diamond: (fill, stroke, w) => {
    const radius = 20;
    const side = ((SIZE - w) / 1.4) + (0.4 * radius);
    const offset = (-0.4 * radius) + (w / 2);
    return `<rect ${shapeStyle(fill, stroke, w)} x="0" y="0" width="${side}" height="${side}" ry="${radius}" `
      + `transform="translate(${SIZE / 2},${offset}) rotate(45)"/>`;
  },
  hexh: (fill, stroke, w) => {
    const {x1, x2, x3, y0, y1, y2, y3} = hexPoints(w);
    const points = `${x2},${y0} ${x3},${y1} ${x3},${y2} ${x2},${y3} ${x1},${y2} ${x1},${y1}`;
    return `<polygon ${shapeStyle(fill, stroke, w)} points="${points}"/>`;
  },
  hexv: (fill, stroke, w) => {
    const {x1, x2, x3, y0, y1, y2, y3} = hexPoints(w);
    const points = `${y0},${x2} ${y1},${x3} ${y2},${x3} ${y3},${x2} ${y2},${x1} ${y1},${x1}`;
    return `<polygon ${shapeStyle(fill, stroke, w)} points="${points}"/>`;
  },
  none: () => ""
};

/* -------------------------------------------- */
/*  Google Fonts                                */
/* -------------------------------------------- */

/** Embedded font CSS by family, variant and text. A null entry means the font could not be loaded. */
const fontCache = new Map();

/**
 * The CSS2 API axis string for a variant.
 * @param {boolean} bold
 * @param {boolean} italic
 */
function variantAxis(bold, italic) {
  if ( bold && italic ) return ":ital,wght@1,700";
  if ( italic ) return ":ital@1";
  if ( bold ) return ":wght@700";
  return "";
}

async function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetch a Google font subset that contains only the given characters, with the font files inlined as data URLs.
 * @param {string} family
 * @param {boolean} bold
 * @param {boolean} italic
 * @param {string} text
 * @returns {Promise<{css: string|null, status: "ok"|"missing"|"unavailable"}>}  "missing": Google doesn't have this
 *   font or variant. "unavailable": Google or the network failed, so the font may well exist.
 */
async function fetchFontCSS(family, bold, italic, text) {
  const key = JSON.stringify([family, bold, italic, text]);
  if ( fontCache.has(key) ) return fontCache.get(key);
  const promise = (async () => {
    const familyParam = encodeURIComponent(family).replace(/%20/g, "+");
    const url = `https://fonts.googleapis.com/css2?family=${familyParam}${variantAxis(bold, italic)}`
      + `&text=${encodeURIComponent(text)}`;
    try {
      const response = await fetch(url);
      if ( !response.ok ) {
        return {css: null, status: [400, 404].includes(response.status) ? "missing" : "unavailable"};
      }
      let css = await response.text();
      const urls = [...new Set(css.match(/https:\/\/[^)'"\s]+/g) ?? [])];
      for ( const fontURL of urls ) {
        const fontResponse = await fetch(fontURL);
        if ( !fontResponse.ok ) return {css: null, status: "unavailable"};
        css = css.replaceAll(fontURL, await blobToDataURL(await fontResponse.blob()));
      }
      return {css, status: "ok"};
    } catch(err) {
      warn(`Could not load the font "${family}" from Google Fonts.`, err);
      return {css: null, status: "unavailable"};
    }
  })();
  fontCache.set(key, promise);
  const result = await promise;
  if ( result.status === "unavailable" ) fontCache.delete(key); // Try again next time
  return result;
}

/**
 * Resolve the font to embed for a style. Falls back to the regular variant if the requested one doesn't exist, and to
 * the stock font if the family can't be loaded at all.
 * @param {object} style
 * @param {string} text
 * @returns {Promise<{css: string, family: string, bold: boolean, italic: boolean, found: boolean,
 *   unavailable: boolean}>}  `unavailable`: the font couldn't be checked because Google or the network failed.
 */
async function resolveFont(style, text) {
  const family = style.fontFamily;
  const stock = {css: "", family: "", bold: style.fontBold, italic: style.fontItalics};
  if ( !family ) return {...stock, found: true, unavailable: false};
  const variants = [[style.fontBold, style.fontItalics]];
  if ( style.fontBold && style.fontItalics ) variants.push([true, false], [false, true]);
  if ( style.fontBold || style.fontItalics ) variants.push([false, false]);
  for ( const [bold, italic] of variants ) {
    const {css, status} = await fetchFontCSS(family, bold, italic, text);
    if ( status === "ok" ) return {css, family, bold, italic, found: true, unavailable: false};
    if ( status === "unavailable" ) return {...stock, found: false, unavailable: true};
  }
  return {...stock, found: false, unavailable: false};
}

/* -------------------------------------------- */
/*  Fitting text to the shape                   */
/* -------------------------------------------- */

/** Space kept between the text and the border. */
const FIT_MARGIN = 16;

/** Height of digits and capitals relative to the font size. */
const CAP_HEIGHT = 0.75;

/** Extra room for machines that draw the default font a little wider than the one that made the icon. */
const FIT_SAFETY = 1.04;

/**
 * The width available inside a shape for centered text of a given height.
 * @param {string} type    The shape.
 * @param {number} stroke  The border width.
 * @param {number} height  The text height.
 * @returns {number}
 */
function availableWidth(type, stroke, height) {
  const y = height / 2;
  const r = (SIZE - stroke) / 2;
  switch ( type ) {
    case "circle": {
      const inner = (SIZE / 2) - stroke - FIT_MARGIN;
      return y < inner ? 2 * Math.sqrt((inner ** 2) - (y ** 2)) : 0;
    }
    case "square": {
      const inner = (SIZE / 2) - stroke - FIT_MARGIN;
      return y < inner ? 2 * inner : 0;
    }
    case "diamond":
      return Math.max(2 * ((SIZE / 2) - (stroke * 0.75) - FIT_MARGIN - y), 0);
    case "hexh": { // Points at the top and bottom
      const inner = (0.865 * r) - (stroke / 2) - FIT_MARGIN;
      if ( y <= r / 2 ) return 2 * inner;
      return Math.max(2 * inner * (r - stroke - y) / (r / 2), 0);
    }
    case "hexv": { // Points on the left and right
      const top = (0.865 * r) - (stroke / 2) - FIT_MARGIN;
      if ( y >= top ) return 0;
      return Math.max(2 * (r - (stroke * 0.6) - FIT_MARGIN - (0.578 * y)), 0);
    }
    default:
      return SIZE - (2 * FIT_MARGIN);
  }
}

let measureContext;
let measureId = 0;

/**
 * The width of a text relative to its font size, in the font it will be drawn with.
 * @param {string} text
 * @param {{css: string, bold: boolean, italic: boolean}} font
 * @returns {Promise<number|null>}  Null if the text can't be measured.
 */
async function measureText(text, font) {
  let face;
  try {
    measureContext ??= document.createElement("canvas").getContext("2d");
    let family = STOCK_FONT;
    const url = font.css?.match(/url\((['"]?)(data:[^)'"]+)\1\)/)?.[2];
    if ( url ) {
      family = `njin-measure-${++measureId}`;
      face = new window.FontFace(family, `url(${url})`);
      await face.load();
      document.fonts.add(face);
      family = `"${family}"`;
    }
    measureContext.font = `${font.italic ? "italic " : ""}${font.bold ? 700 : 400} 100px ${family}`;
    return measureContext.measureText(text).width / 100;
  } catch(err) {
    warn("Could not measure the icon text.", err);
    return null;
  } finally {
    if ( face ) document.fonts.delete(face);
  }
}

/**
 * The largest font size up to the chosen one at which the text fits inside the shape. Never enlarges the text.
 * @param {object} style  A normalized style.
 * @param {string} text
 * @param {object} font   The resolved font.
 * @returns {Promise<number>}
 */
async function fittedFontSize(style, text, font) {
  const size = style.iconFontSize;
  if ( !style.autoFit || !text ) return size;
  const ratio = await measureText(text, font);
  if ( !ratio ) return size;
  const stroke = style.iconType === "none" ? 0 : style.strokeWidth;
  const fits = s => (ratio * FIT_SAFETY * s) <= availableWidth(style.iconType, stroke, CAP_HEIGHT * s);
  if ( fits(size) ) return size;
  let low = Math.min(10, size);
  let high = size;
  while ( (high - low) > 0.5 ) {
    const mid = (low + high) / 2;
    if ( fits(mid) ) low = mid;
    else high = mid;
  }
  return Math.floor(low);
}

/* -------------------------------------------- */
/*  SVG                                         */
/* -------------------------------------------- */

/**
 * Build the SVG markup of an icon.
 * @param {object} style  A style object, see STYLE_KEYS.
 * @param {string} text   The icon text.
 * @returns {Promise<{svg: string, fontFound: boolean, fontUnavailable: boolean}>}
 */
export async function buildSVG(style, text) {
  style = normalizeStyle(style);
  text = String(text ?? "");
  const font = text ? await resolveFont(style, text) : {css: "", family: "", found: true, unavailable: false};
  const strokeWidth = style.iconType === "none" ? 0 : style.strokeWidth;
  const shape = SHAPES[style.iconType](style.backColor, style.foreColor, strokeWidth);
  const fontFamily = font.family ? `'${font.family.replace(/'/g, "")}', ${STOCK_FONT}` : STOCK_FONT;
  const fontSize = await fittedFontSize(style, text, font);
  const defs = font.css ? `<defs><style>${escapeXML(font.css)}</style></defs>` : "";
  const label = text
    ? `<text x="50%" y="50%" dy=".3em" text-anchor="middle" fill="${style.foreColor}" `
      + `font-family="${escapeXML(fontFamily)}" font-size="${fontSize}" `
      + `font-weight="${font.bold ? 700 : 400}" font-style="${font.italic ? "italic" : "normal"}">`
      + `${escapeXML(text)}</text>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="128" height="128" `
    + `style="shape-rendering:geometricPrecision;text-rendering:geometricPrecision">${defs}<g>${shape}${label}</g></svg>`;
  debug("Built SVG", text, style);
  return {svg, fontFound: font.found, fontUnavailable: font.unavailable};
}

/**
 * Build an icon as a data URL, for previews.
 * @param {object} style
 * @param {string} text
 * @returns {Promise<{src: string, fontFound: boolean}>}
 */
export async function buildPreviewSrc(style, text) {
  const {svg, fontFound} = await buildSVG(style, text);
  return {src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, fontFound};
}
