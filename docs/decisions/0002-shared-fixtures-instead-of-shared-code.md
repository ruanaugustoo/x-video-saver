# 0002. Share a contract and fixtures, not code

## Context

Both halves validate post links. The extension runs in a browser as plain scripts; the downloader runs in Node. Sharing one implementation would need a build step to bundle it for the browser ([ADR 0001](0001-no-build-step.md)) or a published package.

## Decision

Each side keeps its own small implementation of the link contract. `shared/fixtures/urls.json` lists links with the expected outcome (valid with handle and id, or invalid), including look-alike domains and flag-like input. Both test suites run the same fixtures. A test also checks that the regular expression duplicated in `content.js` agrees with the contract.

## Consequences

- No build step and no coupling between the packages.
- A change to the contract means updating the fixtures first; both suites fail until both sides agree.
- The contract is a few lines of regular expression, so the duplication is cheap.
