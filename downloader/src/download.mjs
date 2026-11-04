#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { access, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { classifyError } from './classify-error.mjs';
import { flagsFromArgs, loadConfigFile, resolveSettings, validateConfig } from './config.mjs';
import { freeStamp, outputTemplate } from './filename.mjs';
import { authorOf, parseList } from './parse-list.mjs';
import { createState } from './state.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const HELP = `
Usage: node downloader/src/download.mjs [list.txt] [options]

Reads the links (one per line), validates and downloads each video using yt-dlp.

Without arguments, it uses the configured list (default: data/inbox/videos-x.txt).

Option precedence: flags > xvs.config.json > defaults.

General:

--config <file>: another config file (default: xvs.config.json in the root)

--show-config: shows the final settings and exits

--dry-run: only checks the list, doesn't download anything

-o, --out <folder>: video folder (default: data/downloads)

--ytdlp <path>: yt-dlp executable (default: yt-dlp)

Cookies (sensitive content / protected accounts):

--cookies-from-browser <n>: uses browser login (firefox is the most trusted on Windows)

--cookies <file>: uses a cookies.txt file (Netscape format), e.g., exported only from x.com

Execution rules:

--delay <s>: pause between downloads (default: 2)

--retries <n>: retries per link on network failure (default: 2)

--backoff <s>: initial wait Between attempts, doubles each time (default: 5)
--max-consecutive-failures <n>: stops after n consecutive network failures; 0 shuts down (default: 3)
--wait <min>: instead of stopping, waits until <min> minutes for the network to return (default: 0)
--limit <n>: stops after n completed downloads; 0 = no limit (default: 0)

-h, --help shows this help

Ctrl+C once: safely stops and shows the summary. Twice: terminates immediately.

To continue, run the same command: what has already been downloaded is skipped.
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    config: { type: 'string' },
    'show-config': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    out: { type: 'string', short: 'o' },
    ytdlp: { type: 'string' },
    'cookies-from-browser': { type: 'string' },
    cookies: { type: 'string' },
    delay: { type: 'string' },
    retries: { type: 'string' },
    backoff: { type: 'string' },
    'max-consecutive-failures': { type: 'string' },
    wait: { type: 'string' },
    limit: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(message);
  process.exit(1);
}

if (values.help) {
  console.log(HELP);
  process.exit(0);
}

// 0) Configuration -------------------------------------------------------------
const explicitConfig = values.config !== undefined;
const configPath = explicitConfig
  ? path.resolve(values.config)
  : path.join(ROOT, 'xvs.config.json');

/** @type {Awaited<ReturnType<typeof loadConfigFile>>} */
let loaded;
try {
  loaded = await loadConfigFile(configPath, { required: explicitConfig });
} catch (error) {
  fail(error.message);
}

const { flags, errors: flagErrors } = flagsFromArgs(values, positionals[0]);
const problems = [...validateConfig(loaded.config, path.basename(configPath)), ...flagErrors];
if (problems.length > 0) fail(problems.join('\n'));

const settings = resolveSettings({
  config: loaded.config,
  flags,
  root: ROOT,
  cwd: process.cwd(),
});

if (values['show-config']) {
  console.log(JSON.stringify({ configFile: loaded.found ? configPath : null, settings }, null, 2));
  process.exit(0);
}

const delayMs = settings.delay * 1000;
const retries = settings.retries;
const backoffMs = settings.backoff * 1000;
const maxStreak = settings.maxConsecutiveFailures;
const waitMs = settings.wait * 60_000;
const limit = settings.limit;
const probeUrl = process.env.XVD_PROBE_URL ?? 'https://x.com';

const state = createState(settings.stateDir);

let stopping = false;
/** @type {import('node:child_process').ChildProcess | null} */
let currentChild = null;

/** Waits `ms`, but wakes up right away when the user asks to stop. */
async function sleep(/** @type {number} */ ms) {
  const end = Date.now() + ms;
  while (!stopping && Date.now() < end) {
    await new Promise((r) => setTimeout(r, Math.max(0, Math.min(500, end - Date.now()))));
  }
}

/**
 * Runs a command without a shell (a URL is never interpreted as a command).
 * @param {string} cmd
 * @param {string[]} args
 */
