# 0004. Use yt-dlp instead of an own extractor

## Context

Getting the video file from a post is the fragile part: X changes how it serves media and what it asks of logged-out visitors. We looked at the official API (paid per use), browser automation with Playwright, gallery-dl, and yt-dlp.

## Decision

Delegate extraction and download to yt-dlp. The project owns everything around it: the list, validation, retries, ordering, naming and state.

## Consequences

- When X changes something, the fix is usually a yt-dlp update (`yt-dlp -U`), not a code change here.
- No API keys, no scraping code, no login handling in this repository.
- yt-dlp must be installed separately, and its behavior and error messages are outside our control, hence the error classifier ([classify-error.mjs](../../downloader/src/classify-error.mjs)).
