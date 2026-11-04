import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  DEFAULTS,
  flagsFromArgs,
  loadConfigFile,
  resolveSettings,
  validateConfig,
} from '../src/config.mjs';

const root = path.resolve('/repo');
const cwd = path.resolve('/work');

test('defaults apply and paths resolve against the repository root', () => {
  const s = resolveSettings({ root, cwd });
  assert.equal(s.delay, DEFAULTS.delay);
  assert.equal(s.downloadsDir, path.join(root, 'data/downloads'));
  assert.equal(s.stateDir, path.join(root, 'data/state'));
  assert.equal(s.list, path.join(root, 'data/inbox/videos-x.txt'));
  assert.equal(s.cookiesFromBrowser, null);
});

test('config overrides defaults', () => {
  const s = resolveSettings({
    config: { delay: 5, cookiesFromBrowser: 'firefox', downloadsDir: 'videos' },
    root,
    cwd,
  });
  assert.equal(s.delay, 5);
  assert.equal(s.cookiesFromBrowser, 'firefox');
  assert.equal(s.downloadsDir, path.join(root, 'videos'));
});

test('flags override config, and flag paths are relative to the current directory', () => {
  const s = resolveSettings({
    config: { delay: 5, downloadsDir: 'videos' },
    flags: { delay: 0, downloadsDir: 'here' },
    root,
    cwd,
  });
  assert.equal(s.delay, 0);
  assert.equal(s.downloadsDir, path.join(cwd, 'here'));
});

test('a null in the config clears a default', () => {
  const s = resolveSettings({ config: { cookiesFromBrowser: null }, root, cwd });
  assert.equal(s.cookiesFromBrowser, null);
});

test('validateConfig reports unknown keys and wrong types', () => {
  const errors = validateConfig(
    { delayy: 1, retries: 1.5, ytdlp: 3, list: null, limit: -1 },
    'cfg',
  );
  assert.equal(errors.length, 5);
  assert.match(errors[0], /unknown key "delayy"/);
});

test('validateConfig accepts the documented example', async () => {
  const { readFile } = await import('node:fs/promises');
  const example = JSON.parse(
    await readFile(new URL('../../xvs.config.example.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(validateConfig(example), []);
});

test('flagsFromArgs converts numbers, maps names and checks values', () => {
  const ok = flagsFromArgs(
    { delay: '1.5', limit: '10', 'cookies-from-browser': 'firefox' },
    'a.txt',
  );
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.flags, {
    list: 'a.txt',
    delay: 1.5,
    limit: 10,
    cookiesFromBrowser: 'firefox',
  });

  const bad = flagsFromArgs({ delay: 'abc', limit: '1.5', wait: '' });
  assert.equal(bad.errors.length, 3);
});

test('loadConfigFile: missing file is fine unless required; bad JSON is an error', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'xvs-cfg-'));
  const file = path.join(dir, 'c.json');

  assert.deepEqual(await loadConfigFile(file), { config: {}, found: false });
  await assert.rejects(loadConfigFile(file, { required: true }), /file does not exist/);

  await writeFile(file, '{ nope');
  await assert.rejects(loadConfigFile(file), /Invalid config/);

  await writeFile(file, '[]');
  await assert.rejects(loadConfigFile(file), /JSON object/);

  await writeFile(file, '\uFEFF{"delay": 3}');
  assert.deepEqual(await loadConfigFile(file), { config: { delay: 3 }, found: true });
  await rm(dir, { recursive: true });
});