function run(cmd, args, { echo = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    currentChild = child;
    let stdout = '';
    let stderr = '';
    let alreadyDownloaded = false;

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      if (/already been recorded in the archive/i.test(text)) alreadyDownloaded = true;
      stdout = (stdout + text).slice(-4000);
      if (echo) process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr = (stderr + text).slice(-4000);
      if (echo) process.stderr.write(text);
    });
    /**
     * @param {number | null} code
     * @param {boolean} missing
     */
    const done = (code, missing) => {
      currentChild = null;
      resolve({ code, missing, stdout, stderr, alreadyDownloaded });
    };
    child.on('error', (error) => done(-1, /** @type {any} */ (error).code === 'ENOENT'));
    child.on('close', (code) => done(code, false));
  });
}

const online = () =>
  fetch(probeUrl, { method: 'HEAD', signal: AbortSignal.timeout(8000) }).then(
    () => true,
    () => false,
  );

/** @param {number} ms */
async function waitForNetwork(ms) {
  const minutes = Math.round((ms / 60_000) * 10) / 10;
  console.log(`  Network unavailable. Waiting until ${minutes} min (Ctrl+C to stop)…`);
  const deadline = Date.now() + ms;
  while (!stopping && Date.now() < deadline) {
    if (await online()) return true;
    await sleep(Math.min(10_000, deadline - Date.now()));
  }
  return false;
}

/**
 * Downloads one link, retrying with growing waits when the failure is a network one.
 * @param {string} url
 */
async function download(url) {
  // Name = uploader + download date/time. The stamp is picked once per link, so retries of
  // the same link keep the same name and yt-dlp can resume a partial file.
  const stamp = await freeStamp(settings.downloadsDir);
  const template = outputTemplate(settings.downloadsDir, authorOf(url), stamp);

  const args = [
    '--no-progress',
    '--no-overwrites',
    '--download-archive',
    state.archivePath, // yt-dlp remembers what was downloaded and skips it
    '--merge-output-format',
    'mp4',
    '--socket-timeout',
    '30', // without it a hung connection freezes the queue
    '--retries',
    '3',
    '--fragment-retries',
    '3',
    '-o',
    template,
    ...(settings.cookiesFromBrowser ? ['--cookies-from-browser', settings.cookiesFromBrowser] : []),
    ...(settings.cookiesFile ? ['--cookies', settings.cookiesFile] : []),
    url,
  ];

  for (let attempt = 0; ; attempt += 1) {
    const res = /** @type {any} */ (await run(settings.ytdlp, args, { echo: true }));
    if (stopping) return { interrupted: true };
    if (res.code === 0) return { ok: true, skipped: res.alreadyDownloaded };

    const { kind, reason } = classifyError(res.stderr || res.stdout);
    if (kind !== 'network' || attempt >= retries) return { ok: false, kind, reason };

    const pause = Math.min(60_000, backoffMs * 2 ** attempt);
    const seconds = Math.round(pause / 1000);
    console.log(
      `  Network failure (${reason}). Retry ${attempt + 1}/${retries} in ${seconds}s`,
    );
    await sleep(pause);
    if (stopping) return { interrupted: true };
  }
}

// 1) Validate the list ---------------------------------------------------------
let text;
try {
  text = await readFile(settings.list, 'utf8');
} catch (error) {
  const why = error.code === 'ENOENT' ? 'file does not exist' : error.message;
  console.error(`I couldn't read "${settings.list}": ${why}`);
  console.error(`Export the list using the extension's popup ("Download .txt"), place it in data/inbox/`);
  console.error('or pass the path as an argument.');
  process.exit(1);
}

const { urls, invalid, duplicates } = parseList(text);
console.log(`List: ${settings.list}`);
console.log(
  `  ${urls.length} valid url(s), ${duplicates} duplicate(s) ignored, ${invalid.length} invalid line(s)`,
);
for (const item of invalid.slice(0, 10)) {
  console.log(`  Line ${item.line} ignored: ${item.text.slice(0, 80)}`);
}
if (invalid.length > 10) console.log(`  … and more ${invalid.length - 10}`);

if (values['dry-run']) process.exit(0);
if (urls.length === 0) {
  console.log('Nothing to download.');
  process.exit(0);
}

if (settings.cookiesFile) {
  try {
    await access(settings.cookiesFile);
  } catch {
    fail(`Cookies file not found: ${settings.cookiesFile}`);
  }
}

// 2) Check dependencies ---------------------------------------------------------
const version = /** @type {any} */ (await run(settings.ytdlp, ['--version']));
if (version.missing || version.code !== 0) {
  console.error(`\nyt-dlp not found ("${settings.ytdlp}"). Install with one of the options:`);
  console.error('  pip install -U yt-dlp   |   brew install yt-dlp   |   winget install yt-dlp');
  process.exit(1);
}
console.log(`yt-dlp ${version.stdout.trim()}`);

