import { MODULE_ID, STYLE_KEYS, debug, getSetting } from "./constants.js";
import { buildSVG, normalizeStyle } from "./icon-svg.js";

const FilePicker = () => foundry.applications.apps.FilePicker.implementation;

/**
 * Files known to exist in the upload folder, by folder: relative path → path or URL to use as texture.
 * Filled on first use, cleared by the rebuild.
 */
const knownFiles = new Map();

/** Icons being generated right now, by file path, so parallel requests for the same icon upload it once. */
const pending = new Map();

/** Can the current user create icon files? */
export function canUpload(user=game.user) {
  return user.can("FILES_UPLOAD") && user.can("FILES_BROWSE");
}

/** Forget which files exist, so the next icon request checks the folder again. */
export function clearFileCache() {
  knownFiles.clear();
}

function fileSource() {
  return globalThis.ForgeVTT?.usingTheForge ? "forgevtt" : "data";
}

function uploadFolder() {
  const path = String(getSetting("uploadPath") || `upload/${MODULE_ID}`).trim();
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "") || `upload/${MODULE_ID}`;
}

/** A short, stable hash of a string (FNV-1a, 32 bit). */
function hash(str) {
  let h = 0x811c9dc5;
  for ( let i = 0; i < str.length; i++ ) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * The file name of an icon: a hash of everything that changes how it looks, plus the text for readability.
 * The hash also keeps "1a" and "1A" apart on file systems that ignore case.
 * @param {object} style  A normalized style.
 * @param {string} text
 */
function iconFilename(style, text) {
  const key = JSON.stringify([text, ...STYLE_KEYS.map(k => style[k])]);
  const readable = text.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 16);
  return `${hash(key)}_${readable}.svg`;
}

/**
 * List the files in the upload folder, creating the folder if it doesn't exist.
 * @param {string} source
 * @param {string} folder
 * @returns {Promise<Map<string, string>>}
 */
async function listFolder(source, folder) {
  if ( knownFiles.has(folder) ) return knownFiles.get(folder);
  let files;
  try {
    const result = await FilePicker().browse(source, folder);
    files = new Map(result.files.map(f => [normalizePath(f), f]));
  } catch(err) {
    debug("Upload folder not found, creating it", folder, err);
    await createFolders(source, folder);
    files = new Map();
  }
  knownFiles.set(folder, files);
  return files;
}

/** Strip the host and Forge's asset prefix from a file URL so it can be compared with a relative path. */
function normalizePath(file) {
  let path = file;
  try {
    if ( /^https?:\/\//.test(file) ) path = new URL(file).pathname.split("/").slice(2).join("/");
  } catch(err) { /* Not a URL */ }
  try {
    path = decodeURIComponent(path);
  } catch(err) { /* Not encoded */ }
  return path.replace(/^\/+/, "");
}

async function createFolders(source, folder) {
  let path = "";
  for ( const part of folder.split("/") ) {
    path = path ? `${path}/${part}` : part;
    try {
      await FilePicker().createDirectory(source, path, {});
    } catch(err) {
      if ( !String(err?.message ?? err).includes("EEXIST") ) debug("Could not create folder", path, err);
    }
  }
}

/**
 * Make sure the icon for a style and text exists in the upload folder.
 * @param {object} style
 * @param {string} text
 * @returns {Promise<string|null>}  The file path to use as the note's texture, or null if there is no text.
 */
export async function ensureIcon(style, text) {
  text = String(text ?? "").trim();
  if ( !text ) return null;
  style = normalizeStyle(style);
  const source = fileSource();
  const folder = uploadFolder();
  const filename = iconFilename(style, text);
  const path = `${folder}/${filename}`;
  if ( pending.has(path) ) return pending.get(path);

  const promise = (async () => {
    const files = await listFolder(source, folder);
    if ( files.has(path) ) return files.get(path);
    const {svg} = await buildSVG(style, text);
    const file = new File([svg], filename, {type: "image/svg+xml"});
    const result = await FilePicker().upload(source, folder, file, {}, {notify: false});
    if ( !result?.path ) throw new Error(`Upload of ${path} failed`);
    files.set(path, result.path);
    debug("Uploaded icon", result.path);
    return result.path;
  })();
  pending.set(path, promise);
  try {
    return await promise;
  } finally {
    pending.delete(path);
  }
}
