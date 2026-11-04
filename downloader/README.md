# downloader

Node CLI (no runtime dependencies) that reads the link list exported by the extension and downloads each video with yt-dlp.

## Requirements

Node 18.3+, [yt-dlp](https://github.com/yt-dlp/yt-dlp), [ffmpeg](https://ffmpeg.org) (recommended, to merge audio and video).

## Usage

```bash
node downloader/src/download.mjs --dry-run              # verify the list only
node downloader/src/download.mjs                        # download (list from the config)
node downloader/src/download.mjs other-list.txt         # another list
node downloader/src/download.mjs --show-config          # final settings after precedence
```

Without an argument it reads `data/inbox/videos-x.txt`. Settings come from flags > `xvs.config.json` > defaults (see the root README). `--help` lists every flag.

## What it does

1. **Verifies the list**: ignores blank lines and `#` comments, removes duplicates by post id, reports invalid lines with their line number. Only `x.com` / `twitter.com` post links get through.
2. Checks that yt-dlp (and ffmpeg) are installed.
3. Downloads **one at a time**, with a pause between downloads.
4. **Resumes**: yt-dlp keeps what it downloaded in `data/state/archive.txt` and skips it next time. Skipped links do not count toward `--limit`.
5. Links that failed go to `data/state/failed.txt` with the reason as a comment, so the file can be used as a new list.

## Run rules

| Option                           | Default | What it does                                             |
| -------------------------------- | ------- | -------------------------------------------------------- |
| `--retries <n>`                  | 2       | Retries per link on network failures                     |
| `--backoff <s>`                  | 5       | First wait between retries, doubles each time (max 60 s) |
| `--max-consecutive-failures <n>` | 3       | Stop after n network failures in a row (`0` disables)    |
| `--wait <min>`                   | 0       | Instead of stopping, wait for the network and resume     |
| `--limit <n>`                    | 0       | Stop after n completed downloads (`0` = no limit)        |
| `--delay <s>`                    | 2       | Pause between downloads                                  |

Failures are classified ([classify-error.mjs](src/classify-error.mjs)):

- **network** (timeout, DNS, 429, 5xx): retried, counts toward the breaker.
- **permanent** (no video, deleted, protected): not retried, does not trip the breaker.
- **fatal** (unreadable cookies): stops the run at once, because every next link would fail the same way.
- **unknown**: not retried, does not trip the breaker.

`Ctrl+C` once stops safely and prints a summary; twice exits immediately. Run the same command to continue.

Exit codes: `0` ok · `1` some links failed · `2` stopped by network failures · `3` configuration error · `130` interrupted.

## Files it writes

```
data/downloads/<uploader>_<YYYYMMDD-HHMMSS>[_<n>].mp4
data/state/archive.txt     (maintained by yt-dlp)
data/state/failed.txt
```

See [ADR 0006](../docs/decisions/0006-data-directory-and-file-naming.md) for the naming rules and trade-offs.

## Cookies (sensitive content, protected accounts)

On Windows, `--cookies-from-browser` often fails with Chrome and Edge. Use `firefox`, or export a `cookies.txt` containing only x.com and pass it with `--cookies`. Treat that file like a password. See [ADR 0005](../docs/decisions/0005-cookies-via-firefox-or-cookies-file.md).

## Code map

```
src/download.mjs        CLI: orchestration, retries, breaker, Ctrl+C
src/config.mjs          defaults, config file, flags, validation, precedence
src/parse-list.mjs      list contract (validation and normalization)
src/classify-error.mjs  failure classes
src/filename.mjs        file naming
src/state.mjs           where run state lives (the only module that knows)
```

## Tests

```bash
npm test
```
