# Architecture

x-video-saver has two independent halves that meet at a plain text file.

```
┌────────────────────────┐       videos-x.txt        ┌──────────────────────────┐
│ extension/             │  ───────────────────────► │ downloader/              │
│ (browser, Chrome/Edge) │   (list contract, v1)     │ (Node CLI + yt-dlp)      │
└────────────────────────┘                           └──────────────────────────┘
        stores links                                   validates, downloads, resumes
```

## Components

**Extension** (`extension/`)

- `content.js` runs on x.com. A `MutationObserver` watches the page (X is a single-page app with infinite scroll), finds `<video>` elements inside posts, reads the post link from the post's timestamp, and injects a save button.
- `background.js` is the only writer of the list. Messages arrive one at a time through a queue, are validated against the contract, and stored in `chrome.storage.local`.
- `popup.js` shows the list and exports it.

**Downloader** (`downloader/`)

- `download.mjs` orchestrates: verify the list, check dependencies, download one link at a time, retry, stop on repeated failures, summarize.
- `config.mjs`, `parse-list.mjs`, `classify-error.mjs`, `filename.mjs`, `state.mjs` are small modules with one job each and unit tests.

## List contract (v1)

The only interface between the two halves.

- UTF-8 text, one post link per line. Blank lines and lines starting with `#` are ignored.
- A valid link is `http(s)://[www.|mobile.]x.com|twitter.com/<handle>/status/<id>` with an optional path, query or fragment after the id. The handle is 1 to 15 word characters; the id is digits.
- The downloader normalizes every link to `https://x.com/<handle>/status/<id>` and removes duplicates by id.
- Known gap: `x.com/i/web/status/<id>` links are not supported in v1.

Both sides implement the contract separately and are tested against the same cases in [`shared/fixtures/urls.json`](../shared/fixtures/urls.json) ([ADR 0002](decisions/0002-shared-fixtures-instead-of-shared-code.md)).

## Data

Everything personal lives under `data/`, ignored by git ([ADR 0006](decisions/0006-data-directory-and-file-naming.md)):

```
data/
├── inbox/       lists exported from the extension
├── state/       archive.txt (yt-dlp's memory of what it downloaded), failed.txt
└── downloads/   videos
```

`state.mjs` is the only module that knows where state lives and in what format, so a later move to JSON or SQLite touches one file.

## Failure handling

yt-dlp failures are classified into **network**, **permanent**, **fatal** and **unknown**. Network failures are retried with growing waits and, when repeated, stop the run (or wait for the connection with `--wait`). Fatal failures (unreadable cookies) stop the run immediately. Permanent failures are recorded in `failed.txt` and the run continues.

## Security notes

- The extension has a single permission (`storage`), reads no cookies, and makes no network requests.
- The downloader never reads or stores cookies itself: it hands the browser name or a cookies file to yt-dlp ([ADR 0005](decisions/0005-cookies-via-firefox-or-cookies-file.md)).
- yt-dlp is spawned without a shell and only receives links that passed the contract.
