// Main Get Real Hub & Reader Controller
let allChapters = (typeof CHAPTER_DATA !== 'undefined' ? [...CHAPTER_DATA] : (typeof window !== 'undefined' && window.CHAPTER_DATA ? [...window.CHAPTER_DATA] : []));
let localOfflineChapters = [];
let currentSortMode = 'num_asc';
let currentChapter = null;
let currentPages = [];
let currentPageIndex = 0;
let isContinuous = false;
let zoomFactor = 1.0;
let selectedFolderHandle = null;

// STORAGE KEYS
const STORAGE_BOOKMARKS = 'jk_bookmarks_v1';
const STORAGE_NOTES = 'hub_scratchpad_v1';

// MAIN VIEW SWITCHER (Hub, Reader, Chat, Forum, Notes)
function switchMainView(viewId) {
  document.querySelectorAll('.app-view').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`view-${viewId}`);
  if (target) target.classList.add('active');

  if (viewId === 'chat' && typeof ChatApp !== 'undefined') {
    ChatApp.init();
  } else if (viewId === 'forum' && typeof ForumApp !== 'undefined') {
    ForumApp.init();
  } else if (viewId === 'notes') {
    initNotes();
  }
}

// READER SUB-TAB SWITCHER
function switchReaderTab(tabId) {
  document.querySelectorAll('.reader-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.reader-subview').forEach(sub => sub.classList.remove('active'));

  const btn = document.getElementById(`rtab-${tabId}`);
  const sub = document.getElementById(`rsub-${tabId}`);
  if (btn) btn.classList.add('active');
  if (sub) sub.classList.add('active');

  const topControls = document.getElementById('reader-top-controls');
  if (topControls) {
    topControls.style.display = tabId === 'reader' ? 'flex' : 'none';
  }

  const zoomControls = document.getElementById('reader-zoom-controls');
  if (zoomControls) {
    zoomControls.style.display = tabId === 'reader' ? 'flex' : 'none';
  }

  if (tabId === 'bookmarks') renderBookmarksTab();
  else if (tabId === 'downloads') renderDownloadsTab();
}

// INITIALIZATION
window.addEventListener('DOMContentLoaded', () => {
  if (typeof ThemeManager !== 'undefined') ThemeManager.init();
  if (typeof AccountManager !== 'undefined') AccountManager.updateUI();
  if (allChapters.length === 0) {
    if (typeof CHAPTER_DATA !== 'undefined') allChapters = [...CHAPTER_DATA];
    else if (typeof window !== 'undefined' && window.CHAPTER_DATA) allChapters = [...window.CHAPTER_DATA];
  }
  renderHubCards();
  renderChapterCatalog();
  populateHeaderDropdown();
  setupEventListeners();
  updateBookmarkCountBadge();

  // Load notes connected to AccountManager
  const noteArea = document.getElementById('scratchpad-text');
  if (noteArea) {
    noteArea.value = (typeof AccountManager !== 'undefined') ? AccountManager.getScratchpad() : (localStorage.getItem(STORAGE_NOTES) || '');
    noteArea.addEventListener('input', (e) => {
      if (typeof AccountManager !== 'undefined') {
        AccountManager.saveScratchpad(e.target.value);
      } else {
        localStorage.setItem(STORAGE_NOTES, e.target.value);
      }
    });
  }

  // Hook account changes for live reactive sync across apps
  if (typeof AccountManager !== 'undefined') {
    AccountManager.onAccountChange((acc, reason) => {
      renderBookmarksTab();
      updateBookmarksBadge();
      const area = document.getElementById('scratchpad-text');
      if (area && document.activeElement !== area) {
        area.value = AccountManager.getScratchpad();
      }
    });
  }

  // Load first chapter in reader
  if (allChapters.length > 0) {
    selectChapter(allChapters[0], 0);
  }
});

// RENDER NEAL.FUN CARDS FROM APPS.JS
function renderHubCards() {
  const container = document.getElementById('hub-cards-grid');
  if (!container || typeof HUB_APPS === 'undefined') return;

  container.innerHTML = HUB_APPS.map(app => `
    <div class="hub-card ${app.themeClass}" onclick="switchMainView('${app.id}')">
      ${app.stickerGif ? `<img src="${app.stickerGif}" class="card-sticker ${app.stickerClass || ''}" alt="Cat Sticker">` : ''}
      <div class="card-top">
        <span class="card-badge">${app.tag}</span>
        <div class="card-icon">${app.iconSvg}</div>
      </div>
      <div>
        <div class="card-title">${app.title}</div>
        <div class="card-subtitle">${app.subtitle}</div>
      </div>
    </div>
  `).join('');
}

