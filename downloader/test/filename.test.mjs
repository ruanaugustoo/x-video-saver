import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { formatStamp, freeStamp, outputTemplate } from '../src/filename.mjs';

const at = (/** @type {number} */ s) => new Date(2026, 9, 14, 15, 30, s).getTime();

test('formatStamp uses local time as YYYYMMDD-HHMMSS', () => {
  assert.equal(formatStamp(new Date(2026, 0, 5, 7, 8, 9)), '20260105-070809');
});

test('freeStamp returns the current second when nothing uses it', async () => {
  const stamp = await freeStamp('x', { now: () => at(45) + 300, list: async () => [] });
  assert.equal(stamp, '20261014-153045');
});

test('freeStamp skips stamps already in use, partial files included', async () => {
  const taken = ['foo_20261014-153045.mp4', 'bar_20261014-153046_2.mp4.part'];
  const stamp = await freeStamp('x', { now: () => at(45), list: async () => taken });
  assert.equal(stamp, '20261014-153047');
});

test('freeStamp ignores unrelated names', async () => {
  const stamp = await freeStamp('x', { now: () => at(45), list: async () => ['notes.txt'] });
  assert.equal(stamp, '20261014-153045');
});

test('freeStamp treats a missing directory as empty', async () => {
  const stamp = await freeStamp('/definitely/not/here', { now: () => at(10) });
  assert.equal(stamp, '20261014-153010');
});

test('outputTemplate: uploader, stamp and optional playlist index', () => {
  assert.equal(
    outputTemplate('out', 'foo', '20261014-153045'),
    path.join('out', '%(uploader_id|foo)s_20261014-153045%(playlist_index&_{}|)s.%(ext)s'),
  );
});
