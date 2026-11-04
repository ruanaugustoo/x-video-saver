// Keeps state paths and persistence isolated; yt-dlp maintains the archive contents.

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * @param {string} stateDir
 */
export function createState(stateDir) {
  const archivePath = path.join(stateDir, 'archive.txt');
  const failedPath = path.join(stateDir, 'failed.txt');

  return {
    archivePath,
    failedPath,

    async init() {
      await mkdir(stateDir, { recursive: true });
    },

    /**
     * Lines starting with "#" are comments, so failed.txt can be fed back in as a new list.
     * @param {{ url: string, reason: string }[]} failures
     */
    async saveFailed(failures) {
      const body = failures.map((f) => `# ${f.reason}\n${f.url}`).join('\n');
      await writeFile(failedPath, `${body}\n`);
    },

    async clearFailed() {
      await rm(failedPath, { force: true });
    },
  };
}
