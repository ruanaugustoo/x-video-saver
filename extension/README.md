# extension

Manifest V3 browser extension (Chrome and Edge) that detects videos on x.com and keeps a list of post links.

## Install (development)

1. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
2. **Load unpacked** and select this `extension/` folder.
3. Open x.com: posts with video get a **Save video** button over the player.

The popup lists the saved links and can copy them, download them as `videos-x.txt`, remove items, or switch on **Save automatically**. Put the exported file in `data/inbox/` for the downloader.

## What it stores and why links

X serves video as a `blob:` stream, so the file cannot be taken from the page. The extension saves the permanent link of the post, and yt-dlp resolves it later ([ADR 0003](../docs/decisions/0003-store-post-links-not-video-files.md)).

## Privacy

- Single permission: `storage`. It does not read cookies and makes no network requests.
- Runs only on x.com and twitter.com. Data stays in `chrome.storage.local`.

## Layout

```
manifest.json
src/
  content.js     detects <video>, finds the post link, injects the button
  background.js  service worker (ES module): validates and writes the list, one write at a time
  contract.js    the link contract (also checked against shared/fixtures)
  popup.js       popup logic (ES module)
ui/              popup.html, popup.css, content.css
test/            contract tests
```

No build step: the browser loads these files as they are ([ADR 0001](../docs/decisions/0001-no-build-step.md)).

## Known limitations

- A video inside a quoted post saves the link of the outer post.
- Depends on X's markup (`article`, `videoPlayer`, `tweetText`). If X changes it, adjust `content.js`.
- Chrome and Edge only for now ([ADR 0008](../docs/decisions/0008-chrome-and-edge-only-for-now.md)). No icons yet.

## Tests

```bash
npm test
```
