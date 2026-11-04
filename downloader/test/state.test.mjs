import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parseList } from '../src/parse-list.mjs';
import { createState } from '../src/state.mjs';

const tmp = () => mkdtemp(path.join(os.tmpdir(), 'xvs-state-'));

test('paths live inside the state directory', () => {
  const state = createState('/s');
  assert.equal(state.archivePath, path.join('/s', 'archive.txt'));
  assert.equal(state.failedPath, path.join('/s', 'failed.txt'));
});

test('saveFailed writes reasons as comments and can be read back as a list', async () => {
  const dir = await tmp();
  const state = createState(path.join(dir, 'state'));
  await state.init();
  await state.saveFailed([{ url: 'https://x.com/a/status/1', reason: 'No video could be found' }]);

  const text = await readFile(state.failedPath, 'utf8');
  assert.match(text, /^# No video could be found\nhttps:\/\/x\.com\/a\/status\/1\n$/);
  assert.deepEqual(parseList(text).urls, ['https://x.com/a/status/1']);
  await rm(dir, { recursive: true });
});

test('clearFailed removes the file and tolerates a missing one', async () => {
  const dir = await tmp();
  const state = createState(dir);
  await state.saveFailed([{ url: 'https://x.com/a/status/1', reason: 'x' }]);
  await state.clearFailed();
  await assert.rejects(stat(state.failedPath));
  await state.clearFailed();
  await rm(dir, { recursive: true });
});
