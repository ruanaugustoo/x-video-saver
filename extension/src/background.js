// Service worker: the only part that writes the list. Writes go through a queue so two quick
// clicks cannot overwrite each other.
import { canonicalUrl, isValidAuthor, isValidId } from './contract.js';

const KEY = 'videos';
let queue = Promise.resolve();

/** @typedef {{ id: string, author: string, url: string, text: string, savedAt: number }} SavedVideo */

/** @returns {Promise<SavedVideo[]>} */
async function readVideos() {
  const { [KEY]: videos = [] } = await chrome.storage.local.get(KEY);
  return /** @type {SavedVideo[]} */ (videos);
}

/** @param {any} raw item coming from the content script */
async function addVideo(raw) {
  // Does not trust the content script: validates and rebuilds the URL.
  if (!isValidId(raw?.id) || !isValidAuthor(raw?.author)) {
    return { error: 'item inválido' };
  }
  const item = {
    id: raw.id,
    author: raw.author,
    url: canonicalUrl(raw.author, raw.id),
    text: String(raw.text ?? '').slice(0, 140),
    savedAt: Number(raw.savedAt) || Date.now(),
  };

  const videos = await readVideos();
  if (videos.some((v) => v.id === item.id)) {
    return { added: false, total: videos.length };
  }

  videos.unshift(item);
  await chrome.storage.local.set({ [KEY]: videos });
  return { added: true, total: videos.length };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'SAVE_VIDEO') return;
  queue = queue
    .then(() => addVideo(msg.item))
    .then(sendResponse, (err) => sendResponse({ error: String(err) }));
  return true; // async response
});

/** @param {unknown[]} videos */
function updateBadge(videos) {
  chrome.action.setBadgeText({ text: videos.length ? String(videos.length) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#0b6e6e' });
}

async function syncBadge() {
  updateBadge(await readVideos());
}

chrome.runtime.onInstalled.addListener(syncBadge);
chrome.runtime.onStartup.addListener(syncBadge);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[KEY]) {
    updateBadge(/** @type {SavedVideo[]} */ (changes[KEY].newValue ?? []));
  }
});
