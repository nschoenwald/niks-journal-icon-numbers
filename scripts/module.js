import { DEFAULT_UPLOAD_PATH, LEGACY_ID, MODULE_ID, TEMPLATES, loc } from "./constants.js";
import FolderIconsConfig from "./apps/folder-icons-config.js";
import MatchingConfig from "./apps/matching-config.js";
import RebuildIcons, { rebuildIcons } from "./apps/rebuild-icons.js";
import StyleConfig from "./apps/style-config.js";
import { migrateCompendiumIcons, migrateFromLegacy, migrateIconFiles } from "./migration.js";
import { onRenderNoteConfig } from "./note-config.js";
import { applyIcon, applyPendingIcons, getNoteFlags, registerNoteHooks } from "./notes.js";
import { matchLabel } from "./matching.js";
import { registerRenameHooks } from "./renames.js";

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
  game.settings.registerMenu(MODULE_ID, "folderIconsMenu", {
    ...setting("folderIconsMenu"),
    label: "NJIN.Settings.folderIconsMenu.Label",
    icon: "fa-solid fa-folder-tree",
    type: FolderIconsConfig,
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
  register("followRenames", {...setting("followRenames"), config: true, type: Boolean, default: true});
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
  register("autoFit", {type: Boolean, default: true});
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

  // Folder names mapped to stock icons. Stored in an object: Foundry would wrap a plain array in another array.
  register("folderIcons", {type: Object, default: {rows: []}});

  register("legacyMigrated", {type: Boolean, default: false});
  register("iconFilesMigrated", {type: Boolean, default: false});
  register("compendiumFilesMigrated", {type: Boolean, default: false});
}

Hooks.once("init", () => {
  registerSettings();
  foundry.applications.handlebars.loadTemplates(Object.values(TEMPLATES));
  game.modules.get(MODULE_ID).api = {applyIcon, getNoteFlags, matchLabel, migrateCompendiumIcons, rebuildIcons};
});

Hooks.once("ready", async () => {
  // Both modules would fight over the same notes, each replacing the other's icon.
  if ( game.modules.get(LEGACY_ID)?.active ) {
    if ( game.user.isGM ) ui.notifications.warn(loc("Notifications.LegacyActive"), {permanent: true});
    return;
  }
  Hooks.on("renderNoteConfig", onRenderNoteConfig);
  registerNoteHooks();
  registerRenameHooks();
  await migrateFromLegacy();
  await migrateIconFiles();
  await migrateCompendiumIcons();
  await applyPendingIcons();
});
