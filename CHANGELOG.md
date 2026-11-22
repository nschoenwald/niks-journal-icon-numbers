# Changelog

All notable changes to this project will be documented in this file.

## [14.2.0] - 2026-11-22

### Added
- **Fit Text to Shape:** long icon text now shrinks to fit inside circles, diamonds, hexagons and squares. It's on by default and can be turned off in the style settings or per note. Existing icons change the next time they're saved or rebuilt.
- **Follow Journal Renames:** renaming "12 Tavern" to "14 Tavern" updates its map notes. Icon text you typed yourself stays. A GM has to be connected.
- **Folder Icons:** choose a stock icon for any journal folder name, for example "Dorf" for the Village icon.

### Changed
- Name matching now works with letters of any alphabet, so "Ü3 Keller" gets an icon.
- Numbers that are too long no longer get cut off: "12345 Gate" gets no automatic icon instead of "1234".

## [14.1.1] - 2026-11-22

### Fixed
- **Small grids:** new notes and **Rebuild Icons** no longer fail on scenes with a grid under 43 pixels. Icons now stay at Foundry's minimum of 32 pixels.
- **Google Fonts outages:** an icon made while Google Fonts is unreachable no longer stays on the default font for good. You get a warning, and **Rebuild Icons** adds the right font later. This also repairs icons affected in earlier versions.
- **Compendium scenes:** the move to the new icon folder now includes unlocked Scene compendiums. A warning names any locked compendium that still needs the old folder.
- **Players without a GM online:** players without upload rights are told when an icon has to wait, and it's created when a GM joins.
- **Quick changes:** changing a note twice in a row can no longer leave the older icon on it, and deleting a note while its icon is saving no longer shows an error.
- **Icons from Folders** now always matches Foundry's English stock icon names, in every language.

## [14.1.0] - 2026-11-19

### Changed
- Icon images are now saved in `assets/niks-journal-icon-numbers` in your user data by default, instead of `upload/niks-journal-icon-numbers`.

### Added
- **Icon images move along when you switch.** The first time a GM loads the world after this update, the icon images of map notes are copied from the old folders (Automatic Journal Icon Numbers' upload folder and `upload/niks-journal-icon-numbers`) into the new folder, and the notes use the copies. Images that are missing are created again from the note's settings. The old files stay where they are; you can delete them afterwards.

## [14.0.0] - 2026-11-18

First release of Nik's Journal Icon Numbers, a fork of Automatic Journal Icon Numbers 1.10.2 by Chris Flanagan.

### Changed
- **Foundry V14 and D&D 5e 6.1 only.** Support for older versions is gone.
- **No more lib - ColorSettings.** Colors use Foundry's own color picker, with an opacity slider next to it.
- **Font by name.** Type the name of any Google font instead of picking it from a long list. The preview warns you if
  the font can't be found. Fonts are only downloaded when an icon needs them, not every time the world loads.
- **New settings windows** for the default style, name matching and rebuilding icons, with live previews. The name
  matching window shows which icon text a sample name gets.
- **Rebuild Icons** is now a button in the settings that opens a small window, instead of a dropdown.

### Fixed
- Moving a map note no longer shows a "file saved" message with the icon's file name to the GM and players.
- The module no longer breaks when Google Fonts can't be reached: settings were missing and map notes couldn't be
  configured.
- Bold and italic fonts now really show as bold or italic in the icon.
- Icon text with characters like `&` or `<` no longer produces broken images.
- Names like "1st Floor" get "1" instead of "1s"; "Numbers and a period" shows "12" instead of "12.".
- An invalid custom pattern no longer breaks the Map Note window; the matching window shows the error.
- Opening the Map Note window of an existing note no longer resets its icon size and label size.
- The automatic icon section now works in every open Map Note window, not just the first one.
- For a new note, the icon text updates when you pick a different journal entry, page or label.
- "Icons from Image Pages" uses the note's own image page or the first image page in page order.
- Several players with upload rights no longer create the same icon at the same time; only the player who made the
  change does, or the GM for players without upload rights.
- Rebuild Icons shows its progress again and recreates images that were deleted.

### Added
- Settings and note icons of Automatic Journal Icon Numbers are copied over once when you switch.
- German translation. The other translations of the original module are not included.
