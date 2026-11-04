const $ = (sel) => document.querySelector(sel);
const list = $('#list');
const empty = $('#empty');
const actions = $('#actions');
const count = $('#count');
const auto = $('#auto');
const clearBtn = $('#clear');
const status = $('#status');

let videos = [];
let clearTimer;

const fmtDate = (ts) =>
  new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(ts);

const persist = (next) => chrome.storage.local.set({ videos: next });

function row(v) {
  const li = document.createElement('li');

  const link = document.createElement('a');
  link.className = 'item-main';
  link.href = v.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  const who = document.createElement('strong');
  who.textContent = `@${v.author}`;
  const snippet = document.createElement('span');
  snippet.className = 'snippet';
  snippet.textContent = v.text || 'Post without text';
  const when = document.createElement('time');
  when.textContent = `Saved on ${fmtDate(v.savedAt)}`;
  link.append(who, snippet, when);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove';
  remove.textContent = 'Remove';
  remove.setAttribute('aria-label', `Remove video from @${v.author}`);
  remove.addEventListener('click', () => persist(videos.filter((x) => x.id !== v.id)));

  li.append(link, remove);
  return li;
}

function render() {
  count.textContent = videos.length;
  empty.hidden = videos.length > 0;
  actions.hidden = videos.length === 0;
  list.replaceChildren(...videos.map(row));
}

function say(msg) {
  status.textContent = msg;
  setTimeout(() => {
    if (status.textContent === msg) status.textContent = '';
  }, 2500);
}

const urlsText = () => videos.map((v) => v.url).join('\n');

$('#copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(urlsText());
  say(`${videos.length} copied urls to clipboard`);
});

$('#download').addEventListener('click', () => {
  const blob = new Blob([urlsText() + '\n'], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'videos-x.txt';
  a.click();
  URL.revokeObjectURL(a.href);
  say('File videos-x.txt generated');
});

clearBtn.addEventListener('click', () => {
  if (clearBtn.dataset.confirm !== 'true') {
    clearBtn.dataset.confirm = 'true';
    clearBtn.textContent = 'Confirm clean';
    clearTimer = setTimeout(resetClear, 3000);
    return;
  }
  resetClear();
  persist([]);
});

function resetClear() {
  clearTimeout(clearTimer);
  clearBtn.dataset.confirm = 'false';
  clearBtn.textContent = 'Clean list';
}

auto.addEventListener('change', () => chrome.storage.local.set({ autoSave: auto.checked }));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.videos) {
    videos = /** @type {any[]} */ (changes.videos.newValue ?? []);
    render();
  }
  if (changes.autoSave) auto.checked = changes.autoSave.newValue;
});

chrome.storage.local.get({ videos: [], autoSave: false }, (r) => {
  videos = /** @type {any[]} */ (r.videos);
  auto.checked = Boolean(r.autoSave);
  render();
});
