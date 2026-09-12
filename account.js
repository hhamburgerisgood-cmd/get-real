// =========================================================
// GET REAL - UNIFIED CROSS-APP ACCOUNT & SYNC ENGINE
// Syncs identity, bookmarks, notes, chat, and forum across all apps
// =========================================================

const AccountManager = (() => {
  const STORAGE_ACCOUNTS = 'get_real_accounts_v1';
  const STORAGE_ACTIVE_ID = 'get_real_active_account_id_v1';
  const BROADCAST_CHANNEL = 'get_real_account_broadcast_v1';

  // Available official avatar stickers (from Elgatitolover GIFs)
  const AVATARS = [
    { key: 'logo_avatar', name: 'Spinning Cat', src: 'assets/logo_avatar.gif' },
    { key: 'cat_accordion', name: 'Accordion Cat', src: 'assets/cat_accordion.gif' },
    { key: 'cat_tuba', name: 'Tuba Cat', src: 'assets/cat_tuba.gif' },
    { key: 'cat_horse', name: 'Horse Rider', src: 'assets/cat_horse.gif' },
    { key: 'cat_peeking', name: 'Peeking Cat', src: 'assets/cat_peeking.gif' }
  ];

  let accounts = [];
  let activeAccountId = null;
  let broadcast = null;
  const changeListeners = [];

  function generateId() {
    return 'acc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  }

  function createDefaultAccount(username = 'AnonCat', avatar = 'logo_avatar') {
    return {
      id: generateId(),
      username: username,
      displayName: username,
      avatar: avatar,
      bio: 'Reading Jujutsu Kaisen & exploring Get Real',
      color: '#DD53B4',
      createdAt: Date.now(),
      // Synced app data
      bookmarks: [],
      lastRead: { chapterNumber: 1, pageIndex: 0, timestamp: Date.now() },
      scratchpad: '',
      forumPosts: [],
      savedRooms: ['lobby', 'manga-lounge', 'gaming']
    };
  }

  function init() {
    // 1. Load accounts from storage
    try {
      const rawAccounts = localStorage.getItem(STORAGE_ACCOUNTS);
      if (rawAccounts) {
        accounts = JSON.parse(rawAccounts);
      }
    } catch (e) {
      accounts = [];
    }

    // 2. Load active account ID
    try {
      activeAccountId = localStorage.getItem(STORAGE_ACTIVE_ID);
    } catch (e) {}

    // 3. First-run or legacy migration
    if (!Array.isArray(accounts) || accounts.length === 0) {
      let legacyUser = 'AnonCat';
      try {
        const savedChatUser = localStorage.getItem('hub_chat_user_handle');
        if (savedChatUser && savedChatUser.trim()) {
          legacyUser = savedChatUser.replace(/^@+/, '').trim();
        }
      } catch (e) {}

      const defaultAcc = createDefaultAccount(legacyUser, 'logo_avatar');

      try {
        const legacyBms = localStorage.getItem('jk_bookmarks_v1');
        if (legacyBms) {
          const parsed = JSON.parse(legacyBms);
          if (Array.isArray(parsed)) defaultAcc.bookmarks = parsed;
        }
      } catch (e) {}

      try {
        const legacyNotes = localStorage.getItem('hub_scratchpad_v1');
        if (legacyNotes) {
          defaultAcc.scratchpad = legacyNotes;
        }
      } catch (e) {}

      accounts = [defaultAcc];
      activeAccountId = defaultAcc.id;
      persist();
    } else {
      const exists = accounts.find(a => a.id === activeAccountId);
      if (!exists) {
        activeAccountId = accounts[0].id;
        try { localStorage.setItem(STORAGE_ACTIVE_ID, activeAccountId); } catch(e) {}
      }
    }

    // 4. Setup BroadcastChannel for live cross-tab sync
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        broadcast = new BroadcastChannel(BROADCAST_CHANNEL);
        broadcast.onmessage = (event) => {
          if (event.data && event.data.type === 'ACCOUNT_SYNC') {
            reloadFromStorage();
          }
        };
      }
    } catch (e) {}

    // 5. Update UI badges across all views
    updateUI();
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_ACCOUNTS, JSON.stringify(accounts));
      if (activeAccountId) {
        localStorage.setItem(STORAGE_ACTIVE_ID, activeAccountId);
      }
    } catch (e) {}

    const active = getActiveAccount();
    if (active) {
      try {
        localStorage.setItem('hub_chat_user_handle', active.username);
        localStorage.setItem('jk_bookmarks_v1', JSON.stringify(active.bookmarks || []));
        localStorage.setItem('hub_scratchpad_v1', active.scratchpad || '');
      } catch (e) {}
    }
  }

  function reloadFromStorage() {
    try {
      const rawAccounts = localStorage.getItem(STORAGE_ACCOUNTS);
      if (rawAccounts) accounts = JSON.parse(rawAccounts);
      activeAccountId = localStorage.getItem(STORAGE_ACTIVE_ID) || (accounts[0] && accounts[0].id);
    } catch (e) {}
    updateUI();
    notifyListeners('reload');
  }

  function getAccounts() {
    return accounts;
  }

  function getActiveAccount() {
    const acc = accounts.find(a => a.id === activeAccountId);
    return acc || accounts[0] || null;
  }

  function getUsername() {
    const acc = getActiveAccount();
    return acc ? acc.username : 'AnonCat';
  }

  function getHandle() {
    const u = getUsername();
    return u.startsWith('@') ? u : '@' + u;
  }

  function getDisplayName() {
    const acc = getActiveAccount();
    return (acc && acc.displayName) ? acc.displayName : getUsername();
  }

  function getAvatarKey() {
    const acc = getActiveAccount();
    return acc && acc.avatar ? acc.avatar : 'logo_avatar';
  }

  function getAvatarSrc(avatarKey) {
    const key = avatarKey || getAvatarKey();
    const found = AVATARS.find(a => a.key === key);
    return found ? found.src : 'assets/logo_avatar.gif';
  }

  function getAvatarsList() {
    return AVATARS;
  }

  function updateActiveProfile(updates) {
    const acc = getActiveAccount();
    if (!acc) return;

    if (updates.username !== undefined) {
      const clean = updates.username.replace(/[^a-zA-Z0-9_-]/g, '').trim().substring(0, 20);
      if (clean.length > 0) acc.username = clean;
    }
    if (updates.displayName !== undefined) {
      acc.displayName = updates.displayName.trim().substring(0, 30) || acc.username;
    }
    if (updates.avatar !== undefined) {
      acc.avatar = updates.avatar;
    }
    if (updates.bio !== undefined) {
      acc.bio = updates.bio.trim().substring(0, 160);
    }

    persist();
    updateUI();
    notifyChange('profile');
  }

  function switchAccount(accountId) {
    const target = accounts.find(a => a.id === accountId);
    if (!target) return;

    activeAccountId = target.id;
    persist();
    updateUI();
    notifyChange('switch');
  }

  function createAccount(username, avatar = 'logo_avatar') {
    const cleanUser = (username || 'User' + Math.floor(Math.random() * 9000 + 1000))
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .trim()
      .substring(0, 20) || 'AnonCat';

    const newAcc = createDefaultAccount(cleanUser, avatar);
    accounts.push(newAcc);
    activeAccountId = newAcc.id;

    persist();
    updateUI();
    notifyChange('create');
    return newAcc;
  }

  function deleteAccount(accountId) {
    if (accounts.length <= 1) {
      alert('Cannot delete the only remaining account.');
      return false;
    }
    accounts = accounts.filter(a => a.id !== accountId);
    if (activeAccountId === accountId) {
      activeAccountId = accounts[0].id;
    }
    persist();
    updateUI();
    notifyChange('delete');
    return true;
  }

  // --- APP-SPECIFIC SYNC ACCESSORS ---

  // Manga Bookmarks Sync
  function getBookmarks() {
    const acc = getActiveAccount();
    return (acc && Array.isArray(acc.bookmarks)) ? acc.bookmarks : [];
  }

  function saveBookmarks(bms) {
    const acc = getActiveAccount();
    if (!acc) return;
    acc.bookmarks = bms;
    persist();
    notifyChange('bookmarks');
  }

  // Manga Reading Progress Sync
  function saveReadingProgress(chapterNumber, pageIndex) {
    const acc = getActiveAccount();
    if (!acc) return;
    acc.lastRead = {
      chapterNumber: chapterNumber,
      pageIndex: pageIndex,
      timestamp: Date.now()
    };
    persist();
    notifyChange('readingProgress');
  }

  function getReadingProgress() {
    const acc = getActiveAccount();
    return acc ? acc.lastRead : null;
  }

  // Quick Scratchpad Sync
  function getScratchpad() {
    const acc = getActiveAccount();
    return acc ? (acc.scratchpad || '') : '';
  }

  function saveScratchpad(text) {
    const acc = getActiveAccount();
    if (!acc) return;
    acc.scratchpad = text;
    persist();
    notifyChange('scratchpad');
  }

  // Forum Threads tracking
  function trackForumPost(postId) {
    const acc = getActiveAccount();
    if (!acc) return;
    if (!Array.isArray(acc.forumPosts)) acc.forumPosts = [];
    if (!acc.forumPosts.includes(postId)) {
      acc.forumPosts.push(postId);
      persist();
    }
  }

  // Notifications and Event Subscriptions
  function notifyChange(reason) {
    if (broadcast) {
      try {
        broadcast.postMessage({ type: 'ACCOUNT_SYNC', reason: reason, activeId: activeAccountId });
      } catch (e) {}
    }
    notifyListeners(reason);
  }

  function notifyListeners(reason) {
    changeListeners.forEach(cb => {
      try { cb(getActiveAccount(), reason); } catch(e) { console.error(e); }
    });
  }

  function onAccountChange(callback) {
    if (typeof callback === 'function') {
      changeListeners.push(callback);
    }
  }

  // --- PORTABILITY: EXPORT & IMPORT ---

  function exportAccountJson() {
    const active = getActiveAccount();
    if (!active) return '';
    const payload = {
      getRealSyncVersion: 1,
      exportedAt: Date.now(),
      account: active
    };
    return JSON.stringify(payload, null, 2);
  }

  function downloadAccountBackup() {
    const jsonStr = exportAccountJson();
    const active = getActiveAccount();
    const filename = `getreal-${active.username.toLowerCase()}-backup.json`;
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function getSyncToken() {
    const jsonStr = exportAccountJson();
    try {
      return btoa(unescape(encodeURIComponent(jsonStr)));
    } catch(e) {
      return btoa(jsonStr);
    }
  }

  function importAccountJson(rawString) {
    try {
      let data = null;
      if (!rawString.trim().startsWith('{')) {
        try {
          const decoded = decodeURIComponent(escape(atob(rawString.trim())));
          data = JSON.parse(decoded);
        } catch(e) {
          data = JSON.parse(atob(rawString.trim()));
        }
      } else {
        data = JSON.parse(rawString);
      }

      const incoming = data.account || data;
      if (!incoming || !incoming.username) {
        throw new Error('Invalid account data format');
      }

      const existingIdx = accounts.findIndex(a => a.id === incoming.id || a.username.toLowerCase() === incoming.username.toLowerCase());
      if (existingIdx >= 0) {
        accounts[existingIdx] = {
          ...accounts[existingIdx],
          ...incoming,
          id: accounts[existingIdx].id
        };
        activeAccountId = accounts[existingIdx].id;
      } else {
        incoming.id = generateId();
        accounts.push(incoming);
        activeAccountId = incoming.id;
      }

      persist();
      updateUI();
      notifyChange('import');
      return { success: true, username: incoming.username };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // --- UI UPDATES & MODAL CONTROLS ---

  function updateUI() {
    if (typeof document === 'undefined') return;

    const acc = getActiveAccount();
    if (!acc) return;

    const username = acc.username;
    const handle = getHandle();
    const avatarSrc = getAvatarSrc(acc.avatar);

    const hubName = document.getElementById('hub-account-name');
    if (hubName) hubName.textContent = handle;

    const hubAvatar = document.getElementById('hub-account-avatar');
    if (hubAvatar) hubAvatar.src = avatarSrc;

    const chatBadge = document.getElementById('chat-current-user-badge');
    if (chatBadge) chatBadge.textContent = handle;

    document.querySelectorAll('.account-username-text').forEach(el => {
      el.textContent = handle;
    });
    document.querySelectorAll('.account-avatar-mini').forEach(el => {
      el.src = avatarSrc;
    });

    const inputUser = document.getElementById('acc-edit-username');
    if (inputUser && document.activeElement !== inputUser) inputUser.value = username;

    const inputName = document.getElementById('acc-edit-displayname');
    if (inputName && document.activeElement !== inputName) inputName.value = acc.displayName || username;

    const inputBio = document.getElementById('acc-edit-bio');
    if (inputBio && document.activeElement !== inputBio) inputBio.value = acc.bio || '';
  }

  function openModal(initialTab = 'profile') {
    const modal = document.getElementById('modal-account');
    if (!modal) return;

    renderModalContent();
    switchModalTab(initialTab);
    modal.style.display = 'flex';
  }

  function closeModal() {
    const modal = document.getElementById('modal-account');
    if (modal) modal.style.display = 'none';
  }

  function switchModalTab(tabName) {
    document.querySelectorAll('.acc-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.acc-tab-content').forEach(pane => pane.style.display = 'none');

    const targetBtn = document.getElementById('acc-tab-btn-' + tabName);
    const targetPane = document.getElementById('acc-tab-pane-' + tabName);
    if (targetBtn) targetBtn.classList.add('active');
    if (targetPane) targetPane.style.display = 'block';

    if (tabName === 'switch') renderAccountsList();
    if (tabName === 'sync') updateSyncSummary();
  }

  function renderModalContent() {
    const acc = getActiveAccount();
    if (!acc) return;

    const inputUser = document.getElementById('acc-edit-username');
    if (inputUser) inputUser.value = acc.username;

    const inputName = document.getElementById('acc-edit-displayname');
    if (inputName) inputName.value = acc.displayName || acc.username;

    const inputBio = document.getElementById('acc-edit-bio');
    if (inputBio) inputBio.value = acc.bio || '';

    const avatarGrid = document.getElementById('acc-avatar-picker-grid');
    if (avatarGrid) {
      avatarGrid.innerHTML = AVATARS.map(av => `
        <div class="avatar-option ${acc.avatar === av.key ? 'selected' : ''}" onclick="AccountManager.selectAvatar('${av.key}')">
          <img src="${av.src}" alt="${av.name}">
          <span>${av.name}</span>
        </div>
      `).join('');
    }
  }

  function selectAvatar(key) {
    updateActiveProfile({ avatar: key });
    renderModalContent();
  }

  function saveProfileFromForm() {
    const inputUser = document.getElementById('acc-edit-username');
    const inputName = document.getElementById('acc-edit-displayname');
    const inputBio = document.getElementById('acc-edit-bio');

    if (!inputUser || !inputUser.value.trim()) {
      alert('Username cannot be empty.');
      return;
    }

    updateActiveProfile({
      username: inputUser.value.trim(),
      displayName: inputName ? inputName.value.trim() : inputUser.value.trim(),
      bio: inputBio ? inputBio.value.trim() : ''
    });

    closeModal();
  }

  function renderAccountsList() {
    const container = document.getElementById('acc-list-container');
    if (!container) return;

    const active = getActiveAccount();
    container.innerHTML = accounts.map(a => {
      const isActive = a.id === active.id;
      const bCount = Array.isArray(a.bookmarks) ? a.bookmarks.length : 0;
      const hasNotes = a.scratchpad && a.scratchpad.trim().length > 0;

      return `
        <div class="acc-card-item ${isActive ? 'active' : ''}">
          <div style="display:flex;align-items:center;gap:12px;">
            <img src="${getAvatarSrc(a.avatar)}" class="acc-item-avatar" alt="Avatar">
            <div>
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-weight:800;font-size:14px;color:var(--text);">${a.displayName || a.username}</span>
                <span style="font-size:12px;color:var(--text-muted);">@${a.username}</span>
                ${isActive ? '<span class="acc-active-badge">Active</span>' : ''}
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                📖 ${bCount} bookmarks · 📝 ${hasNotes ? 'Notes saved' : 'No notes'}
              </div>
            </div>
          </div>
          <div style="display:flex;gap:6px;">
            ${!isActive ? `<button class="btn btn-pill btn-accent" onclick="AccountManager.switchAccount('${a.id}'); AccountManager.renderAccountsList();" style="padding:4px 12px;font-size:12px;">Switch</button>` : ''}
            ${accounts.length > 1 ? `<button class="btn btn-pill" onclick="if(confirm('Delete account @${a.username}?')) { AccountManager.deleteAccount('${a.id}'); AccountManager.renderAccountsList(); }" style="color:#EF4444;padding:4px 8px;font-size:12px;" title="Delete Account">✕</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function updateSyncSummary() {
    const acc = getActiveAccount();
    if (!acc) return;

    const statBookmarks = document.getElementById('sync-stat-bookmarks');
    if (statBookmarks) statBookmarks.textContent = `${(acc.bookmarks || []).length} saved`;

    const statLastRead = document.getElementById('sync-stat-lastread');
    if (statLastRead) {
      statLastRead.textContent = acc.lastRead ? `Chapter ${acc.lastRead.chapterNumber}, Page ${acc.lastRead.pageIndex + 1}` : 'None yet';
    }

    const statNotes = document.getElementById('sync-stat-notes');
    if (statNotes) {
      const len = (acc.scratchpad || '').length;
      statNotes.textContent = len > 0 ? `${len} characters` : 'Empty';
    }
  }

  function handleImportFile(fileInput) {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const res = importAccountJson(e.target.result);
      if (res.success) {
        alert(`✓ Successfully synced account @${res.username}!`);
        closeModal();
      } else {
        alert('Error importing account: ' + res.error);
      }
      fileInput.value = '';
    };
    reader.readAsText(file);
  }

  function handleImportToken() {
    const input = document.getElementById('sync-token-input');
    if (!input || !input.value.trim()) {
      alert('Please paste a sync code first.');
      return;
    }

    const res = importAccountJson(input.value.trim());
    if (res.success) {
      alert(`✓ Successfully synced account @${res.username}!`);
      input.value = '';
      closeModal();
    } else {
      alert('Error importing sync code: ' + res.error);
    }
  }

  function copySyncCodeToClipboard() {
    const token = getSyncToken();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(token).then(() => {
        alert('✓ Sync code copied to clipboard! Paste it on your other computer or Chromebook.');
      }).catch(() => {
        prompt('Copy your sync code below:', token);
      });
    } else {
      prompt('Copy your sync code below:', token);
    }
  }

  function promptCreateNewAccount() {
    const username = prompt('Enter a username for the new account (e.g. SatoruGojo, AnonSchool):');
    if (!username || !username.trim()) return;

    createAccount(username.trim());
    renderAccountsList();
  }

  return {
    init,
    getAccounts,
    getActiveAccount,
    getUsername,
    getHandle,
    getDisplayName,
    getAvatarKey,
    getAvatarSrc,
    getAvatarsList,
    updateActiveProfile,
    switchAccount,
    createAccount,
    deleteAccount,
    selectAvatar,
    // Data sync accessors
    getBookmarks,
    saveBookmarks,
    getReadingProgress,
    saveReadingProgress,
    getScratchpad,
    saveScratchpad,
    trackForumPost,
    // Event listeners
    onAccountChange,
    notifyChange,
    // Portability & Backup
    exportAccountJson,
    downloadAccountBackup,
    getSyncToken,
    importAccountJson,
    handleImportFile,
    handleImportToken,
    copySyncCodeToClipboard,
    // UI Modal
    updateUI,
    openModal,
    closeModal,
    switchModalTab,
    saveProfileFromForm,
    renderAccountsList,
    promptCreateNewAccount
  };
})();

// Auto-initialize AccountManager
if (typeof window !== 'undefined') {
  window.AccountManager = AccountManager;
  AccountManager.init();
}
if (typeof module !== 'undefined') {
  module.exports = AccountManager;
}
