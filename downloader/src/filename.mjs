// Output naming: <uploader>_<download date and time>[_<n>].<ext>, all in data/downloads/.
// The stamp is the local time of the download, bumped by whole seconds when it is already in
// use, so two downloads never end up with the same file name.

import { readdir } from 'node:fs/promises';
import path from 'node:path';

/** @param {number} n */
const pad = (n) => String(n).padStart(2, '0');

/**
 * Local date and time as YYYYMMDD-HHMMSS.
 * @param {Date} date
 */
export function formatStamp(date) {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${day}-${time}`;
}

/** @param {string} dir */
async function listDir(dir) {
  try {
    return await readdir(dir);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

/**
 * First stamp, starting at "now", that no file in `dir` already uses (partial .part files
 * included). Checking the stamp alone, not the account, also covers renamed accounts.
 * @param {string} dir
 * @param {{ now?: () => number, list?: (dir: string) => Promise<string[]> }} [options]
 */
export async function freeStamp(dir, { now = Date.now, list = listDir } = {}) {
  const names = await list(dir);
  let ms = Math.floor(now() / 1000) * 1000;
  for (;;) {
    const stamp = formatStamp(new Date(ms));
    if (!names.some((name) => name.includes(`_${stamp}`))) return stamp;
    ms += 1000;
  }
}

/**
 * yt-dlp output template. The index only appears for posts with more than one video.
 * @param {string} dir
 * @param {string} author fallback when yt-dlp does not report the uploader
 * @param {string} stamp
 */
export function outputTemplate(dir, author, stamp) {
  return path.join(dir, `%(uploader_id|${author})s_${stamp}%(playlist_index&_{}|)s.%(ext)s`);
}
