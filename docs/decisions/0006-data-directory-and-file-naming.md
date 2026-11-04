# 0006. Data directory and file naming

## Context

Lists, state and videos need a home. The state files may stop being `.txt` later. Videos used to go into one folder per uploader, which made it easy to hit "file already exists".

## Decision

- Everything personal lives under `data/` inside the project: `inbox/` (lists), `state/` (archive, failed) and `downloads/` (videos). The folders are tracked with `.gitkeep`; their contents are ignored by git.
- Access to state goes through `state.mjs`, so the format can change in one place.
- Videos are written flat as `<uploader>_<YYYYMMDD-HHMMSS>[_<n>].<ext>`, using the local date and time of the download. `_<n>` appears only for posts with more than one video.
- Before each download the name's timestamp is checked against the files already in `data/downloads/` (partial files included) and moved forward one second at a time while it is taken, so two downloads never share a name.

## Consequences

- No "already exists" collisions, and names sort by download time.
- The file name no longer identifies the post. Tracing a file back to its post would need an extra index (for example a `downloads.jsonl` in `data/state/`). Not built yet.
- A partial download interrupted in one run is not resumed by the next run, because the new run picks a new timestamp. Retries inside a run keep the same name and do resume.
- If the project folder is synced to a cloud drive, `data/downloads/` is synced too. The location is configurable (`downloadsDir`).