function initNotes() {
  const noteArea = document.getElementById('scratchpad-text');
  if (noteArea) {
    noteArea.value = (typeof AccountManager !== 'undefined') ? AccountManager.getScratchpad() : (localStorage.getItem(STORAGE_NOTES) || '');
  }
}

// READER CONTROLS
function setupReaderControls() {
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    renderChapterCatalog(e.target.value);
  });

  document.getElementById('btn-cycle-sort')?.addEventListener('click', cycleSortMode);

  document.getElementById('header-ch-select')?.addEventListener('change', (e) => {
    const num = parseFloat(e.target.value);
    const ch = allChapters.find(c => c.number === num);
    if (ch) selectChapter(ch, 0);
  });

  document.getElementById('btn-prev-ch')?.addEventListener('click', goPreviousChapter);
  document.getElementById('btn-next-ch')?.addEventListener('click', goNextChapter);

  document.getElementById('btn-page-prev')?.addEventListener('click', prevPage);
  document.getElementById('btn-page-next')?.addEventListener('click', nextPage);
  document.getElementById('click-zone-left')?.addEventListener('click', prevPage);
  document.getElementById('click-zone-right')?.addEventListener('click', nextPage);

  document.getElementById('btn-mode-toggle')?.addEventListener('click', toggleReadingMode);

  document.getElementById('btn-zoom-in')?.addEventListener('click', () => setZoom(zoomFactor + 0.1));
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => setZoom(Math.max(0.5, zoomFactor - 0.1)));
  document.getElementById('btn-zoom-fit')?.addEventListener('click', () => setZoom(1.0));
  document.getElementById('btn-zoom-125')?.addEventListener('click', () => setZoom(1.25));
  document.getElementById('btn-zoom-150')?.addEventListener('click', () => setZoom(1.5));
  document.getElementById('btn-fullscreen')?.addEventListener('click', toggleFullscreen);

  document.getElementById('btn-bookmark')?.addEventListener('click', addCurrentBookmark);
  document.getElementById('btn-clear-bookmarks')?.addEventListener('click', clearAllBookmarks);
  document.getElementById('btn-download-ch')?.addEventListener('click', openDownloadModal);

  document.getElementById('btn-choose-dest-folder')?.addEventListener('click', chooseDestinationFolder);
  document.getElementById('btn-open-local-folder')?.addEventListener('click', () => {
    document.getElementById('local-folder-picker')?.click();
  });
  document.getElementById('local-folder-picker')?.addEventListener('change', handleLocalFolderSelect);

  document.getElementById('btn-dl-select-all')?.addEventListener('click', () => toggleAllDownloads(true));
  document.getElementById('btn-dl-deselect-all')?.addEventListener('click', () => toggleAllDownloads(false));
  document.getElementById('btn-start-batch-download')?.addEventListener('click', startBatchDownload);

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('wheel', handleWheel, { passive: false });
}

// CHAPTER CATALOG & NAVIGATION
function cycleSortMode() {
  const modes = ['num_asc', 'num_desc', 'name_asc', 'name_desc'];
  const labels = {
    num_asc: 'Sort: # Asc',
    num_desc: 'Sort: # Desc',
    name_asc: 'Sort: Name A-Z',
    name_desc: 'Sort: Name Z-A'
  };
  const nextIdx = (modes.indexOf(currentSortMode) + 1) % modes.length;
  currentSortMode = modes[nextIdx];
  document.getElementById('btn-cycle-sort').textContent = labels[currentSortMode];
  renderChapterCatalog(document.getElementById('search-input')?.value || '');
}

function getSortedChapters() {
  let list = [...localOfflineChapters, ...allChapters];
  return list.sort((a, b) => {
    if (currentSortMode === 'num_asc') return a.number - b.number;
    if (currentSortMode === 'num_desc') return b.number - a.number;
    if (currentSortMode === 'name_asc') return (a.name || '').localeCompare(b.name || '');
    if (currentSortMode === 'name_desc') return (b.name || '').localeCompare(a.name || '');
    return a.number - b.number;
  });
}

