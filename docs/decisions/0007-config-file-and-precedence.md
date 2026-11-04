# 0007. Config file and precedence

## Context

Typing `--cookies-from-browser firefox --wait 10 --limit 100` on every run is tedious and error-prone.

## Decision

- `xvs.config.json` at the repository root, ignored by git. `xvs.config.example.json` is committed as the template.
- Precedence: command-line flags > config file > defaults. `--show-config` prints the result.
- Flat JSON with a fixed set of keys. Unknown keys and wrong types are rejected with a clear message, which catches typos.
- Paths in the file are relative to the repository root; paths in flags are relative to the current directory.
- No secrets in the config: only the name of the browser for cookies, or the path of a cookies file.

## Consequences

- One place for personal defaults, and the repository stays free of personal paths.
- JSON has no comments, so the documentation lives in the READMEs.
