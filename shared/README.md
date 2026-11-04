# shared

The only thing the extension and the downloader share is a **contract**, not code.

- `fixtures/urls.json` lists post links (valid and invalid) with the expected result.
- `extension/test/contract.test.mjs` and `downloader/test/contract.test.mjs` run the same
  fixtures against each side's implementation, so they cannot silently drift apart.

Why not shared code? See [docs/decisions/0002](../docs/decisions/0002-shared-fixtures-instead-of-shared-code.md).