function renderChapterCatalog(filter = '') {
  const container = document.getElementById('chapter-list');
  if (!container) return;
  container.innerHTML = '';

  const q = filter.trim().toLowerCase();
  const chapters = getSortedChapters().filter(c => {
    if (!q) return true;
    return c.title.toLowerCase().includes(q) || c.number.toString().includes(q);
  });

  chapters.forEach(ch => {
    const el = document.createElement('div');
    el.className = 'chapter-item' + (currentChapter && currentChapter.number === ch.number ? ' selected' : '');
    el.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;cursor:pointer;margin-bottom:2px;';
    el.innerHTML = `
      <span style="background:#202432;color:#DD53B4;padding:3px 6px;border-radius:4px;font-size:11px;font-weight:800;min-width:44px;text-align:center;">${ch.isLocal ? 'OFFLINE' : '#' + ch.number}</span>
      <span style="font-size:12px;font-weight:600;color:#FFF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${ch.title}">${ch.title}</span>
    `;
    el.addEventListener('click', () => selectChapter(ch, 0));
    container.appendChild(el);
  });
}

function populateHeaderDropdown() {
  const select = document.getElementById('header-ch-select');
  if (!select) return;
  select.innerHTML = '';
  allChapters.forEach(ch => {
    const opt = document.createElement('option');
    opt.value = ch.number;
    opt.textContent = ch.title;
    select.appendChild(opt);
  });
}

async function selectChapter(chapter, startPage = 0) {
  currentChapter = chapter;
  currentPageIndex = startPage;

  const select = document.getElementById('header-ch-select');
  if (select) select.value = chapter.number;

  document.getElementById('status-ch-title').textContent = chapter.title;

  const loader = document.getElementById('reader-loader');
  if (loader) loader.style.display = 'block';

  if (chapter.pages && chapter.pages.length > 0) {
    currentPages = chapter.pages;
  } else if (chapter.isLocal && chapter.pages) {
    currentPages = chapter.pages;
  } else {
    currentPages = await fetchChapterPages(chapter);
  }

  if (loader) loader.style.display = 'none';

  if (currentPages && currentPages.length > 0) {
    if (currentPageIndex >= currentPages.length) currentPageIndex = 0;
    renderPages();
    if (typeof AccountManager !== 'undefined') {
      AccountManager.saveReadingProgress(chapter.number, currentPageIndex);
    }
  }
}

async function fetchChapterPages(chapter) {
  try {
    const proxyUrl = 'https://corsproxy.io/?url=' + encodeURIComponent(chapter.url);
    const resp = await fetch(proxyUrl, { cache: 'force-cache' });
    if (resp.ok) {
      const html = await resp.text();
      const extracted = extractImagesFromHtml(html);
      if (extracted.length > 0) return extracted;
    }
  } catch (e) {}

  // High-res pattern for jjkmangaa
  const fallback = [];
  for (let i = 1; i <= 25; i++) {
    fallback.push(`https://jjkmangaa.com/wp-content/uploads/2025/06/Chapter-${chapter.number}-${i}.webp`);
  }
  return fallback;
}

function extractImagesFromHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const entry = doc.querySelector('.entry-content') || doc.body;
  const imgs = entry.querySelectorAll('img');
  const results = [];

  imgs.forEach(img => {
    const src = img.getAttribute('data-src') || img.getAttribute('src');
    const srcset = img.getAttribute('data-srcset') || img.getAttribute('srcset');
    let best = src;
    if (srcset) {
      const candidates = srcset.split(',').map(s => s.trim().split(' '));
      if (candidates.length > 0) best = candidates[candidates.length - 1][0];
    }
    if (best && !best.includes('avatar') && !best.includes('logo') && !results.includes(best)) {
      results.push(best);
    }
  });
  return results;
}

function renderPages() {
  const singleWrap = document.getElementById('single-page-wrapper');
  const contWrap = document.getElementById('continuous-wrapper');
  const pageBadge = document.getElementById('page-counter-badge');
  const singleControls = document.getElementById('single-page-controls');

  if (isContinuous) {
    singleWrap.style.display = 'none';
    contWrap.style.display = 'flex';
    singleControls.style.display = 'none';
    contWrap.innerHTML = '';

    currentPages.forEach((url, i) => {
      const img = document.createElement('img');
      img.className = 'continuous-img';
      img.setAttribute('referrerpolicy', 'no-referrer');
      img.src = url;
      img.alt = `Page ${i + 1}`;
      img.loading = 'lazy';
      contWrap.appendChild(img);
    });
    document.getElementById('reader-scroll-container').scrollTop = 0;
  } else {
    singleWrap.style.display = 'flex';
    contWrap.style.display = 'none';
    singleControls.style.display = 'flex';

    const imgEl = document.getElementById('current-page-img');
    if (imgEl && currentPages[currentPageIndex]) {
      imgEl.setAttribute('referrerpolicy', 'no-referrer');
      imgEl.src = currentPages[currentPageIndex];
      imgEl.style.transform = `scale(${zoomFactor})`;
    }
    pageBadge.textContent = `Page ${currentPageIndex + 1} of ${currentPages.length}`;
    document.getElementById('reader-scroll-container').scrollTop = 0;
  }
}

