# Smart Video Viewer

English · [简体中文](README.md)

<img src="design/focus-optical-2026-10-06/approved-raster/icon-512.png" width="88" height="88" alt="Focus icon: four framing corners and a play triangle">

Focus on web video in Safari: center and enlarge the existing player, dim the page, adjust playback speed, and seek by a configurable interval. You can also request playback in IINA.

**Current source version: 2.0.7 (unreleased).** The extension and companion app retain the name **Smart Open in IINA**. This independent project is not affiliated with Apple or IINA and does not call private Safari Video Viewer APIs.

## Features

- In-page viewing that preserves the original video element and playback position, with horizontal and vertical centering.
- Playback speed from 0.1–16×. Slider, spinner and keyboard increments are 0.1×; the numeric field also accepts other values.
- Configurable seeking from 0.1–600 seconds; the default is 5 seconds.
- A glass-style console that hides automatically and reappears only when the pointer returns to its area. Keyboard shortcuts do not reveal it.
- Click the picture to play/pause; click outside it or press Esc to exit.
- Video discovery in authorized cross-origin frames and open Shadow DOM.
- Open-in-IINA, native picture-in-picture and fullscreen controls.

The console uses CSS, not native Liquid Glass components. The current interface is primarily in Chinese; this English README does not imply an English UI is available.

## Source additions (not yet released)

- Choose site defaults, turn subtitles off, or select a language from standard text tracks, including dynamically loaded WebVTT.
- Import UTF-8 SRT / VTT files up to 5 MB for the current viewing session; imported tracks are removed on exit. The extension does not upload subtitles, but page scripts may read tracks attached to their player.
- Media collection, pausing and embedded-frame lookup now share open Shadow DOM discovery. Let the original page load its video first and grant access to embedded player domains.

These changes are not included in the existing v2.0.6 downloads below. Standard subtitle interactions have been checked with synthetic local video; full playback compatibility with real sites in Safari remains unverified. Custom subtitle overlays, closed players and failed subtitle sources are not guaranteed to work. Site content security policy may also block local subtitle loading.

## Get and build

A [v2.0.6 preview DMG / ZIP](https://github.com/Lunomakes/smart-video-viewer/releases/tag/v2.0.6) is available for **Apple Silicon only**. It is ad-hoc signed and unnotarized, requires Safari development-testing setup, and is not guaranteed to run immediately after download. See the [installation guide](docs/INSTALL.md). No Developer ID distribution build or App Store version is available.

Alternatively, build from source:

You need macOS, Safari and Xcode. The deployment target is macOS 12.0, not a fully tested compatibility guarantee: validation has primarily used the maintainer’s macOS 27 / Safari environment. Older versions have not received full device coverage. IINA is optional unless you use external playback.

1. Clone and open the project:

   ```sh
   git clone https://github.com/Lunomakes/smart-video-viewer.git
   cd smart-video-viewer
   open "Smart Video Viewer/Smart Open in IINA.xcodeproj"
   ```

2. Select your own Signing Team for both the app and extension targets in Xcode. Adjust both bundle identifiers if Xcode reports a conflict. The project retains local development settings; you need your own valid signing configuration.
3. Select the **Smart Open in IINA** scheme and **My Mac**, then build and run.
4. Open Safari extension settings from the companion app, enable **Smart Open in IINA**, and grant access only to the websites you want to use.
5. Refresh an existing video page, let its player load, click the toolbar icon, select a video, and enter the viewer. Cross-origin players also need permission for the embedded domain.

See Apple’s [creation guide](https://developer.apple.com/documentation/safariservices/creating-a-safari-web-extension) and [distribution guide](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension) for signing and distribution.

## Keyboard shortcuts

These apply to the in-page viewer. Text-field editing and system modifier shortcuts are excluded.

| Key | Action |
| --- | --- |
| ← / J, → / L | Seek backward / forward by N seconds |
| Space / K | Play / pause |
| [ / ] | Decrease / increase speed by 0.1× |
| R | Reset to 1× |
| M | Toggle mute |
| F | Native fullscreen |
| Esc | Exit the viewer |

Exiting restores the previous page layout, native controls and playback speed. Configure defaults in the popup; adjust current playback in the console. The [detailed usage guide](Smart%20Video%20Viewer/Smart%20Open%20in%20IINA%20Extension/Resources/README.md) is currently in Chinese.

## Permissions and privacy

The extension requests website access, tabs, frame navigation, request observation, local settings storage and native messaging to discover videos, coordinate embedded players and launch IINA. `<all_urls>` supports different websites; Safari’s permission settings still determine actual access.

The current code includes no analytics, advertising SDK or developer-operated upload service. Preferences are local. Captured media URLs remain in background memory, are cleared on navigation and disappear when the process ends; signed URLs are not persisted. Choosing IINA passes the selected media URL to the local app, which may access the corresponding media server. See [Privacy](PRIVACY.md).

## Limitations

- No bypass of DRM, paywalls or website authorization. Cookie-, Referer- or signature-dependent streams may fail in IINA.
- A successful IINA launch request does not confirm successful playback.
- Closed Shadow DOM, canvas players and sites that replace video elements may be incompatible. Site-rendered subtitles, comments and menus outside the video element are not extracted.
- The browser and media determine effective rate support. Extreme rates may mute audio, stall playback or be reset by the website.
- Safari manages native fullscreen and picture-in-picture; custom controls and shortcuts may not apply there.
- No Chrome, Firefox, iOS or iPadOS installation packages are provided.

## Development and verification

Run the dependency-free checks with Node.js 22 or later:

```sh
node scripts/check.mjs
node scripts/privacy-check.mjs
node --test "Smart Video Viewer/tests/"*.test.mjs
```

[GitHub Actions](.github/workflows/checks.yml) runs on pushes to main and pull requests, and can be triggered manually under Actions → Checks → Run workflow. The checks cover script syntax, resource references, version consistency and background regressions. **They do not replace real Safari end-to-end verification.** See [Development](docs/DEVELOPMENT.md) for builds and manual checks.

## Repository layout

```text
Smart Video Viewer/     Xcode project, extension, companion app and checks
design/                 Icon proposals, approved artwork and raster masters
scripts/                Reproducible static checks
.github/                Issue templates and PR template
```

[Contributing](CONTRIBUTING.md) · [Code of conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md) · [Release checklist](docs/RELEASING.md)

## Credits

**代码由 Codex 和色批驱动力完成。**  
Code by Codex, powered by horny motivation.

## License

This project is open source under the [MIT License](LICENSE). Use, modification, commercial use and redistribution are permitted with the copyright and permission notice retained. The software is provided as is, without warranty. See [licensing and provenance](docs/LICENSING.md).
