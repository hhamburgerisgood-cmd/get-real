// =========================================================
// GET REAL - PASSWORD-PROTECTED ACCOUNT & IDENTITY ENGINE
// Strict username uniqueness & anti-impersonation system
// =========================================================

const AccountManager = (() => {
  const STORAGE_ACCOUNTS = 'get_real_accounts_v2';
  const STORAGE_ACTIVE_ID = 'get_real_active_account_id_v2';
  const STORAGE_SESSION = 'get_real_auth_session_v2';
  const BROADCAST_CHANNEL = 'get_real_account_broadcast_v2';

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
  let isAuthenticatedSession = false;
  let broadcast = null;
  const changeListeners = [];

  // Guest data container when logged out
  let guestData = {
    username: 'Guest',
    displayName: 'Guest Reader',
    avatar: 'logo_avatar',
    bookmarks: [],
    lastRead: { chapterNumber: 1, pageIndex: 0, timestamp: Date.now() },
    scratchpad: ''
  };

  // --- CRYPTOGRAPHIC UTILITIES (Web Crypto SHA-256) ---

  function generateId() {
    return 'acc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  }

  function generateSalt() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  async function hashPassword(password, salt) {
    const raw = (salt || '') + '::get_real_salt::' + password;
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const enc = new TextEncoder();
      const buffer = await crypto.subtle.digest('SHA-256', enc.encode(raw));
      return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback simple hash for headless/legacy testing
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return 'sim_' + Math.abs(hash).toString(16);
  }

  // --- INITIALIZATION & STORAGE ---

  function init() {
    // 1. Load accounts from storage
    try {
      const raw = localStorage.getItem(STORAGE_ACCOUNTS);
      if (raw) {
        accounts = JSON.parse(raw);
      }
    } catch (e) {
      accounts = [];
    }

    // 2. Migration from v1 if v2 is empty
    if (!Array.isArray(accounts) || accounts.length === 0) {
      try {
        const v1Raw = localStorage.getItem('get_real_accounts_v1');
        if (v1Raw) {
          const v1Accounts = JSON.parse(v1Raw);
          if (Array.isArray(v1Accounts) && v1Accounts.length > 0) {
            accounts = v1Accounts.map(a => ({
              ...a,
              passwordHash: a.passwordHash || '',
              salt: a.salt || generateSalt()
            }));
            persist();
          }
        }
      } catch (e) {}
    }

    // 3. Load active session
    try {
      const savedAuthId = localStorage.getItem(STORAGE_ACTIVE_ID);
      const isAuthSaved = localStorage.getItem(STORAGE_SESSION) === 'true';
      if (savedAuthId) {
        const found = accounts.find(a => a.id === savedAuthId);
        if (found) {
          activeAccountId = found.id;
          isAuthenticatedSession = isAuthSaved;
        }
      }
    } catch (e) {}

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

    updateUI();
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_ACCOUNTS, JSON.stringify(accounts));
      if (activeAccountId && isAuthenticatedSession) {
        localStorage.setItem(STORAGE_ACTIVE_ID, activeAccountId);
        localStorage.setItem(STORAGE_SESSION, 'true');
      } else {
        localStorage.removeItem(STORAGE_ACTIVE_ID);
        localStorage.setItem(STORAGE_SESSION, 'false');
      }
    } catch (e) {}

    // Legacy fallback keys
    const active = getActiveAccount();
    if (active && isAuthenticatedSession) {
      try {
        localStorage.setItem('hub_chat_user_handle', active.username);
        localStorage.setItem('jk_bookmarks_v1', JSON.stringify(active.bookmarks || []));
        localStorage.setItem('hub_scratchpad_v1', active.scratchpad || '');
      } catch (e) {}
    }
  }

  function reloadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_ACCOUNTS);
      if (raw) accounts = JSON.parse(raw);
      const savedId = localStorage.getItem(STORAGE_ACTIVE_ID);
      const isAuth = localStorage.getItem(STORAGE_SESSION) === 'true';
      if (savedId && accounts.some(a => a.id === savedId)) {
        activeAccountId = savedId;
        isAuthenticatedSession = isAuth;
      } else {
        activeAccountId = null;
        isAuthenticatedSession = false;
      }
    } catch (e) {}
    updateUI();
    notifyListeners('reload');
  }

  // --- USERNAME UNIQUENESS & RESERVATIONS ---

  function isUsernameRegistered(username) {
    if (!username) return false;
    const clean = username.replace(/^@+/, '').trim().toLowerCase();
    return accounts.some(a => a.username.toLowerCase() === clean);
  }

  function isUsernameTaken(username, excludeAccountId = null) {
    if (!username) return false;
    const clean = username.replace(/^@+/, '').trim().toLowerCase();
    return accounts.some(a => a.username.toLowerCase() === clean && a.id !== excludeAccountId);
  }

  function getAccountByUsername(username) {
    if (!username) return null;
    const clean = username.replace(/^@+/, '').trim().toLowerCase();
    return accounts.find(a => a.username.toLowerCase() === clean) || null;
  }

  // --- AUTHENTICATION ACTIONS ---

  async function register(username, displayName, password, avatar = 'logo_avatar') {
    const cleanUser = (username || '').replace(/[^a-zA-Z0-9_-]/g, '').trim();
    if (cleanUser.length < 3 || cleanUser.length > 20) {
      return { success: false, error: 'Username must be 3 to 20 alphanumeric characters (letters, numbers, _, -).' };
    }

    if (isUsernameTaken(cleanUser)) {
      return { success: false, error: `The username "@${cleanUser}" is already taken! Two users cannot share a name. Please choose a different username or log in.` };
    }

    if (!password || password.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters long.' };
    }

    const salt = generateSalt();
    const hash = await hashPassword(password, salt);

    const newAcc = {
      id: generateId(),
      username: cleanUser,
      displayName: (displayName && displayName.trim()) ? displayName.trim().substring(0, 30) : cleanUser,
      passwordHash: hash,
      salt: salt,
      avatar: avatar || 'logo_avatar',
      bio: 'Reading Jujutsu Kaisen & exploring Get Real',
      createdAt: Date.now(),
      bookmarks: guestData.bookmarks.length > 0 ? [...guestData.bookmarks] : [],
      lastRead: { ...guestData.lastRead },
      scratchpad: guestData.scratchpad || '',
      forumPosts: [],
      savedRooms: ['lobby', 'manga-lounge', 'gaming']
    };

    accounts.push(newAcc);
    activeAccountId = newAcc.id;
    isAuthenticatedSession = true;

    persist();
    updateUI();
    notifyChange('register');
    return { success: true, account: newAcc };
  }

  async function login(username, password) {
    const cleanUser = (username || '').replace(/^@+/, '').trim();
    const acc = getAccountByUsername(cleanUser);

    if (!acc) {
      return { success: false, error: `No registered account found with username "@${cleanUser}". Please register first.` };
    }

    if (!acc.passwordHash) {
      // Legacy account without password - set this password as its new password
      acc.salt = generateSalt();
      acc.passwordHash = await hashPassword(password, acc.salt);
      activeAccountId = acc.id;
      isAuthenticatedSession = true;
      persist();
      updateUI();
      notifyChange('login');
      return { success: true, account: acc };
    }

    const testHash = await hashPassword(password, acc.salt);
    if (testHash !== acc.passwordHash) {
      return { success: false, error: `Incorrect password for @${acc.username}. Impersonation is not permitted.` };
    }

    activeAccountId = acc.id;
    isAuthenticatedSession = true;

    persist();
    updateUI();
    notifyChange('login');
    return { success: true, account: acc };
  }

  function logout() {
    activeAccountId = null;
    isAuthenticatedSession = false;
    try {
      localStorage.removeItem(STORAGE_ACTIVE_ID);
      localStorage.setItem(STORAGE_SESSION, 'false');
    } catch(e) {}

    persist();
    updateUI();
    notifyChange('logout');
  }

  async function verifyPassword(accountId, password) {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return false;
    if (!acc.passwordHash) return true;
    const testHash = await hashPassword(password, acc.salt);
    return testHash === acc.passwordHash;
  }

  async function changePassword(oldPassword, newPassword) {
    const acc = getActiveAccount();
    if (!acc || !isAuthenticatedSession) {
      return { success: false, error: 'You must be logged in to change password.' };
    }

    if (acc.passwordHash) {
      const valid = await verifyPassword(acc.id, oldPassword);
      if (!valid) {
        return { success: false, error: 'Current password is incorrect.' };
      }
    }

    if (!newPassword || newPassword.length < 4) {
      return { success: false, error: 'New password must be at least 4 characters long.' };
    }

    acc.salt = generateSalt();
    acc.passwordHash = await hashPassword(newPassword, acc.salt);
    persist();
    return { success: true };
  }

  // --- ACCOUNT GETTERS ---

  function isAuthenticated() {
    return isAuthenticatedSession && activeAccountId !== null && accounts.some(a => a.id === activeAccountId);
  }

  function getAccounts() {
    return accounts;
  }

  function getActiveAccount() {
    if (isAuthenticated()) {
      return accounts.find(a => a.id === activeAccountId) || null;
    }
    return null;
  }

  function getUsername() {
    const acc = getActiveAccount();
    return acc ? acc.username : guestData.username;
  }

  function getHandle() {
    const u = getUsername();
    return u.startsWith('@') ? u : '@' + u;
  }

  function getDisplayName() {
    const acc = getActiveAccount();
    return acc ? (acc.displayName || acc.username) : guestData.displayName;
  }

  function getAvatarKey() {
    const acc = getActiveAccount();
    return acc ? acc.avatar : guestData.avatar;
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
    if (!acc || !isAuthenticated()) {
      alert('You must be logged in to modify your profile.');
      return false;
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
    return true;
  }

  async function unlockAndSwitchAccount(accountId, password) {
    const target = accounts.find(a => a.id === accountId);
    if (!target) return { success: false, error: 'Account not found.' };

    if (target.passwordHash) {
      const valid = await verifyPassword(accountId, password);
      if (!valid) {
        return { success: false, error: `Incorrect password for @${target.username}.` };
      }
    }

    activeAccountId = target.id;
    isAuthenticatedSession = true;
    persist();
    updateUI();
    notifyChange('switch');
    return { success: true, account: target };
  }

  async function deleteAccount(accountId, password) {
    const target = accounts.find(a => a.id === accountId);
    if (!target) return { success: false, error: 'Account not found.' };

    if (target.passwordHash) {
      const valid = await verifyPassword(accountId, password);
      if (!valid) {
        return { success: false, error: 'Password incorrect. Cannot delete account.' };
      }
    }

    accounts = accounts.filter(a => a.id !== accountId);
    if (activeAccountId === accountId) {
      logout();
    } else {
      persist();
      updateUI();
      notifyChange('delete');
    }
    return { success: true };
  }

  // --- APP-SPECIFIC SYNC ACCESSORS ---

  // Manga Bookmarks Sync
  function getBookmarks() {
    const acc = getActiveAccount();
    return (acc && Array.isArray(acc.bookmarks)) ? acc.bookmarks : guestData.bookmarks;
  }

  function saveBookmarks(bms) {
    const acc = getActiveAccount();
    if (acc) {
      acc.bookmarks = bms;
      persist();
    } else {
      guestData.bookmarks = bms;
    }
    notifyChange('bookmarks');
  }

  // Manga Reading Progress Sync
  function saveReadingProgress(chapterNumber, pageIndex) {
    const acc = getActiveAccount();
    const progress = {
      chapterNumber: chapterNumber,
      pageIndex: pageIndex,
      timestamp: Date.now()
    };
    if (acc) {
      acc.lastRead = progress;
      persist();
    } else {
      guestData.lastRead = progress;
    }
    notifyChange('readingProgress');
  }

  function getReadingProgress() {
    const acc = getActiveAccount();
    return acc ? acc.lastRead : guestData.lastRead;
  }

  // Quick Scratchpad Sync
  function getScratchpad() {
    const acc = getActiveAccount();
    return acc ? (acc.scratchpad || '') : guestData.scratchpad;
  }

  function saveScratchpad(text) {
    const acc = getActiveAccount();
    if (acc) {
      acc.scratchpad = text;
      persist();
    } else {
      guestData.scratchpad = text;
    }
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

  // Event Subscriptions
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

  // --- PORTABILITY & EXPORT/IMPORT ---

  function exportAccountJson() {
    const active = getActiveAccount();
    if (!active) return '';
    const payload = {
      getRealSyncVersion: 2,
      exportedAt: Date.now(),
      account: active
    };
    return JSON.stringify(payload, null, 2);
  }

  function downloadAccountBackup() {
    const jsonStr = exportAccountJson();
    const active = getActiveAccount();
    if (!active) {
      alert('Please log in first to export your account backup.');
      return;
    }
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
    if (!jsonStr) return '';
    try {
      return btoa(unescape(encodeURIComponent(jsonStr)));
    } catch(e) {
      return btoa(jsonStr);
    }
  }

  async function importAccountJson(rawString, unlockPassword = '') {
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
        throw new Error('Invalid account data format.');
      }

      // Check if password matches to prevent unauthorized imports of another person's account
      if (incoming.passwordHash && unlockPassword) {
        const testHash = await hashPassword(unlockPassword, incoming.salt);
        if (testHash !== incoming.passwordHash) {
          return { success: false, error: `Incorrect password for @${incoming.username}. You cannot import an account without its password.` };
        }
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

      isAuthenticatedSession = true;
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

    const loggedIn = isAuthenticated();
    const acc = getActiveAccount();
    const handle = loggedIn ? `@${acc.username}` : 'Log In';
    const avatarSrc = getAvatarSrc(acc ? acc.avatar : 'logo_avatar');

    // Headers Account Pill Buttons
    document.querySelectorAll('.account-username-text').forEach(el => {
      el.textContent = handle;
    });

    document.querySelectorAll('.account-avatar-mini').forEach(el => {
      el.src = avatarSrc;
    });

    // Verified badge icons
    document.querySelectorAll('.account-verified-pill-icon').forEach(el => {
      el.style.display = loggedIn ? 'inline-flex' : 'none';
    });

    // Hub specific elements
    const hubName = document.getElementById('hub-account-name');
    if (hubName) hubName.textContent = handle;

    const hubAvatar = document.getElementById('hub-account-avatar');
    if (hubAvatar) hubAvatar.src = avatarSrc;

    // Chat specific badge
    const chatBadge = document.getElementById('chat-current-user-badge');
    if (chatBadge) {
      chatBadge.innerHTML = loggedIn 
        ? `${handle} <span style="color:#10B981;font-weight:900;" title="Verified Account">✓</span>` 
        : `Guest <span style="font-size:10px;color:var(--text-muted);">(Unverified)</span>`;
    }
  }

  function openModal(initialTab = null) {
    const modal = document.getElementById('modal-account');
    if (!modal) return;

    const loggedIn = isAuthenticated();
    const tabToOpen = initialTab || (loggedIn ? 'profile' : 'login');

    renderModalContent();
    switchModalTab(tabToOpen);
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
    const loggedIn = isAuthenticated();
    const acc = getActiveAccount();

    const loggedInTabs = document.querySelectorAll('.acc-tab-logged-in');
    const loggedOutTabs = document.querySelectorAll('.acc-tab-logged-out');

    loggedInTabs.forEach(el => el.style.display = loggedIn ? 'inline-flex' : 'none');
    loggedOutTabs.forEach(el => el.style.display = loggedIn ? 'none' : 'inline-flex');

    const statusBanner = document.getElementById('modal-acc-status-banner');
    if (statusBanner) {
      if (loggedIn) {
        statusBanner.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(16,185,129,0.1);border:1px solid #10B981;border-radius:10px;padding:8px 12px;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="background:#10B981;color:#fff;border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;">✓</span>
              <div>
                <div style="font-weight:800;font-size:13px;color:var(--text);">Logged in as @${acc.username}</div>
                <div style="font-size:11px;color:#10B981;font-weight:700;">Verified Account Owner · Name Protected</div>
              </div>
            </div>
            <button class="btn btn-pill" onclick="AccountManager.logout(); AccountManager.renderModalContent(); AccountManager.switchModalTab('login');" style="padding:4px 10px;font-size:12px;border:1px solid var(--border);">Log Out</button>
          </div>
        `;
      } else {
        statusBanner.innerHTML = `
          <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:var(--text-muted);">
            <strong style="color:#EF4444;">Not Logged In:</strong> You are currently in Guest mode. Register a unique username with a password so nobody can impersonate you in chat or forum!
          </div>
        `;
      }
    }

    // Populate profile inputs if logged in
    if (loggedIn && acc) {
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

    // Populate signup avatars
    const signupAvatarGrid = document.getElementById('acc-signup-avatar-grid');
    if (signupAvatarGrid) {
      const selected = signupAvatarGrid.dataset.selected || 'logo_avatar';
      signupAvatarGrid.innerHTML = AVATARS.map(av => `
        <div class="avatar-option ${selected === av.key ? 'selected' : ''}" onclick="AccountManager.selectSignupAvatar('${av.key}')">
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

  function selectSignupAvatar(key) {
    const grid = document.getElementById('acc-signup-avatar-grid');
    if (grid) {
      grid.dataset.selected = key;
      renderModalContent();
    }
  }

  async function handleLoginForm(e) {
    if (e) e.preventDefault();
    const userIn = document.getElementById('acc-login-username');
    const passIn = document.getElementById('acc-login-password');
    const errBox = document.getElementById('acc-login-error');

    if (!userIn || !userIn.value.trim()) {
      if (errBox) { errBox.textContent = 'Please enter your username.'; errBox.style.display = 'block'; }
      return;
    }

    const res = await login(userIn.value.trim(), passIn ? passIn.value : '');
    if (res.success) {
      if (errBox) errBox.style.display = 'none';
      if (userIn) userIn.value = '';
      if (passIn) passIn.value = '';
      closeModal();
    } else {
      if (errBox) {
        errBox.textContent = res.error;
        errBox.style.display = 'block';
      } else {
        alert(res.error);
      }
    }
  }

  async function handleSignupForm(e) {
    if (e) e.preventDefault();
    const userIn = document.getElementById('acc-signup-username');
    const nameIn = document.getElementById('acc-signup-displayname');
    const passIn = document.getElementById('acc-signup-password');
    const passConfirmIn = document.getElementById('acc-signup-password-confirm');
    const errBox = document.getElementById('acc-signup-error');
    const grid = document.getElementById('acc-signup-avatar-grid');
    const avatar = grid ? (grid.dataset.selected || 'logo_avatar') : 'logo_avatar';

    if (errBox) errBox.style.display = 'none';

    if (!userIn || !userIn.value.trim()) {
      if (errBox) { errBox.textContent = 'Username is required.'; errBox.style.display = 'block'; }
      return;
    }

    if (!passIn || !passIn.value) {
      if (errBox) { errBox.textContent = 'Password is required.'; errBox.style.display = 'block'; }
      return;
    }

    if (passIn.value !== (passConfirmIn ? passConfirmIn.value : '')) {
      if (errBox) { errBox.textContent = 'Passwords do not match.'; errBox.style.display = 'block'; }
      return;
    }

    const res = await register(
      userIn.value.trim(),
      nameIn ? nameIn.value.trim() : userIn.value.trim(),
      passIn.value,
      avatar
    );

    if (res.success) {
      if (errBox) errBox.style.display = 'none';
      if (userIn) userIn.value = '';
      if (nameIn) nameIn.value = '';
      if (passIn) passIn.value = '';
      if (passConfirmIn) passConfirmIn.value = '';
      alert(`✓ Account created! Welcome, @${res.account.username}! Your username is now protected with your password.`);
      closeModal();
    } else {
      if (errBox) {
        errBox.textContent = res.error;
        errBox.style.display = 'block';
      } else {
        alert(res.error);
      }
    }
  }

  function saveProfileFromForm() {
    const inputName = document.getElementById('acc-edit-displayname');
    const inputBio = document.getElementById('acc-edit-bio');

    updateActiveProfile({
      displayName: inputName ? inputName.value.trim() : '',
      bio: inputBio ? inputBio.value.trim() : ''
    });

    closeModal();
  }

  async function handleChangePasswordForm(e) {
    if (e) e.preventDefault();
    const oldIn = document.getElementById('acc-pwd-old');
    const newIn = document.getElementById('acc-pwd-new');
    const errBox = document.getElementById('acc-pwd-error');

    if (errBox) errBox.style.display = 'none';

    const res = await changePassword(oldIn ? oldIn.value : '', newIn ? newIn.value : '');
    if (res.success) {
      if (oldIn) oldIn.value = '';
      if (newIn) newIn.value = '';
      alert('✓ Password updated successfully!');
    } else {
      if (errBox) {
        errBox.textContent = res.error;
        errBox.style.display = 'block';
      } else {
        alert(res.error);
      }
    }
  }

  function renderAccountsList() {
    const container = document.getElementById('acc-list-container');
    if (!container) return;

    const active = getActiveAccount();
    const activeId = active ? active.id : null;

    if (accounts.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">No accounts registered yet on this device.</div>`;
      return;
    }

    container.innerHTML = accounts.map(a => {
      const isActive = a.id === activeId && isAuthenticated();
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
                <span style="color:#10B981;font-weight:900;font-size:11px;" title="Registered & Protected">🔒</span>
                ${isActive ? '<span class="acc-active-badge">Active</span>' : ''}
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                📖 ${bCount} bookmarks · 📝 ${hasNotes ? 'Notes saved' : 'No notes'}
              </div>
            </div>
          </div>
          <div style="display:flex;gap:6px;">
            ${!isActive ? `<button class="btn btn-pill btn-accent" onclick="AccountManager.promptUnlockSwitch('${a.id}', '@${a.username}')" style="padding:4px 12px;font-size:12px;">Unlock & Switch</button>` : ''}
            <button class="btn btn-pill" onclick="AccountManager.promptDeleteAccount('${a.id}', '@${a.username}')" style="color:#EF4444;padding:4px 8px;font-size:12px;" title="Delete Account">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  async function promptUnlockSwitch(accountId, username) {
    const pwd = prompt(`Enter password to log into ${username}:`);
    if (pwd === null) return;
    const res = await unlockAndSwitchAccount(accountId, pwd);
    if (res.success) {
      alert(`✓ Logged in as ${username}!`);
      renderAccountsList();
      closeModal();
    } else {
      alert(res.error);
    }
  }

  async function promptDeleteAccount(accountId, username) {
    const pwd = prompt(`Enter password to confirm deleting account ${username}:`);
    if (pwd === null) return;
    const res = await deleteAccount(accountId, pwd);
    if (res.success) {
      alert(`✓ Deleted account ${username}.`);
      renderAccountsList();
    } else {
      alert(res.error);
    }
  }

  function updateSyncSummary() {
    const acc = getActiveAccount();
    const statBookmarks = document.getElementById('sync-stat-bookmarks');
    const statLastRead = document.getElementById('sync-stat-lastread');
    const statNotes = document.getElementById('sync-stat-notes');

    if (!acc) {
      if (statBookmarks) statBookmarks.textContent = 'Guest (Unsaved)';
      if (statLastRead) statLastRead.textContent = 'Guest';
      if (statNotes) statNotes.textContent = 'Guest';
      return;
    }

    if (statBookmarks) statBookmarks.textContent = `${(acc.bookmarks || []).length} saved`;
    if (statLastRead) {
      statLastRead.textContent = acc.lastRead ? `Chapter ${acc.lastRead.chapterNumber}, Page ${acc.lastRead.pageIndex + 1}` : 'None yet';
    }
    if (statNotes) {
      const len = (acc.scratchpad || '').length;
      statNotes.textContent = len > 0 ? `${len} characters` : 'Empty';
    }
  }

  function handleImportFile(fileInput) {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const pwd = prompt('If this account is password-protected, enter its password to unlock:');
      const res = await importAccountJson(e.target.result, pwd || '');
      if (res.success) {
        alert(`✓ Successfully restored account @${res.username}!`);
        closeModal();
      } else {
        alert('Error importing account: ' + res.error);
      }
      fileInput.value = '';
    };
    reader.readAsText(file);
  }

  async function handleImportToken() {
    const input = document.getElementById('sync-token-input');
    if (!input || !input.value.trim()) {
      alert('Please paste a sync code first.');
      return;
    }

    const pwd = prompt('If this account is password-protected, enter its password:');
    const res = await importAccountJson(input.value.trim(), pwd || '');
    if (res.success) {
      alert(`✓ Successfully restored account @${res.username}!`);
      input.value = '';
      closeModal();
    } else {
      alert('Error importing sync code: ' + res.error);
    }
  }

  function copySyncCodeToClipboard() {
    const token = getSyncToken();
    if (!token) {
      alert('Please log in first to generate a sync code.');
      return;
    }
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

  return {
    init,
    // Authentication
    register,
    login,
    logout,
    isAuthenticated,
    isUsernameRegistered,
    isUsernameTaken,
    getAccountByUsername,
    changePassword,
    unlockAndSwitchAccount,
    deleteAccount,
    // Getters
    getAccounts,
    getActiveAccount,
    getUsername,
    getHandle,
    getDisplayName,
    getAvatarKey,
    getAvatarSrc,
    getAvatarsList,
    updateActiveProfile,
    selectAvatar,
    selectSignupAvatar,
    // Data sync
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
    // Portability
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
    renderModalContent,
    handleLoginForm,
    handleSignupForm,
    saveProfileFromForm,
    handleChangePasswordForm,
    renderAccountsList,
    promptUnlockSwitch,
    promptDeleteAccount
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
