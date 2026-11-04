// Settings: defaults < xvs.config.json < command-line flags.
// Paths in the config file are relative to the repository root; paths in flags are relative
// to the current directory (shell convention).

import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const DEFAULTS = Object.freeze({
  list: 'data/inbox/videos-x.txt',
  stateDir: 'data/state',
  downloadsDir: 'data/downloads',
  ytdlp: 'yt-dlp',
  cookiesFromBrowser: null,
  cookiesFile: null,
  delay: 2,
  retries: 2,
  backoff: 5,
  maxConsecutiveFailures: 3,
  wait: 5,
  limit: 25,
});

/** @type {Record<string, 'path' | 'path?' | 'string' | 'string?' | 'number' | 'int'>} */
const SCHEMA = {
  list: 'path',
  stateDir: 'path',
  downloadsDir: 'path',
  cookiesFile: 'path?',
  ytdlp: 'string',
  cookiesFromBrowser: 'string?',
  delay: 'number',
  retries: 'int',
  backoff: 'number',
  maxConsecutiveFailures: 'int',
  wait: 'number',
  limit: 'int',
};

/** @type {Record<string, string>} */
const FLAG_TO_KEY = {
  out: 'downloadsDir',
  ytdlp: 'ytdlp',
  'cookies-from-browser': 'cookiesFromBrowser',
  cookies: 'cookiesFile',
  delay: 'delay',
  retries: 'retries',
  backoff: 'backoff',
  'max-consecutive-failures': 'maxConsecutiveFailures',
  wait: 'wait',
  limit: 'limit',
};

const isPathKey = (/** @type {string} */ key) => SCHEMA[key]?.startsWith('path');

/**
 * @param {unknown} value
 * @param {'number' | 'int'} type
 */
const isValidNumber = (value, type) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  (type === 'number' || Number.isInteger(value));

/**
 * @param {Record<string, unknown>} config
 * @param {string} [source] name shown in error messages
 * @returns {string[]} problems found (empty when valid)
 */
export function validateConfig(config, source = 'config') {
  /** @type {string[]} */
  const errors = [];
  for (const [key, value] of Object.entries(config)) {
    const type = SCHEMA[key];
    if (!type) {
      errors.push(`${source}: unknown key "${key}"`);
      continue;
    }
    const nullable = type.endsWith('?');
    const base = type.replace('?', '');
    if (value === null) {
      if (!nullable) errors.push(`${source}: "${key}" cannot be null`);
      continue;
    }
    if (base === 'number' || base === 'int') {
      if (!isValidNumber(value, base)) {
        errors.push(
          `${source}: "${key}" must be ${base === 'int' ? 'an int' : ' a num'} ≥ 0`,
        );
      }
    } else if (typeof value !== 'string' || value === '') {
      errors.push(`${source}: "${key}" must be a string`);
    }
  }
  return errors;
}

/**
 * @param {string} file
 * @param {{ required?: boolean }} [options] a missing file is only an error when required
 * @returns {Promise<{ config: Record<string, unknown>, found: boolean }>}
 */
export async function loadConfigFile(file, { required = false } = {}) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT' && !required) return { config: {}, found: false };
    const why = error.code === 'ENOENT' ? 'file does not exist' : error.message;
    throw new Error(`Could not read config "${file}": ${why}`, { cause: error });
  }

  let data;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`Invalid config in "${file}": ${error.message}`, { cause: error });
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`Invalid config in "${file}": must be a JSON object`);
  }
  return { config: data, found: true };
}

/**
 * Turns parsed command-line values into settings keys, converting and checking numbers.
 * @param {Record<string, string | boolean | undefined>} values
 * @param {string} [listArg] positional list path
 * @returns {{ flags: Record<string, string | number>, errors: string[] }}
 */
export function flagsFromArgs(values, listArg) {
  /** @type {Record<string, string | number>} */
  const flags = {};
  /** @type {string[]} */
  const errors = [];
  if (listArg !== undefined) flags.list = listArg;

  for (const [flag, key] of Object.entries(FLAG_TO_KEY)) {
    const raw = values[flag];
    if (typeof raw !== 'string') continue;
    const type = SCHEMA[key];
    if (type === 'number' || type === 'int') {
      const n = Number(raw);
      if (raw.trim() === '' || !isValidNumber(n, type)) {
        const what = type === 'int' ? 'an int' : 'a num';
        errors.push(`--${flag} must be ${what} ≥ 0 (received "${raw}")`);
        continue;
      }
      flags[key] = n;
    } else {
      flags[key] = raw;
    }
  }
  return { flags, errors };
}

/**
 * @param {{ config?: Record<string, unknown>, flags?: Record<string, unknown>, root: string, cwd: string }} input
 */
export function resolveSettings({ config = {}, flags = {}, root, cwd }) {
  /** @type {Record<string, any>} */
  const settings = { ...DEFAULTS };

  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) continue;
    settings[key] = value;
  }
  // Defaults and config paths are relative to the repository root.
  for (const key of Object.keys(settings)) {
    if (isPathKey(key) && typeof settings[key] === 'string') {
      settings[key] = path.resolve(root, settings[key]);
    }
  }
  // Flag paths are relative to where the command was run.
  for (const [key, value] of Object.entries(flags)) {
    if (value === undefined) continue;
    settings[key] = isPathKey(key) && typeof value === 'string' ? path.resolve(cwd, value) : value;
  }
  return settings;
}