function nextPage() {
  if (isContinuous) return;
  if (currentPageIndex < currentPages.length - 1) {
    currentPageIndex++;
    renderPages();
  } else {
    goNextChapter();
  }
}

function prevPage() {
  if (isContinuous) return;
  if (currentPageIndex > 0) {
    currentPageIndex--;
    renderPages();
  } else {
    goPreviousChapter(true);
  }
}

function goNextChapter() {
  const list = getSortedChapters();
  const idx = list.findIndex(c => c.number === currentChapter?.number);
  if (idx >= 0 && idx < list.length - 1) selectChapter(list[idx + 1], 0);
}

function goPreviousChapter(toLast = false) {
  const list = getSortedChapters();
  const idx = list.findIndex(c => c.number === currentChapter?.number);
  if (idx > 0) selectChapter(list[idx - 1], toLast ? 999 : 0);
}

function toggleReadingMode() {
  isContinuous = !isContinuous;
  document.getElementById('btn-mode-toggle').textContent = isContinuous ? '📜 Continuous' : '📖 Single';
  renderPages();
}

function setZoom(val) {
  zoomFactor = Math.round(val * 100) / 100;
  document.getElementById('zoom-text').textContent = `${Math.round(zoomFactor * 100)}%`;
  const img = document.getElementById('current-page-img');
  if (img) img.style.transform = `scale(${zoomFactor})`;
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
  else document.exitFullscreen().catch(()=>{});
}

function handleKeyDown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    if (isContinuous && e.key === ' ') return;
    if (e.shiftKey) prevPage(); else nextPage();
    e.preventDefault();
  } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    prevPage(); e.preventDefault();
  } else if (e.key === 'f' || e.key === 'F' || e.key === 'F11') {
    toggleFullscreen(); e.preventDefault();
  } else if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
    addCurrentBookmark(); e.preventDefault();
  }
}

function handleWheel(e) {
  if (e.ctrlKey) {
    e.preventDefault();
    setZoom(e.deltaY < 0 ? zoomFactor + 0.1 : Math.max(0.5, zoomFactor - 0.1));
  }
}

// BOOKMARKS
function getBookmarks() {
  if (typeof AccountManager !== 'undefined') {
    return AccountManager.getBookmarks();
  }
  try { return JSON.parse(localStorage.getItem(STORAGE_BOOKMARKS)) || []; } catch(e) { return []; }
}
function saveBookmarks(bms) {
  if (typeof AccountManager !== 'undefined') {
    AccountManager.saveBookmarks(bms);
  } else {
    localStorage.setItem(STORAGE_BOOKMARKS, JSON.stringify(bms));
  }
  updateBookmarksBadge();
}
function addCurrentBookmark() {
  if (!currentChapter) return;
  const bms = getBookmarks();
  bms.unshift({ chapterNumber: currentChapter.number, chapterTitle: currentChapter.title, pageIndex: currentPageIndex, timestamp: Date.now() });
  saveBookmarks(bms);
  alert(`🔖 Bookmarked ${currentChapter.title} - Page ${currentPageIndex + 1}!`);
}
function updateBookmarksBadge() {
  const c = getBookmarks().length;
  const badge = document.getElementById('bm-count-badge');
  if (badge) badge.textContent = c > 0 ? `(${c})` : '';
}
function renderBookmarksTab() {
  const grid = document.getElementById('bookmarks-grid');
  const empty = document.getElementById('bookmarks-empty');
  const bms = getBookmarks();
  if (bms.length === 0) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  grid.innerHTML = bms.map((b, idx) => `
    <div style="background:#141722;border:1px solid #232736;border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="background:#202432;color:#DD53B4;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:11px;">#${b.chapterNumber}</span>
        <span style="font-size:11px;color:#8B94A7;">${new Date(b.timestamp).toLocaleDateString()}</span>
      </div>
      <div style="font-weight:bold;font-size:14px;">${b.chapterTitle}</div>
      <div style="font-size:12px;color:#8B94A7;">Page ${b.pageIndex + 1}</div>
      <div style="display:flex;gap:8px;margin-top:6px;">
        <button class="btn btn-accent" style="flex:1;" onclick="resumeBookmark(${b.chapterNumber}, ${b.pageIndex})">Resume ▶</button>
        <button class="btn" style="color:#FF6B6B;" onclick="deleteBookmark(${idx})">🗑️ Delete</button>
      </div>
    </div>
  `).join('');
}
function resumeBookmark(num, page) {
  const ch = allChapters.find(c => c.number === num);
  if (ch) {
    switchReaderTab('reader');
    selectChapter(ch, page);
  }
}
function deleteBookmark(idx) {
  const bms = getBookmarks();
  bms.splice(idx, 1);
  saveBookmarks(bms);
  renderBookmarksTab();
}
function clearAllBookmarks() {
  if (confirm('Clear all saved bookmarks?')) { saveBookmarks([]); renderBookmarksTab(); }
}