if (/** @type {any} */ (await run('ffmpeg', ['-version'])).missing) {
  console.warn(
    'Warning: ffmpeg not found. Some videos (HLS) may fail to merge audio and video.',
  );
}

// 3) Ctrl+C: press once to stop safely, twice to exit immediately ---------------
process.on('SIGINT', () => {
  if (stopping) {
    console.log('\nEnding now.');
    currentChild?.kill();
    process.exit(130);
  }
  stopping = true;
  console.log('\nStopping… (Ctrl+C again to force quit). What has already been downloaded is saved.');
  currentChild?.kill();
});

// 4) Download one at a time, with protection against network failures ------------
await state.init();
await mkdir(settings.downloadsDir, { recursive: true });

const results = {
  /** @type {string[]} */ ok: [],
  /** @type {string[]} */ skipped: [],
  /** @type {{ url: string, reason: string }[]} */ failed: [],
};
const queue = [...urls];
/** Consecutive network failures, not yet considered final. @type {{ url: string, reason: string }[]} */
const streak = [];
/** @type {'user' | 'network' | 'config' | 'limit' | null} */
let stopReason = null;

const flushStreak = () => {
  results.failed.push(...streak);
  streak.length = 0;
};

while (queue.length > 0) {
  if (stopping) {
    stopReason = 'user';
    break;
  }
  if (limit && results.ok.length >= limit) {
    stopReason = 'limit';
    break;
  }

  const url = /** @type {string} */ (queue.shift());
  console.log(`\n[${urls.length - queue.length}/${urls.length}] ${url}`);

  const res = /** @type {any} */ (await download(url));
  if (res.interrupted) {
    queue.unshift(url); // not finished: goes back to the pending ones
    stopReason = 'user';
    break;
  }

  if (res.kind === 'fatal') {
    queue.unshift(url); // the link is not at fault: it stays pending
    console.log(`  → config error: ${res.reason}`);
    stopReason = 'config';
    break;
  }

  if (res.ok) {
    flushStreak();
    if (res.skipped) {
      results.skipped.push(url);
      console.log('  → already downloaded, skipping');
      continue; // no pause: no heavy request was made
    }
    results.ok.push(url);
    console.log('  → ok');
  } else if (res.kind === 'network') {
    streak.push({ url, reason: res.reason });
    console.log(`  → failed (network): ${res.reason}`);
    if (maxStreak > 0 && streak.length >= maxStreak) {
      console.log(`\n  ${streak.length} consecutive network failures.`);
      if (waitMs > 0 && (await waitForNetwork(waitMs))) {
        console.log('  Network is back. Resuming.');
        queue.unshift(...streak.map((s) => s.url)); // retry the ones that fell
        streak.length = 0;
        continue;
      }
      stopReason = stopping ? 'user' : 'network';
      break;
    }
  } else {
    flushStreak();
    results.failed.push({ url, reason: res.reason });
    console.log(`  → failed: ${res.reason}`);
  }

  if (queue.length > 0) await sleep(delayMs);
}
flushStreak();

// 5) Summary ----------------------------------------------------------------------
console.log(
  `\Summary: ${results.ok.length} downloaded, ${results.skipped.length} already existed, ` +
    `${results.failed.length} failed, ${queue.length} pending.`,
);

if (results.failed.length > 0) {
  await state.saveFailed(results.failed);
  console.log(`Broken links (and the reason) in ${state.failedPath}.`);
} else {
  await state.clearFailed();
}

if (stopReason === 'user') {
  console.log('Interrupted by you. Run the same command to continue from where you left off.');
}
if (stopReason === 'network') {
  console.log('Stopped due to consecutive network failures. Check your connection and run the same command to');
  console.log('continue (or use --wait 10 to wait for the network to come back on its own).');
}
if (stopReason === 'config') {
  console.log(
    'I stopped at the first configuration error: the next links would fail in the same way.',
  );
  console.log('Cookies: on Windows, Chrome/Edge usually block reading. Use');
  console.log('--cookies-from-browser firefox or point to a cookies.txt with --cookies <file>.');
}
if (stopReason === 'limit') {
  console.log(`Limit of ${limit} download(s) reached. Run again to continue.`);
}

/** @type {Record<string, number>} */
const exitCodes = { user: 130, network: 2, config: 3 };
const failedExit = results.failed.length > 0 ? 1 : 0;
process.exit(stopReason && stopReason in exitCodes ? exitCodes[stopReason] : failedExit);
