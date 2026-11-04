# 0001. No build step: JavaScript + JSDoc + type checks

## Context

The extension is loaded by the browser exactly as written ("Load unpacked"), and the downloader is a script run with Node. A bundler or TypeScript compiler would add a step between editing a file and running it, plus tooling to maintain, for a project of this size.

## Decision

Write plain JavaScript (ES modules where the platform allows it). Describe types with JSDoc and check them with `tsc --noEmit` (`checkJs`). Prettier and ESLint are development dependencies at the repository root only. The downloader has no runtime dependencies.

## Consequences

- Edit, reload, run: no compile step. What runs is what is in the repository.
- We get most of TypeScript's safety without its build.
- JSDoc is more verbose than inline types.
- The type check starts with `strict: false`, so it catches real mistakes without forcing annotations everywhere at once. The plan is to turn `strict` on gradually.
- Content scripts cannot be ES modules, so `content.js` stays a classic script and is not imported by tests ([ADR 0002](0002-shared-fixtures-instead-of-shared-code.md)).
