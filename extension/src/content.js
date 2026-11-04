(() => {
  // Keep in sync with src/contract.js (extension/test/contract.test.mjs checks it).
  const PERMALINK = /^\/([^/]+)\/status\/(\d+)/;

  let autoSave = false;
  const savedIds = new Set();
  const pending = new Set();

  chrome.storage.local.get({ videos: [], autoSave: false }, (stored) => {
    const r = /** @type {{ videos: { id: string }[], autoSave: boolean }} */ (stored);
    r.videos.forEach((v) => savedIds.add(v.id));
    autoSave = r.autoSave;
    scan();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.videos) {
      savedIds.clear();
      /** @type {{ id: string }[]} */ (changes.videos.newValue ?? []).forEach((v) =>
        savedIds.add(v.id),
      );
      refreshButtons();
    }
    if (changes.autoSave) {
      autoSave = Boolean(changes.autoSave.newValue);
      scan();
    }
  });

  // X videos use blob: URLs (streaming), so the file cannot be retrieved here.
  // We save the permanent post link, which yt-dlp can resolve.
  function readTweet(article) {
    const link = article.querySelector('a[href*="/status/"] time')?.closest('a');
    const match = link && PERMALINK.exec(new URL(link.href).pathname);
    if (!match) return null;
    const [, author, id] = match;
    const text = article.querySelector('[data-testid="tweetText"]')?.innerText ?? '';
    return { id, author, text: text.slice(0, 140), savedAt: Date.now() };
  }

  async function save(item) {
    if (pending.has(item.id)) return null;
    pending.add(item.id);
    try {
      return await chrome.runtime.sendMessage({ type: 'SAVE_VIDEO', item });
    } catch {
      return null; // The extension was reloaded; the tab needs to be refreshed.
    } finally {
      pending.delete(item.id);
    }
  }

  function setLabel(btn) {
    const saved = savedIds.has(btn.dataset.id);
    btn.textContent = saved ? 'Saved' : 'Save Video';
    btn.dataset.saved = String(saved);
  }

  function refreshButtons() {
    document.querySelectorAll('.xvs-btn').forEach(setLabel);
  }

  function attachButton(video, item) {
    const host = video.closest('[data-testid="videoPlayer"]') ?? video.parentElement;
    if (!host || host.querySelector(':scope > .xvs-btn')) return;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'xvs-btn';
    btn.dataset.id = item.id;
    setLabel(btn);

    for (const type of ['mousedown', 'pointerdown']) {
      btn.addEventListener(type, (e) => e.stopPropagation());
    }
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (savedIds.has(item.id)) return;
      btn.textContent = 'Saving…';
      const res = await save(item);
      if (!res || res.error) btn.textContent = 'Error — reload the tab';
    });

    host.appendChild(btn);
  }

  function scan() {
    for (const video of document.querySelectorAll('article video')) {
      const article = video.closest('article');
      const item = article && readTweet(article);
      if (!item) continue;
      attachButton(video, item);
      if (autoSave && !savedIds.has(item.id)) save(item);
    }
  }

  // X is a SPA with infinite scrolling: observe the DOM and rescan with debounce.
  let timer;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(scan, 250);
  }).observe(document.body, { childList: true, subtree: true });
})();