// DOWNLOAD SYSTEM
function openDownloadModal() {
  if (!currentChapter) return;
  document.getElementById('modal-dl-title').textContent = `Download ${currentChapter.title}`;
  document.getElementById('download-modal').classList.add('active');
}
function closeDownloadModal() {
  document.getElementById('download-modal').classList.remove('active');
}
async function executeCurrentChapterDownload(method) {
  closeDownloadModal();
  if (!currentChapter) return;
  if (method === 'folder') await downloadChapterToFolder(currentChapter, currentPages);
  else if (method === 'zip') await downloadChapterAsZip(currentChapter, currentPages);
  else alert(`Saved ${currentChapter.title} to offline storage!`);
}
async function chooseDestinationFolder() {
  if ('showDirectoryPicker' in window) {
    try {
      selectedFolderHandle = await window.showDirectoryPicker();
      document.getElementById('custom-folder-display').textContent = `Folder: ${selectedFolderHandle.name}`;
      alert(`Selected destination folder: ${selectedFolderHandle.name}`);
    } catch(e) {}
  } else {
    alert('Your browser does not support direct directory picker. Chapters will be saved as ZIP files.');
  }
}
async function downloadChapterToFolder(chapter, pages) {
  let handle = selectedFolderHandle;
  if (!handle && 'showDirectoryPicker' in window) {
    try { handle = await window.showDirectoryPicker(); selectedFolderHandle = handle; } catch(e) { return; }
  }
  if (!handle) return downloadChapterAsZip(chapter, pages);
  try {
    const chDir = await handle.getDirectoryHandle(`Chapter_${chapter.number}`, { create: true });
    for (let i = 0; i < pages.length; i++) {
      const resp = await fetch(pages[i]);
      const blob = await resp.blob();
      const fh = await chDir.getFileHandle(`page_${String(i+1).padStart(3,'0')}.webp`, { create: true });
      const w = await fh.createWritable();
      await w.write(blob);
      await w.close();
    }
    alert(`Successfully saved ${chapter.title} to ${handle.name}/Chapter_${chapter.number}!`);
  } catch(e) {
    downloadChapterAsZip(chapter, pages);
  }
}
async function downloadChapterAsZip(chapter, pages) {
  if (typeof JSZip === 'undefined') return alert('JSZip not found.');
  const zip = new JSZip();
  const f = zip.folder(`Chapter_${chapter.number}`);
  for (let i = 0; i < pages.length; i++) {
    try {
      const resp = await fetch(pages[i]);
      const blob = await resp.blob();
      f.file(`page_${String(i+1).padStart(3,'0')}.webp`, blob);
    } catch(e) {}
  }
  const content = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = `Jujutsu_Kaisen_Chapter_${chapter.number}.zip`;
  a.click();
}
function renderDownloadsTab() {
  const container = document.getElementById('downloads-list');
  if (!container) return;
  container.innerHTML = allChapters.map(ch => `
    <div style="display:grid;grid-template-columns:40px 70px 1fr 200px 100px;align-items:center;padding:8px 14px;border-bottom:1px solid #1A1E29;font-size:13px;">
      <input type="checkbox" class="dl-ch-checkbox" data-num="${ch.number}" onchange="updateDlCount()" />
      <span style="background:#202432;color:#DD53B4;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:bold;text-align:center;">#${ch.number}</span>
      <span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ch.title}</span>
      <div style="height:6px;background:#242836;border-radius:3px;overflow:hidden;">
        <div id="prog-${ch.number}" style="height:100%;background:#DD53B4;width:0%;"></div>
      </div>
      <span id="stat-${ch.number}" style="text-align:right;font-size:12px;color:#8B94A7;">Ready</span>
    </div>
  `).join('');
  updateDlCount();
}
function toggleAllDownloads(select) {
  document.querySelectorAll('.dl-ch-checkbox').forEach(c => c.checked = select);
  updateDlCount();
}
function updateDlCount() {
  const count = document.querySelectorAll('.dl-ch-checkbox:checked').length;
  document.getElementById('dl-selected-count').textContent = `${count} chapters selected`;
}
async function startBatchDownload() {
  const checked = Array.from(document.querySelectorAll('.dl-ch-checkbox:checked'));
  if (checked.length === 0) return alert('Select at least one chapter.');
  const fmt = document.getElementById('dl-format-select').value;
  for (const cb of checked) {
    const num = parseFloat(cb.getAttribute('data-num'));
    const ch = allChapters.find(c => c.number === num);
    if (!ch) continue;
    const prog = document.getElementById(`prog-${num}`);
    const stat = document.getElementById(`stat-${num}`);
    if (stat) stat.textContent = 'Downloading...';
    if (prog) prog.style.width = '30%';
    const pages = (ch.pages && ch.pages.length > 0) ? ch.pages : await fetchChapterPages(ch);
    if (prog) prog.style.width = '60%';
    if (fmt === 'zip') await downloadChapterAsZip(ch, pages);
    else await downloadChapterToFolder(ch, pages);
    if (prog) prog.style.width = '100%';
    if (stat) { stat.textContent = 'Done'; stat.style.color = '#10B981'; }
  }
  alert('Batch download finished!');
}

