# 0008. Chrome and Edge only, for now

## Context

The extension uses Manifest V3 with an ES module service worker (`background.type: "module"`), which Chromium browsers support. As far as we know, Firefox expects a different background setup (event page scripts) and an extension id in the manifest.

## Decision

Target Chrome and Edge. Other browsers can come in a later version.

## Consequences

- One manifest, no per-browser build ([ADR 0001](0001-no-build-step.md)).
- The extension and the browser used for cookies ([ADR 0005](0005-cookies-via-firefox-or-cookies-file.md)) can be different browsers.
- Adding Firefox later means adjusting the manifest and checking the code against Firefox's extension APIs.
