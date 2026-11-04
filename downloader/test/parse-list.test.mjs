import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authorOf, parseList } from '../src/parse-list.mjs';

test('accepts x.com and twitter.com and normalizes to x.com', () => {
  const { urls } = parseList('https://twitter.com/foo/status/1\nhttps://x.com/bar/status/2?s=20\n');
  assert.deepEqual(urls, ['https://x.com/foo/status/1', 'https://x.com/bar/status/2']);
});

test('ignores blank lines and comments', () => {
  const { urls, invalid } = parseList('# my list\n\nhttps://x.com/foo/status/1\n');
  assert.equal(urls.length, 1);
  assert.equal(invalid.length, 0);
});

test('removes duplicates by post id', () => {
  const { urls, duplicates } = parseList(
    'https://x.com/foo/status/1\nhttps://twitter.com/foo/status/1\n',
  );
  assert.equal(urls.length, 1);
  assert.equal(duplicates, 1);
});

test('reports invalid lines with their line number', () => {
  const { invalid } = parseList('https://x.com/foo/status/1\nhttps://x.com/foo\n--exec rm -rf /\n');
  assert.deepEqual(
    invalid.map((i) => i.line),
    [2, 3],
  );
});

test('handles BOM and Windows line endings', () => {
  const { urls } = parseList('\uFEFFhttps://x.com/foo/status/1\r\nhttps://x.com/foo/status/2\r\n');
  assert.equal(urls.length, 2);
});

test('authorOf extracts the handle', () => {
  assert.equal(authorOf('https://x.com/foo/status/1'), 'foo');
  assert.equal(authorOf('not a link'), 'unknown');
});
