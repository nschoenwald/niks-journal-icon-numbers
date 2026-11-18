import { MATCH_KEYS, debug, getSetting, warn } from "./constants.js";

/**
 * The built-in patterns, in the order they are tested. The last non-empty element of the match (the last capture
 * group, or the whole match if there is none) becomes the icon text.
 */
export const PATTERNS = {
  // A number followed by a single letter: "23G", but not "1st Floor".
  reg_num_alpha: /^\d{1,3}[a-zA-Z](?![a-zA-Z])/,
  reg_alpha_num: /^[a-zA-Z]\d{1,3}/,
  reg_num: /^\d{1,4}/,
  reg_alpha_space: /^([a-zA-Z]) /,
  reg_alpha_dot: /^([a-zA-Z])\./,
  reg_num_dot: /^(\d{1,4})\./
};

/** Read the current matching settings. */
export function getMatchSettings() {
  return Object.fromEntries(MATCH_KEYS.map(k => [k, getSetting(k)]));
}

/**
 * Build the list of regular expressions to test from matching settings.
 * @param {object} settings
 * @returns {{patterns: RegExp[], error: string|null}}
 */
export function buildPatterns(settings) {
  const patterns = [];
  for ( const [key, pattern] of Object.entries(PATTERNS) ) {
    if ( settings[key] ) patterns.push(pattern);
  }
  let error = null;
  const custom = settings.reg_custom?.trim();
  if ( custom ) {
    try {
      patterns.push(new RegExp(custom));
    } catch(err) {
      error = err.message;
    }
  }
  return {patterns, error};
}

/**
 * Find the icon text for a label.
 * @param {string} label
 * @param {object} [settings]  Matching settings. Defaults to the world settings.
 * @returns {string|null}
 */
export function matchLabel(label, settings) {
  if ( typeof label !== "string" || !label ) return null;
  const {patterns, error} = buildPatterns(settings ?? getMatchSettings());
  if ( error ) warn("Invalid custom name matching pattern:", error);
  for ( const pattern of patterns ) {
    const match = label.match(pattern);
    if ( !match ) continue;
    const result = [...match].reverse().find(m => m);
    debug("Matched", label, pattern, result);
    if ( result ) return result;
  }
  return null;
}
