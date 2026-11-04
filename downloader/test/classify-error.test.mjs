import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyError } from '../src/classify-error.mjs';

const kind = (/** @type {string} */ msg) => classifyError(msg).kind;

test('connection problems are "network"', () => {
  assert.equal(
    kind(
      'ERROR: [twitter] 1: Unable to download JSON metadata: <urlopen error [Errno -3] Temporary failure in name resolution>',
    ),
    'network',
  );
  assert.equal(
    kind('ERROR: unable to download video data: The read operation timed out'),
    'network',
  );
  assert.equal(
    kind('ERROR: [twitter] 1: Unable to download webpage: Connection reset by peer'),
    'network',
  );
});

test('429 and 5xx are "network", including 503 Service Unavailable', () => {
  assert.equal(kind('ERROR: [twitter] 1: HTTP Error 429: Too Many Requests'), 'network');
  assert.equal(
    kind(
      'ERROR: [twitter] 1: Unable to download JSON metadata: HTTP Error 503: Service Unavailable',
    ),
    'network',
  );
});

test('no video, deleted or protected posts are "permanent"', () => {
  assert.equal(kind('ERROR: [twitter] 2: No video could be found in this tweet'), 'permanent');
  assert.equal(
    kind('ERROR: [twitter] 2: Unable to download JSON metadata: HTTP Error 404: Not Found'),
    'permanent',
  );
  assert.equal(kind('ERROR: [twitter] 2: NSFW tweet requires authentication'), 'permanent');
});

test('unreadable browser cookies are "fatal"', () => {
  assert.equal(
    kind(
      'ERROR: Could not copy Chrome cookie database. See  https://github.com/yt-dlp/yt-dlp/issues/7271  for more info',
    ),
    'fatal',
  );
  assert.equal(
    kind(
      'ERROR: Failed to decrypt with DPAPI. See  https://github.com/yt-dlp/yt-dlp/issues/10927  for more info',
    ),
    'fatal',
  );
});

test('unrecognized messages are "unknown"', () => {
  assert.equal(kind('ERROR: something very strange'), 'unknown');
  assert.equal(kind(''), 'unknown');
});

test('extracts a readable reason', () => {
  assert.equal(
    classifyError('ERROR: [twitter] 2: No video could be found in this tweet').reason,
    'No video could be found in this tweet',
  );
});