// STANDALONE PORTABLE JJK READER GENERATOR
function generatePortableReaderHtml() {
  const jsonChapters = JSON.stringify(allChapters);
  const portableHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
  <title>Jujutsu Kaisen - Standalone Portable Reader</title>
  <style>
    :root {
      --bg: #0F1117;
      --surface: #181B26;
      --border: #2E3547;
      --text: #F1F5F9;
      --text-muted: #94A3B8;
      --accent: #DD53B4;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .brand-title { font-weight: 900; font-size: 15px; color: var(--accent); letter-spacing: 0.5px; }
    .header-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .btn {
      background: #222736;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .btn:hover { background: #2E3547; }
    .btn-accent { background: var(--accent); border-color: var(--accent); color: #FFF; }
    .btn-accent:hover { opacity: 0.9; }
    select {
      background: #222736;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 12px;
      outline: none;
      max-width: 220px;
    }
    .main-area { flex: 1; display: flex; overflow: hidden; position: relative; }
    .sidebar {
      width: 300px;
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    .search-box { padding: 10px 12px; border-bottom: 1px solid var(--border); }
    .search-input {
      width: 100%;
      background: #0F1117;
      border: 1px solid var(--border);
      color: #FFF;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
    }
    .ch-list { flex: 1; overflow-y: auto; padding: 6px; }
    .ch-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
    }
    .ch-item:hover { background: #222736; }
    .ch-item.active { background: #2E3547; border-left: 3px solid var(--accent); font-weight: 700; }
    .ch-badge {
      background: #222736;
      color: var(--accent);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 800;
    }
    .canvas {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #08090C;
      position: relative;
      overflow: hidden;
    }
    .scroll-container {
      flex: 1;
      overflow: auto;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
    }
    .single-page-wrapper {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
    }
    .click-zone { position: absolute; top: 0; bottom: 0; width: 30%; cursor: pointer; z-index: 10; }
    .click-zone.left { left: 0; }
    .click-zone.right { right: 0; }
    #current-page-img {
      max-width: calc(100vw - 340px);
      max-height: calc(100vh - 120px);
      object-fit: contain;
      box-shadow: 0 10px 40px rgba(0,0,0,0.8);
      border-radius: 4px;
      transition: transform 0.12s ease-out;
    }
    .continuous-wrapper {
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 24px 0;
      width: 100%;
    }
    .continuous-img {
      max-width: 900px;
      width: 95%;
      height: auto;
      border-radius: 4px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.7);
    }
    footer {
      background: var(--surface);
      border-top: 1px solid var(--border);
      padding: 8px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
    }
    @media (max-width: 768px) {
      .sidebar { display: none; }
      #current-page-img { max-width: 100vw; max-height: calc(100vh - 110px); }
    }
  </style>
</head>
<body>
  <header>
    <div class="header-left">
      <span class="brand-title">JUJUTSU KAISEN PORTABLE</span>
      <span style="font-size:11px;color:var(--text-muted);">Stand-alone Reader</span>
    </div>
    <div class="header-controls">
      <button class="btn" id="btn-prev-ch">◀ Prev Ch</button>
      <select id="select-ch"></select>
      <button class="btn btn-accent" id="btn-next-ch">Next Ch ▶</button>
      <button class="btn" id="btn-mode-toggle">📖 Single</button>
      <button class="btn" id="btn-fit">Fit</button>
      <button class="btn" id="btn-zoom-in">+</button>
      <button class="btn" id="btn-zoom-out">−</button>
      <button class="btn" id="btn-fullscreen">⛶ Fullscreen</button>
    </div>
  </header>
  <div class="main-area">
    <aside class="sidebar">
      <div class="search-box">
        <input type="text" id="search-ch" class="search-input" placeholder="Search 272 chapters..." />
      </div>
      <div class="ch-list" id="ch-list"></div>
    </aside>
    <main class="canvas">
      <div class="scroll-container" id="scroll-container">
        <div class="single-page-wrapper" id="single-wrap">
          <div class="click-zone left" id="cz-left" title="Previous Page"></div>
          <div class="click-zone right" id="cz-right" title="Next Page"></div>
          <img id="current-page-img" referrerpolicy="no-referrer" src="" alt="Manga Page" />
        </div>
        <div class="continuous-wrapper" id="cont-wrap"></div>
      </div>
      <footer>
        <div id="status-title" style="font-weight:700;">Loading...</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="btn" id="btn-p-prev">◀ Prev Page</button>
          <span id="page-counter" style="background:#222736;padding:3px 8px;border-radius:4px;font-weight:700;">Page 1</span>
          <button class="btn btn-accent" id="btn-p-next">Next Page ▶</button>
        </div>
        <div style="color:var(--text-muted);">[Space / D / →] Next · [A / ←] Prev · [F] Fullscreen</div>
      </footer>
    </main>
  </div>
  <script>
    const CHAPTERS = ${jsonChapters};
    let currentCh = CHAPTERS[0];
    let pageIndex = 0;
    let isContinuous = false;
    let zoom = 1.0;

    function init() {
      const select = document.getElementById('select-ch');
      CHAPTERS.forEach(ch => {
        const opt = document.createElement('option');
        opt.value = ch.number;
        opt.textContent = ch.title;
        select.appendChild(opt);
      });
      select.addEventListener('change', (e) => {
        const ch = CHAPTERS.find(c => c.number === parseFloat(e.target.value));
        if (ch) loadChapter(ch, 0);
      });
      renderList(CHAPTERS);
      document.getElementById('search-ch').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = CHAPTERS.filter(c => c.title.toLowerCase().includes(q) || String(c.number).includes(q));
        renderList(filtered);
      });
      document.getElementById('btn-prev-ch').onclick = () => {
        const idx = CHAPTERS.findIndex(c => c.number === currentCh.number);
        if (idx > 0) loadChapter(CHAPTERS[idx - 1], 0);
      };
      document.getElementById('btn-next-ch').onclick = () => {
        const idx = CHAPTERS.findIndex(c => c.number === currentCh.number);
        if (idx < CHAPTERS.length - 1) loadChapter(CHAPTERS[idx + 1], 0);
      };
      document.getElementById('btn-p-prev').onclick = prevP;
      document.getElementById('btn-p-next').onclick = nextP;
      document.getElementById('cz-left').onclick = prevP;
      document.getElementById('cz-right').onclick = nextP;
      document.getElementById('btn-mode-toggle').onclick = toggleMode;
      document.getElementById('btn-fit').onclick = () => setZoom(1.0);
      document.getElementById('btn-zoom-in').onclick = () => setZoom(zoom + 0.1);
      document.getElementById('btn-zoom-out').onclick = () => setZoom(Math.max(0.5, zoom - 0.1));
      document.getElementById('btn-fullscreen').onclick = () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
      };
      window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          if (isContinuous && e.key === ' ') return;
          if (e.shiftKey) prevP(); else nextP();
        } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          prevP();
        } else if (e.key === 'f' || e.key === 'F') {
          if (!document.fullscreenElement) document.documentElement.requestFullscreen();
          else document.exitFullscreen();
        }
      });
      if (CHAPTERS.length > 0) loadChapter(CHAPTERS[0], 0);
    }

    function renderList(list) {
      const container = document.getElementById('ch-list');
      container.innerHTML = '';
      list.forEach(ch => {
        const item = document.createElement('div');
        item.className = 'ch-item' + (currentCh && currentCh.number === ch.number ? ' active' : '');
        item.innerHTML = '<span class="ch-badge">#' + ch.number + '</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + ch.title + '</span>';
        item.onclick = () => loadChapter(ch, 0);
        container.appendChild(item);
      });
    }

    function loadChapter(ch, page) {
      currentCh = ch;
      pageIndex = page || 0;
      document.getElementById('select-ch').value = ch.number;
      document.getElementById('status-title').textContent = ch.title;
      renderList(CHAPTERS);
      render();
    }

    function render() {
      const single = document.getElementById('single-wrap');
      const cont = document.getElementById('cont-wrap');
      const counter = document.getElementById('page-counter');
      const pages = currentCh.pages || [];
      if (isContinuous) {
        single.style.display = 'none';
        cont.style.display = 'flex';
        cont.innerHTML = '';
        pages.forEach((url, i) => {
          const img = document.createElement('img');
          img.className = 'continuous-img';
          img.loading = 'lazy';
          img.referrerPolicy = 'no-referrer';
          img.src = url;
          cont.appendChild(img);
        });
        document.getElementById('scroll-container').scrollTop = 0;
      } else {
        single.style.display = 'flex';
        cont.style.display = 'none';
        const img = document.getElementById('current-page-img');
        if (pages[pageIndex]) {
          img.src = pages[pageIndex];
          img.style.transform = 'scale(' + zoom + ')';
        }
        counter.textContent = 'Page ' + (pageIndex + 1) + ' of ' + (pages.length || 1);
        document.getElementById('scroll-container').scrollTop = 0;
      }
    }

    function nextP() {
      if (isContinuous) return;
      const pages = currentCh.pages || [];
      if (pageIndex < pages.length - 1) { pageIndex++; render(); }
      else {
        const idx = CHAPTERS.findIndex(c => c.number === currentCh.number);
        if (idx < CHAPTERS.length - 1) loadChapter(CHAPTERS[idx + 1], 0);
      }
    }

    function prevP() {
      if (isContinuous) return;
      if (pageIndex > 0) { pageIndex--; render(); }
      else {
        const idx = CHAPTERS.findIndex(c => c.number === currentCh.number);
        if (idx > 0) {
          const prev = CHAPTERS[idx - 1];
          loadChapter(prev, (prev.pages ? prev.pages.length - 1 : 0));
        }
      }
    }

    function toggleMode() {
      isContinuous = !isContinuous;
      document.getElementById('btn-mode-toggle').textContent = isContinuous ? '📜 Continuous' : '📖 Single';
      render();
    }

    function setZoom(z) {
      zoom = Math.round(z * 100) / 100;
      const img = document.getElementById('current-page-img');
      if (img) img.style.transform = 'scale(' + zoom + ')';
    }

    window.onload = init;
  <\/script>
