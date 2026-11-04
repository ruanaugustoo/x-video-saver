# 0005. Cookies via Firefox or a cookies file

## Context

Some posts (sensitive content, protected accounts) only download with a logged-in session. A session cookie is as powerful as a password, so handling it is a security decision. On Windows, yt-dlp often cannot read cookies from Chrome and Edge (`Could not copy Chrome cookie database`), and closing the browser does not always help.

## Decision

- The project never reads, copies or stores cookies. It passes `--cookies-from-browser <name>` or `--cookies <file>` to yt-dlp.
- Recommended path: Firefox (`cookiesFromBrowser: "firefox"`).
- Alternative: a `cookies.txt` with only x.com cookies, treated like a password and ignored by git.
- Unreadable-cookie errors are classified as **fatal**: the run stops at the first one instead of repeating the same error on every link.

## Consequences

- No credentials in the repository, config or logs.
- Windows users who live in Chrome or Edge need Firefox (or a cookies file) for logged-in downloads.
