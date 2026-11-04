// Contract v1: the same fixtures are checked against the downloader (downloader/test).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { canonicalUrl, isValidAuthor, isValidId, parseStatusUrl } from '../src/contract.js';

const fixtures = JSON.parse(
  readFileSync(new URL('../../shared/fixtures/urls.json', import.meta.url), 'utf8'),
);

for (const c of fixtures.cases) {
  test(`parseStatusUrl: ${c.name}`, () => {
    const parsed = parseStatusUrl(c.input);
    if (!c.valid) return assert.equal(parsed, null);

    assert.deepEqual(parsed, { author: c.author, id: c.id });
    assert.ok(isValidAuthor(parsed?.author));
    assert.ok(isValidId(parsed?.id));
    assert.equal(canonicalUrl(c.author, c.id), c.normalized);
  });
}

test('rejects ids and handles the background must never accept', () => {
  assert.equal(isValidId('12a'), false);
  assert.equal(isValidId(123), false);
  assert.equal(isValidAuthor('foo bar'), false);
  assert.equal(isValidAuthor('a'.repeat(16)), false);
});

test('content.js permalink regex agrees with the contract on every valid fixture', () => {
  const source = readFileSync(new URL('../src/content.js', import.meta.url), 'utf8');
  const literal = /const PERMALINK = (\/.+\/[a-z]*);/.exec(source)?.[1];
  assert.ok(literal, 'PERMALINK declaration not found in content.js');
  const permalink = new Function(`return ${literal}`)();

  for (const c of fixtures.cases.filter((/** @type {{ valid: boolean }} */ f) => f.valid)) {
    const match = permalink.exec(new URL(c.input.trim()).pathname);
    assert.ok(match, `no match for ${c.name}`);
    assert.equal(match[1], c.author, c.name);
    assert.equal(match[2], c.id, c.name);
  }
});