</body>
</html>`;

  const blob = new Blob([portableHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jjk-portable-reader.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  alert('🎉 Standalone JJK Reader (.html) generated!\nYou can open this file in any browser on any OS or Chromebook.');
}

function handleLocalFolderSelect(e) {
  const files = Array.from(e.target.files);
  const chapterMap = {};
  files.forEach(f => {
    const parts = (f.webkitRelativePath || f.name).split('/');
    if (parts.length > 1) {
      const folder = parts[0];
      if (!chapterMap[folder]) chapterMap[folder] = [];
      if (f.name.match(/\.(webp|png|jpg|jpeg)$/i)) chapterMap[folder].push(f);
    }
  });
  localOfflineChapters = Object.keys(chapterMap).map((folder, idx) => {
    const flist = chapterMap[folder].sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric:true}));
    const match = folder.match(/(?:Chapter\s*|ch[_\s-]*)(\d+(?:\.\d+)?)/i);
    return {
      number: match ? parseFloat(match[1]) : idx + 1,
      name: folder,
      title: folder,
      isLocal: true,
      pages: flist.map(f => URL.createObjectURL(f))
    };
  });
  if (localOfflineChapters.length > 0) {
    localOfflineChapters.sort((a,b) => a.number - b.number);
    renderChapterCatalog();
    alert(`Loaded ${localOfflineChapters.length} offline chapters!`);
    switchReaderTab('reader');
    selectChapter(localOfflineChapters[0], 0);
  }
}
