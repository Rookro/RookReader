# Changelog

[English](CHANGELOG.md) | [日本語](docs/ja_JP/CHANGELOG.md)

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.9.2] - 2026-02-22

### Changed

* Always enable the EPUB novel reader feature, removing it from experimental features (#135)

### Fixed

* Address Clippy warnings (#133)
* Fix an issue where some characters in the EPUB reader do not display in vertical writing when run on Linux (#134)
* Fix an issue where an error may be displayed due to a lack of runtime in a Windows environment (#136)

## [1.9.1] - 2026-02-15

### Changed

* Display a notification when an error occurs (#125)
* Resize large images to improve performance (#128)
* Display a preview (thumbnail image) while loading images (#129)
* Update dependencies (#130)

### Fixed

* Fix the page panel scroll behavior from `start` to `smart` (#126)
* Adjust the style of the navigation bar buttons to be square (#127)

## [1.9.0] - 2026-02-08

### Added

* Add a feature to close the left panel (#109)
* Support EPUB format archives (#110, #113, #117, #118)
* Allow changing the app's font (#120)

### Changed

* Prevent the left panel size from changing upon window resize (#111)
* Refactor Redux log output and history retrieval processes (#115)
* Introduce caching to GitHub Actions to reduce build time (#116, #119, #122)

### Fixed

* Fix a bug where some log settings were not reflected (#114)
* Fix a bug where the list may not scroll properly (#121)

## [1.8.0] - 2026-01-12

### Added

* Add a history feature (#98)
* Add a feature to toggle file update monitoring on/off (#100)

### Changed

* Change the design of the settings screen (#101)
* Introduce a linter and formatter to the frontend (#102)
* Update dependencies (#103)

### Fixed

* Fix to prevent unnecessary re-rendering (#104)
* Resolve the favicon error that occurs on Windows (#105)
* Handle cases where there is no country code in the language settings (#106)

## [1.7.1] - 2025-12-31

### Fixed

* Code refactoring (#90)
* Fix the tab order on the settings screen (#91)
* Improve the performance of image preloading (#92)

## [1.7.0] - 2025-12-13

### Changed

* Change the file navigator search to perform an AND search with space-separated characters (#85)
* Automatically update the file navigator display when a file is updated (#87)

### Fixed

* Fix an issue of freezing until loading is complete when a large file is loaded (#83)
* Fix an issue where image transfer is slow and takes time to display (#83)
* Appropriately set permissions for `build-app-actions` in GitHub Actions (#84)

## [1.6.0] - 2025-12-07

### Added

* Multi-language support (English, Japanese) (#71)
* Add a feature to change the home path in the file navigator (#73)
* Add a feature to display the first page as a single page (#77)

### Changed

* Improve PKGBUILD and change to download the deb file from GitHub Releases (#75)
* Add backend (Rust) unit tests (#76)
* Change the crate used for PDF rendering to [pdfium-render](https://crates.io/crates/pdfium-render) (#78)
* Update versions of Rust dependency libraries (#79)
* Change to perform page preloading on a separate thread (#80)

## [1.5.2] - 2025-11-28

### Added

* Allow changing the home directory in the file navigator (#73)

### Changed

* Change to hide unsupported extension files in the left pane list (#58)
* Change to display files in the archive in a natural order (#60)
* Design adjustments and code refactoring (#62)
  * Primarily use MUI components and specify styles with `sx` instead of CSS
  * Change comments and README to English
* Improve handling of third-party libraries (#63)
  * Change to download bundled libraries at build time
  * Bundle the license file and make it viewable from the About page
* Design scrollbars according to the theme (#64)
* Add a link to the project page on the About page (#65)
* Add simple usage instructions to the README (#66)

## [1.5.1] - 2025-11-23

### Changed

* Improve rendering performance when there are many items in the left pane list (#53)

### Fixed

* Improve the visibility of the hovered item's color in the left pane list during dark mode (#53)
* Fix a bug where an error may occur when changing a directory or archive file (#54)

## [1.5.0] - 2025-11-22

### Added

* Add a feature to open a directory as an archive (#44)
* Add a feature for developers to display the log directory path and open the log directory (#46)
* Add a sidebar to display a list of images in the archive (#48)
* Add a feature to set the height of PDF rendering images from the settings screen (#49)

### Changed

* Change to not display an outline when hovering over a button (#48)
* Change to persist the panel size (#50)

### Fixed

* Fix a bug where an error occurs when specifying an empty string in the `src` of an `img` tag (#48)

## [1.4.0] - 2025-11-13

### Added

* Add a feature to change the sort criteria and order in the file list (#38)

### Changed

* Change the file list to scroll to the position where the opened file is displayed (#40)
* Improve performance (#41)

### Fixed

* Fix a bug where the right-click menu does not open in the text input box (#39)
* Fix a bug where files are not selected in the file list when opened via drag-and-drop or path specification (#40)
* Fix a bug where returning to the previous page does not display the first page if the first page is landscape (#41)

## [1.3.4] - 2025-11-08

### Fixed

* Fix a bug where the slider is not displayed on Linux (#35)

## [1.3.3] - 2025-11-08

### Changed

* Make the width of the left pane resizable by dragging (#31)
* Update dependency library versions (#32)

### Fixed

* Fix the display position of "page number / total pages" shifting downwards (#31)

## [1.3.2] - 2025-10-12

### Changed

* Display icons in the file list to distinguish between files and directories (#25)
* Always display the file list in ascending alphabetical order (#26)

### Fixed

* Fix the issue where slider marks and tracks are misaligned in RTL display (#25)

## [1.3.1] - 2025-10-11

### Changed

* Make it installable via PKGBUILD (#22)

## [1.3.0] - 2025-10-08

### Added

* Add settings screen and settings file feature (#17)
* Support RAR format archives (#19)

### Fixed

* Fix a bug where page navigation after automatic two-page spread display goes to an unintended page (#16)
* Suppress the display of the context menu (#18)

## [1.2.0] - 2025-09-23

### Added

* Add a feature to navigate pages with arrow keys (#11)
* Add a search feature (#12)
* Add back/forward (history) features (#13)

## [1.1.0] - 2025-09-22

### Added

* Add an image preload feature (#8)

## [1.0.0] - 2025-09-20

### Added

* Add an image viewer feature (#1)
* Add a logging feature (#2)
* Implement a PDF viewer feature (#3)
* Add an automatic two-page spread display feature (#4)
* Add a page navigation feature using the mouse wheel up/down (#5)

[unreleased]: https://github.com/Rookro/RookReader/compare/v1.9.2...HEAD
[1.9.2]: https://github.com/Rookro/RookReader/compare/v1.9.1...v1.9.2
[1.9.1]: https://github.com/Rookro/RookReader/compare/v1.9.0...v1.9.1
[1.9.0]: https://github.com/Rookro/RookReader/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/Rookro/RookReader/compare/v1.7.1...v1.8.0
[1.7.1]: https://github.com/Rookro/RookReader/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/Rookro/RookReader/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/Rookro/RookReader/compare/v1.5.2...v1.6.0
[1.5.2]: https://github.com/Rookro/RookReader/compare/v1.5.1...v1.5.2
[1.5.1]: https://github.com/Rookro/RookReader/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/Rookro/RookReader/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/Rookro/RookReader/compare/v1.3.4...v1.4.0
[1.3.4]: https://github.com/Rookro/RookReader/compare/v1.3.3...v1.3.4
[1.3.3]: https://github.com/Rookro/RookReader/compare/v1.3.2...v1.3.3
[1.3.2]: https://github.com/Rookro/RookReader/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/Rookro/RookReader/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/Rookro/RookReader/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/Rookro/RookReader/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Rookro/RookReader/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Rookro/RookReader/releases/tag/v1.0.0
