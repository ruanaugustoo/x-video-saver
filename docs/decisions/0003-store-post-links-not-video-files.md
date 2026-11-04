# 0003. Store post links, not video files

## Context

X plays video through a `blob:` stream assembled in the browser, so the video file cannot be read from the page. The extension also should not need broad permissions or network access.

## Decision

The extension saves only the permanent link of the post (`https://x.com/<handle>/status/<id>`). Downloading happens later, outside the browser, where yt-dlp resolves the link.

## Consequences

- The extension is tiny and needs a single permission (`storage`).
- Downloads can be retried, throttled and resumed without involving the browser.
- The link must point at the post that actually contains the video. For a video inside a quoted post, the saved link is the outer post's, and yt-dlp may report that no video was found. Some links failed this way in real use; the exact causes (quoted posts, sensitive content that needs a login) are still being checked.
