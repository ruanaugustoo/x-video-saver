// Contract v1: the same fixtures are checked against the extension (extension/test).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseList, parseStatusUrl } from '../src/parse-list.mjs';

const fixtures = JSON.parse(
  readFileSync(new URL('../../shared/fixtures/urls.json', import.meta.url), 'utf8'),
);

for (const c of fixtures.cases) {
  test(`parseStatusUrl: ${c.name}`, () => {
    const parsed = parseStatusUrl(c.input);
    if (c.valid) assert.deepEqual(parsed, { author: c.author, id: c.id });
    else assert.equal(parsed, null);
  });

  test(`parseList: ${c.name}`, () => {
    const { urls, invalid } = parseList(c.input);
    if (c.valid) assert.deepEqual(urls, [c.normalized]);
    else assert.equal(urls.length, 0, 'invalid input must not produce a URL');
    // blank-only inputs are skipped, everything else invalid is reported
    if (!c.valid && c.input.trim() !== '' && !c.input.trim().startsWith('#')) {
      assert.equal(invalid.length, 1);
    }
  });
}
