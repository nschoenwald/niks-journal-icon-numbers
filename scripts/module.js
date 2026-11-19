import { DEFAULT_UPLOAD_PATH, LEGACY_ID, MODULE_ID, TEMPLATES, loc } from "./constants.js";
import MatchingConfig from "./apps/matching-config.js";
import RebuildIcons, { rebuildIcons } from "./apps/rebuild-icons.js";
import StyleConfig from "./apps/style-config.js";
import { migrateFromLegacy, migrateIconFiles } from "./migration.js";
import { onRenderNoteConfig } from "./note-config.js";
import { applyIcon, getNoteFlags, registerNoteHooks } from "./notes.js";
import { matchLabel } from "./matching.js";

CONFIG.debug.niksJournalIconNumbers ??= false;

function registerSettings() {
  const register = (key, data) => game.settings.register(MODULE_ID, key, {scope: "world", config: false, ...data});
  const setting = key => ({name: `NJIN.Settings.${key}.Name`, hint: `NJIN.Settings.${key}.Hint`});

  game.settings.registerMenu(MODULE_ID, "styleMenu", {
    ...setting("styleMenu"),
    label: "NJIN.Settings.styleMenu.Label",
    icon: "fa-solid fa-palette",
    type: StyleConfig,
    restricted: true
  });
  game.settings.registerMenu(MODULE_ID, "matchingMenu", {
    ...setting("matchingMenu"),
    label: "NJIN.Settings.matchingMenu.Label",
    icon: "fa-solid fa-hashtag",
    type: MatchingConfig,
    restricted: true
  });
  game.settings.registerMenu(MODULE_ID, "rebuildMenu", {
    ...setting("rebuildMenu"),
    label: "NJIN.Settings.rebuildMenu.Label",
    icon: "fa-solid fa-arrows-rotate",
    type: RebuildIcons,
    restricted: true
  });

  register("folderIcon", {...setting("folderIcon"), config: true, type: Boolean, default: true});
  register("autoPageImage", {...setting("autoPageImage"), config: true, type: Boolean, default: false});
  register("autoClose", {...setting("autoClose"), config: true, type: Boolean, default: false});
  register("uploadPath", {
    ...setting("uploadPath"), config: true, type: String, default: DEFAULT_UPLOAD_PATH, filePicker: "folder"
  });

  // Default style, set in the style menu
  register("iconType", {type: String, default: "circle"});
  register("foreColor", {type: String, default: "#000000ff"});
  register("backColor", {type: String, default: "#ffffff56"});
  register("fontFamily", {type: String, default: ""});
  register("fontBold", {type: Boolean, default: false});
  register("fontItalics", {type: Boolean, default: false});
  register("strokeWidth", {type: Number, default: 10});
  register("iconFontSize", {type: Number, default: 200});
  register("iconScale", {type: Number, default: 0.75});
  register("fontSize", {type: Number, default: 48});

  // Name matching, set in the matching menu
  register("reg_alpha_num", {type: Boolean, default: true});
  register("reg_num_alpha", {type: Boolean, default: true});
  register("reg_num", {type: Boolean, default: true});
  register("reg_alpha_space", {type: Boolean, default: false});
  register("reg_alpha_dot", {type: Boolean, default: false});
  register("reg_num_dot", {type: Boolean, default: false});
  register("reg_custom", {type: String, default: ""});

  register("legacyMigrated", {type: Boolean, default: false});
  register("iconFilesMigrated", {type: Boolean, default: false});
}

Hooks.once("init", () => {
  registerSettings();
  foundry.applications.handlebars.loadTemplates(Object.values(TEMPLATES));
  game.modules.get(MODULE_ID).api = {applyIcon, getNoteFlags, matchLabel, rebuildIcons};
});

Hooks.once("ready", async () => {
  // Both modules would fight over the same notes, each replacing the other's icon.
  if ( game.modules.get(LEGACY_ID)?.active ) {
    if ( game.user.isGM ) ui.notifications.warn(loc("Notifications.LegacyActive"), {permanent: true});
    return;
  }
  Hooks.on("renderNoteConfig", onRenderNoteConfig);
  registerNoteHooks();
  await migrateFromLegacy();
  await migrateIconFiles();
});
