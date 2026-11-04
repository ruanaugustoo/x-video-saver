// Contract v1 (see docs/architecture.md): one post link per line, "#" starts a comment.
// Only x.com / twitter.com post links get through, so nothing else reaches yt-dlp.

const STATUS_URL =
  /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/(\w{1,15})\/status\/(\d+)(?:[/?#].*)?$/i;

/**
 * @param {string} text a single candidate link
 * @returns {{ author: string, id: string } | null}
 */
export function parseStatusUrl(text) {
  const match = STATUS_URL.exec(text.trim());
  return match ? { author: match[1], id: match[2] } : null;
}

/**
 * @param {string} url a normalized post link
 * @returns {string} the account handle, used as a fallback in file names
 */
export function authorOf(url) {
  return parseStatusUrl(url)?.author ?? 'unknown';
}

/**
 * @param {string} text file contents
 * @returns {{ urls: string[], invalid: { line: number, text: string }[], duplicates: number }}
 */
export function parseList(text) {
  /** @type {Map<string, string>} */
  const byId = new Map();
  /** @type {{ line: number, text: string }[]} */
  const invalid = [];
  let duplicates = 0;

  text
    .replace(/^\uFEFF/, '') // BOM (Windows Notepad)
    .split(/\r?\n/)
    .forEach((raw, index) => {
      const line = raw.trim();
      if (!line || line.startsWith('#')) return;

      const parsed = parseStatusUrl(line);
      if (!parsed) {
        invalid.push({ line: index + 1, text: line });
        return;
      }

      if (byId.has(parsed.id)) {
        duplicates += 1;
        return;
      }
      byId.set(parsed.id, `https://x.com/${parsed.author}/status/${parsed.id}`);
    });

  return { urls: [...byId.values()], invalid, duplicates };
}
