// Contract v1 between the extension and the downloader (see docs/architecture.md).
// The downloader has its own implementation (downloader/src/parse-list.mjs). Both are checked
// against shared/fixtures/urls.json, so they cannot drift apart.

export const CONTRACT_VERSION = 1;

const STATUS_URL =
  /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/(\w{1,15})\/status\/(\d+)(?:[/?#].*)?$/i;

/**
 * @param {string} href a candidate post link
 * @returns {{ author: string, id: string } | null}
 */
export function parseStatusUrl(href) {
  const match = STATUS_URL.exec(String(href).trim());
  return match ? { author: match[1], id: match[2] } : null;
}

/** @param {unknown} id */
export const isValidId = (id) => typeof id === 'string' && /^\d+$/.test(id);

/** @param {unknown} author */
export const isValidAuthor = (author) => typeof author === 'string' && /^\w{1,15}$/.test(author);

/**
 * The one line format the downloader reads.
 * @param {string} author
 * @param {string} id
 */
export const canonicalUrl = (author, id) => `https://x.com/${author}/status/${id}`;
