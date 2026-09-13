# Handoff Report: Security & Firebase Integration Specification (R5 & R6)

## 1. Observation
A forensic audit was performed across the codebase at `C:\Users\User\Desktop\Get Real\` focusing on client-side security, input handling, authentication, cryptographic hashing, and cloud synchronization readiness.

### Key File Observations:
1. **`account.js`**:
   - **Lines 52-66**: `hashPassword(password, salt)` invokes `crypto.subtle.digest('SHA-256', enc.encode(raw))` when available with a 16-byte random salt generated via `crypto.getRandomValues` (Lines 43-50). However, lines 59-65 provide a weak 32-bit polynomial fallback (`sim_...`) when `crypto.subtle` is absent.
   - **Lines 906-907 in `renderAccountsList()`**:
     ```javascript
     container.innerHTML = accounts.map(a => ...
       <span style="font-weight:800;font-size:14px;color:var(--text);">${a.displayName || a.username}</span>
       <span style="font-size:12px;color:var(--text-muted);">@${a.username}</span> ...
     ```
     User profile fields `displayName` and `username` are interpolated directly into innerHTML with **zero escaping**.
   - **Lines 917-918 in `renderAccountsList()`**:
     ```html
     onclick="AccountManager.promptUnlockSwitch('${a.id}', '@${a.username}')"
     onclick="AccountManager.promptDeleteAccount('${a.id}', '@${a.username}')"
     ```
     Direct interpolation into inline JavaScript attributes with single quotes allows attribute breakout if an account username or ID contains single quotes.
   - **Lines 703-715 in `renderModalContent()`**:
     ```javascript
     statusBanner.innerHTML = `... Logged in as @${acc.username} ...`;
     ```
     Raw interpolation of account username into HTML without entity escaping.
   - **Line 654 in `updateUI()`**:
     ```javascript
     chatBadge.innerHTML = loggedIn 
       ? `${handle} <span style="color:#10B981;font-weight:900;" title="Verified Account">?</span>` 
       : `Guest <span style="font-size:10px;color:var(--text-muted);">(Unverified)</span>`;
     ```
     Raw string interpolation of handle into `chatBadge.innerHTML`.
   - **Lines 926, 939, 979, 999**:
     ```javascript
     const pwd = prompt('Enter password to log into ' + username + ':');
     ```
     Plaintext password prompting via `window.prompt()` leaks passwords on screen without masking.
   - **Lines 569-618 in `importAccountJson()`**:
     Parses imported JSON from files or Base64 sync codes without schema validation or field sanitization before committing to `localStorage`.

2. **`chat.js`**:
   - **Lines 881-885 in `escapeHtml()`**:
     ```javascript
     function escapeHtml(text) {
       const div = document.createElement('div');
       div.textContent = text;
       return div.innerHTML;
     }
     ```
     **Critical flaw**: Browser `div.innerHTML` does **not** escape single quotes (`'`) or backticks (```).
   - **Lines 370, 375, 569, 570 in `renderRoomsList()` and `renderMembersModal()`**:
     ```html
     onclick="ChatApp.kickUser('${escapeHtml(member)}')"
     onclick="ChatApp.banUser('${escapeHtml(member)}')"
     ```
     Because `escapeHtml` leaves `'` unescaped, an input such as `attacker');alert(1);//` breaks out of the inline JS string and executes arbitrary code upon click.
   - **Lines 770-813 in `sendMessage()`**:
     No rate limiting, debounce, or cooldown exists. Rapid key presses or programmatic loops can flood chat storage and network listeners.
   - **Line 787**: Calls `ProfanityFilter.clean(text)`, which only masks bad words with asterisks and does not strip or sanitize HTML tags.

3. **`forum.js`**:
   - **Lines 406-410 in `escapeHtml()`**: Identical flawed `div.innerHTML` escaping missing single-quote sanitization.
   - **Lines 109, 118-186 in `submitNewThread()`**: No cooldown or rate limiting; rapid submission allows thread spamming.
   - **Lines 188-241 in `submitReply()`**: No cooldown or rate limiting on replies.
   - **Line 352 in `renderThreadView()`**:
     ```html
     <span class="board-badge">/${thread.board}/</span>
     ```
     Thread board identifier is rendered without escaping.
   - **Line 367 in `renderThreadView()`**:
     ```html
     <input type="text" id="reply-name-${thread.id}" value="${defaultReplyUser}" ...>
     ```
     `defaultReplyUser` is interpolated into an HTML attribute without attribute escaping. If the username contains double quotes, attribute breakout occurs.
   - **Lines 390-404 in `formatGreentext()` and `formatQuotes()`**:
     Greentext converts lines starting with `>` to green text via `<span class="greentext">${line}</span>`. This violates requirement R1 (must use semantic `<blockquote>` instead) and injects unverified HTML structures.

4. **`index.html`**:
   - Lines 20-22 and 711-717 load scripts via standard `<script src="...">` tags.
   - No Firebase CDN scripts are currently linked.
   - `firebase-config.js` does not exist in the repository.
   - No offline/unconfigured fallback banner element exists in the markup.

5. **`profanity.js`**:
   - Contains a word-matching dictionary for school safety. Does not perform HTML sanitization or attribute validation.

---

## 2. Logic Chain
1. **Stored XSS Vector via Profile Data**:
   - User inputs nickname in profile or imports account JSON.
   - If payload is `<img src=x onerror=alert(document.cookie)>`, `account.js` line 906 inserts it directly into `container.innerHTML`.
   - Result: Whenever the account switcher modal is viewed, script executes in the victim's session.
2. **Attribute Breakout Vector via Flawed `escapeHtml`**:
   - The developer assumed `div.textContent = str; return div.innerHTML` is sufficient for all contexts.
   - However, in HTML specification, `div.innerHTML` only escapes `&`, `<`, and `>`. It does NOT escape `'` (ASCII 39) or `"` (ASCII 34).
   - In `chat.js` line 569, `escapeHtml(member)` is interpolated into `onclick="ChatApp.kickUser('${...}')"`.
   - If `member` is `user');alert(1);//`, the resulting HTML is:
     `<button onclick="ChatApp.kickUser('user');alert(1);//')">Kick</button>`
   - Result: Immediate arbitrary JavaScript execution upon user action.
3. **Denial of Service / Spam Vector**:
   - Neither `chat.js:sendMessage()` nor `forum.js:submitNewThread()` / `submitReply()` tracks last invocation timestamps.
   - Rapid clicking triggers instant writes. In local mode, it fills `localStorage` (5MB quota limit). In Firebase mode, it triggers massive write requests, depleting free quotas and generating UI lag.
   - A minimum 1500ms cooldown with button disabling and visual timer solves this completely.
4. **Password Exposure Vector**:
   - `window.prompt()` displays entered text in cleartext in standard browser dialogs.
   - Replacing this with modal password input fields with `type="password"` guarantees visual masking.
5. **Firebase Architecture Selection (Compat vs. Modular)**:
   - Get Real is a zero-bundler, multi-view vanilla web app running directly from static files or local server.
   - Loading Firebase v10 Modular SDK via `<script type="module">` causes CORS and protocol failures when opened via `file:///` without a local server, and restricts functions from global window access needed by inline event handlers.
   - Official Firebase v10 Compat CDN SDK (`firebase-app-compat.js`, `firebase-auth-compat.js`, `firebase-firestore-compat.js`) works universally across `http://`, `https://`, and `file:///` protocols, attaches to `window.firebase`, and provides full real-time `onSnapshot` capabilities.
6. **Firestore Indexing Optimization**:
   - Top-level collection querying with multiple clauses (e.g. `where('channel', '==', id).orderBy('timestamp')`) triggers a requirement for composite indexes in Firebase Console. If unindexed, Firestore queries fail with an unhandled exception.
   - Subcollections (`chat_rooms/{roomId}/messages` and `forum_threads/{threadId}/replies`) ordered purely by `timestamp asc` use single-field default indexes, requiring **zero manual composite index configuration** and running error-free immediately out of the box.

---

## 3. Caveats
1. **Firestore Client-Side Security Rules**: While the client must validate and sanitize all fields before sending, true security against adversarial direct API calls requires Firestore Security Rules deployed in the Firebase Console. We provide complete, ready-to-paste Firestore Security Rules in Section 8.8.
2. **Firebase Auth Username Mapping**: Firebase Auth native provider uses Email/Password. For username-only sign-up, we use a deterministic internal domain format (`${cleanUsername.toLowerCase()}@getreal.internal`) with an optional recovery email stored in the user's Firestore document.
3. **Local Storage Storage Quota**: `localStorage` has a browser limit of ~5MB. Offline message retention must be capped at 250 messages per room and 50 threads to prevent `QuotaExceededError`.

---

## 4. Conclusion
Get Real's current security posture contains high-severity Stored XSS vulnerabilities due to unescaped account rendering and incomplete single-quote escaping in chat/forum. Chat and forum lack essential rate-limiting protections.
Integrating Firebase v10 Compat CDN SDK alongside an intelligent abstraction layer (`FirebaseService`) and a dual-mode hybrid storage engine provides real-time multi-user capabilities while guaranteeing 100% operational continuity offline with zero runtime crashes.

---

## 5. Verification Method
1. **XSS Prevention Verification**:
   - Send `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>`, and `test');alert(1);//` in chat, forum thread, reply, and account nickname.
   - Verify all characters render as literal text and zero alert dialogs appear.
2. **Rate Limiting Verification**:
   - Rapidly click "Send" in chat; verify button is disabled for 1.5s with cooldown feedback.
   - Rapidly click "Post Reply" or "Submit Post" in forum; verify 1.5s cooldown alert.
3. **Password Masking Verification**:
   - Test account unlock, account deletion, and protected chat room entry; verify all password inputs use masked `type="password"` controls.
4. **Offline Fallback Verification**:
   - Run app with `apiKey: "YOUR_API_KEY"`; verify console logs graceful fallback notice, banner appears, and chat/forum/reader continue functioning locally without errors.
5. **Firebase Real-Time Verification**:
   - Provide valid Firebase credentials; open two separate browser windows and verify messages and forum threads synchronize instantaneously via `onSnapshot`.

---

## Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Security | Message Escaping | Escapes message text prior to DOM insertion | Text string | Escaped HTML string | Omits single quote escaping (attribute injection risk) | `chat.js:881` |
| 2 | Security | Forum Comment Escaping | Escapes thread and reply comments | Text string | Escaped HTML string | Omits single quote escaping | `forum.js:406` |
| 3 | Security | Account List Rendering | Renders saved local accounts | Accounts array | DOM HTML cards | Direct interpolation of display name without escaping | `account.js:906` |
| 4 | Security | Web Crypto Password Hashing | Generates salted SHA-256 password hash | Password + Salt | 64-char Hex hash | Insecure polynomial fallback if subtle crypto missing | `account.js:52` |
| 5 | Security | Anti-Impersonation Check | Validates if username is already registered | Username string | Boolean check | Alerts user if attempting to post under registered name | `chat.js:791`, `forum.js:136` |
| 6 | Security | Password Prompting | Prompts user for password on account switch | `window.prompt()` | Plaintext string | Displays password in cleartext on screen | `account.js:926` |
| 7 | Security | Profanity Filtering | Replaces offensive words with asterisks | Text string | Masked string | Does not strip HTML or script tags | `profanity.js:13` |
| 8 | Firebase | CDN SDK Integration | Firebase v10 loader and initialization | Config object | Firebase App, Auth, Firestore instances | Graceful fallback to local storage if unconfigured | R6 Requirement |
| 9 | Firebase | User Authentication | Username + Password login & signup | Username, Password, optional Email | Auth Credential + Firestore Profile | Rejects duplicates, handles weak passwords | R6 Requirement |
| 10 | Firebase | Real-time Chat Sync | Synchronizes chat messages via `onSnapshot` | Room ID, Message object | Real-time message feed | Unsubscribes on room switch to prevent leaks | R6 Requirement |
| 11 | Firebase | Discussion Board Sync | Synchronizes threads and reply subcollections | Board ID, Thread/Reply objects | Real-time forum updates | Falls back to `localStorage` on network failure | R6 Requirement |
| 12 | Firebase | Cloud Profile Sync | Synchronizes bookmarks, progress, scratchpad | User data payload | Firestore `users/{uid}` doc | Retains local copy if disconnected | R6 Requirement |
| 13 | Fallback | Unconfigured Mode Banner | Displays setup notice when keys are placeholder | Config state | Non-intrusive dismissible banner | Zero crashes, preserves 100% local functionality | R6 Requirement |

---

## Edge Cases
| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Chat Message | `<img src=x onerror="alert('XSS')">` | Escaped by `div.textContent` into text node when inserted into body, but fails in attribute contexts. |
| 2 | Room Host Kick | Username containing `'` (e.g. `O'Connor` or `test');alert(1);//`) | Injected into inline `onclick="ChatApp.kickUser('...')"`, causing attribute breakout and syntax error or script execution. |
| 3 | Account Switcher | Display Name: `<b onmouseover=alert(1)>Click</b>` | Injected unescaped into `account.js:906` innerHTML, triggering Stored XSS whenever accounts modal is viewed. |
| 4 | Forum Greentext | Line starting with `> <script>alert(1)</script>` | Wrapped in `<span class="greentext">`, which renders safely if pre-escaped, but violates R1 (greentext must be blockquote). |
| 5 | Chat Rapid Send | 10 Enter keystrokes in 1 second | Appends 10 duplicate messages without rate limiting, creating spam and DOM churn. |
| 6 | Forum Rapid Post | 5 rapid clicks on Submit Post | Generates 5 duplicate threads with sequential IDs without cooldown. |
| 7 | Firebase Unconfigured | `apiKey: "YOUR_API_KEY"` | Firebase init throws error if unhandled; requires protective detection before calling SDK. |
| 8 | Network Disconnect | User posts chat message while offline | If Firebase is active, Firestore offline persistence caches writes; if unhandled, uncaught promise rejection occurs. |
| 9 | Room Switching | User switches from Lobby to Gaming and back rapidly | Multiple `onSnapshot` listeners stack if previous unsubscribe callbacks are not invoked, leaking memory. |
| 10 | Missing Email Auth | User signs up with username only | Standard Firebase `createUserWithEmailAndPassword` fails without email; requires synthetic internal email mapping. |

---

## 8. Detailed Technical Specifications & Code Contracts

### 8.1 Threat Model & Untrusted Input Inventory
The application boundaries process untrusted data from four sources:
1. **User Form Inputs**: Chat messages, Room metadata, Forum posts, Forum replies, Account names/bios.
2. **Storage Boundaries**: `localStorage`, `BroadcastChannel` cross-tab messages.
3. **Network Boundaries**: Cloud Firestore documents, Firebase Auth state.
4. **Import Boundaries**: Exported `.json` backup files and Base64 sync tokens.

All input data crossing these boundaries must be treated as hostile. No input may be rendered into HTML or attributes without contextual sanitization.

### 8.2 Canonical Escaping & Sanitization Contract
To replace the vulnerable `div.innerHTML` implementation in `chat.js` and `forum.js`, and fix unescaped rendering in `account.js`, the following canonical sanitizer functions must be established:

```javascript
// Universal HTML Entity Escaper (Safe for HTML body and attribute contents)
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

// Safe Attribute Value Escaper
function escapeAttr(str) {
  return escapeHtml(str);
}

// URL Scheme Validator (Prevents javascript:, data:, vbscript: injection)
function isSafeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed, window.location.href);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
}
```

#### Elimination of Inline Attribute Code Injection
All inline event handlers with dynamic string arguments:
- **Before (Vulnerable)**: `<button onclick="ChatApp.kickUser('${escapeHtml(user)}')">`
- **After (Secure)**:
  `<button class="btn-host-action btn-kick-user" data-user="${escapeHtml(user)}">Kick</button>`
  With delegated event handling in container:
  ```javascript
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-kick-user');
    if (btn && btn.dataset.user) {
      ChatApp.kickUser(btn.dataset.user);
    }
  });
  ```

#### Semantic Blockquote Parser (Fulfilling R1 & R5)
Replaces greentext with standard blockquotes while preventing injection:
```javascript
function formatComment(rawComment) {
  // 1. Sanitize all HTML characters first
  const clean = escapeHtml(rawComment);

  // 2. Link post quotes (>>1001)
  const linked = clean.replace(/&gt;&gt;(\d+)|>>(\d+)/g, (match, p1, p2) => {
    const id = p1 || p2;
    return `<a href="#p${id}" class="quote-link">&gt;&gt;${id}</a>`;
  });

  // 3. Transform quotes starting with '>' into semantic <blockquote>
  const lines = linked.split('\n');
  const output = [];
  let inBlockquote = false;

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('&gt;') || trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^(&gt;|>)\s?/, '');
      if (!inBlockquote) {
        output.push('<blockquote class="forum-quote">');
        inBlockquote = true;
      }
      output.push(`<div>${quoteText}</div>`);
    } else {
      if (inBlockquote) {
        output.push('</blockquote>');
        inBlockquote = false;
      }
      output.push(line);
    }
  }
  if (inBlockquote) output.push('</blockquote>');

  return output.join('<br/>');
}
```

### 8.3 Rate-Limiting & Cooldown Engine Specification
Per requirement R5, a minimum 1.5s (1500ms) cooldown must throttle chat messages and forum submissions.

```javascript
// Rate Limiter Contract
const RateLimiter = (() => {
  const cooldowns = new Map();

  function check(actionKey, cooldownMs = 1500) {
    const now = Date.now();
    const last = cooldowns.get(actionKey) || 0;
    const elapsed = now - last;
    if (elapsed < cooldownMs) {
      return {
        allowed: false,
        remainingMs: cooldownMs - elapsed,
        remainingSec: (Math.ceil((cooldownMs - elapsed) / 100) / 10).toFixed(1)
      };
    }
    cooldowns.set(actionKey, now);
    return { allowed: true, remainingMs: 0, remainingSec: '0' };
  }

  function reset(actionKey) {
    cooldowns.delete(actionKey);
  }

  return { check, reset };
})();
```

#### Integration in `chat.js`:
```javascript
function sendMessage() {
  const rate = RateLimiter.check('chat_send', 1500);
  if (!rate.allowed) {
    const sendBtn = document.getElementById('chat-send-btn');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = `Wait ${rate.remainingSec}s`;
      setTimeout(() => {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send ?';
      }, rate.remainingMs);
    }
    return;
  }
  // Proceed with message send...
}
```

#### Integration in `forum.js`:
```javascript
function submitNewThread() {
  const rate = RateLimiter.check('forum_post', 1500);
  if (!rate.allowed) {
    alert(`?? Please wait ${rate.remainingSec}s before posting again.`);
    return;
  }
  // Proceed with thread creation...
}
```

### 8.4 Password Security & Cryptographic Hashing Specification
1. **Password Masking**:
   - Eliminate all `window.prompt()` calls for passwords.
   - Replace with dedicated password input modals with masked controls (`type="password"`).
2. **Web Crypto API SHA-256 with Salt**:
   ```javascript
   async function hashPassword(password, salt) {
     const raw = (salt || '') + '::get_real_v2::' + password;
     if (typeof crypto !== 'undefined' && crypto.subtle) {
       const enc = new TextEncoder();
       const buffer = await crypto.subtle.digest('SHA-256', enc.encode(raw));
       return Array.from(new Uint8Array(buffer))
         .map(b => b.toString(16).padStart(2, '0'))
         .join('');
     }
     throw new Error('Web Crypto API (crypto.subtle) is required for secure authentication.');
   }
   ```

---

### 8.5 Firebase v10 CDN Architecture (`firebase-config.js`)
To enable real-time multiplayer without complex build pipelines, load the official Firebase v10 Compat CDN SDK in `index.html`:

```html
<!-- Firebase v10 Official Compat CDN SDK -->
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
<script src="firebase-config.js"></script>
```

#### File: `firebase-config.js`
```javascript
// firebase-config.js
// Universal Firebase v10 Abstraction & Offline Fallback Engine

const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const FirebaseService = (() => {
  let app = null;
  let auth = null;
  let db = null;
  let isConfigured = false;
  let isOnline = false;
  const statusListeners = [];

  function isConfigValid(config) {
    return !!(config && 
              config.apiKey && 
              config.apiKey !== "YOUR_API_KEY" && 
              config.projectId && 
              config.projectId !== "YOUR_PROJECT_ID");
  }

  function init() {
    if (typeof firebase === 'undefined') {
      console.warn('[Get Real] Firebase SDK not loaded from CDN. Running in offline storage mode.');
      setOfflineState();
      return;
    }

    if (!isConfigValid(FIREBASE_CONFIG)) {
      console.info('[Get Real] Firebase unconfigured. Running in offline local storage fallback mode.');
      setOfflineState();
      showFallbackBanner();
      return;
    }

    try {
      app = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
      auth = firebase.auth();
      db = firebase.firestore();
      isConfigured = true;
      isOnline = true;
      console.info('[Get Real] Firebase connected successfully (Auth + Firestore).');
      notifyStatus();
    } catch (err) {
      console.error('[Get Real] Firebase initialization error:', err);
      setOfflineState();
      showFallbackBanner();
    }
  }

  function setOfflineState() {
    isConfigured = false;
    isOnline = false;
    notifyStatus();
  }

  function notifyStatus() {
    statusListeners.forEach(cb => {
      try { cb({ isConfigured, isOnline }); } catch(e) {}
    });
  }

  function onStatusChange(callback) {
    if (typeof callback === 'function') statusListeners.push(callback);
  }

  function isReady() {
    return isConfigured && isOnline && !!db;
  }

  function showFallbackBanner() {
    const banner = document.getElementById('firebase-fallback-banner');
    if (banner && localStorage.getItem('get_real_fallback_dismissed') !== 'true') {
      banner.style.display = 'block';
    }
  }

  function dismissBanner() {
    const banner = document.getElementById('firebase-fallback-banner');
    if (banner) banner.style.display = 'none';
    localStorage.setItem('get_real_fallback_dismissed', 'true');
  }

  return {
    init,
    isReady,
    isConfigured: () => isConfigured,
    isOnline: () => isOnline,
    onStatusChange,
    showFallbackBanner,
    dismissBanner,
    getAuth: () => auth,
    getDb: () => db
  };
})();

// Auto-initialize when loaded
if (typeof window !== 'undefined') {
  window.FirebaseService = FirebaseService;
  FirebaseService.init();
}
```

---

### 8.6 Dual-Mode Hybrid Storage & Offline Fallback Banner
When Firebase is offline or unconfigured:
1. All operations execute against `localStorage` and `BroadcastChannel`.
2. A non-intrusive fallback banner informs the user with setup instructions:

```html
<!-- Offline / Unconfigured Fallback Banner -->
<div id="firebase-fallback-banner" class="firebase-fallback-banner" style="display:none;">
  <div class="fallback-banner-content">
    <div class="fallback-banner-left">
      <span class="fallback-icon">?</span>
      <div>
        <strong style="color:var(--accent);">Offline Storage Mode Active:</strong>
        <span style="color:var(--text-muted);font-size:12px;">
          Cloud sync is unconfigured. All chat, forum, and reader features are saving safely to this browser.
        </span>
      </div>
    </div>
    <div class="fallback-banner-actions">
      <button class="btn btn-pill" onclick="FirebaseService.dismissBanner()" style="font-size:11px;padding:3px 10px;">Dismiss</button>
    </div>
  </div>
</div>
```

---

### 8.7 Firebase Auth & Account Synchronization Contract
#### Username to Email Mapping
Firebase Auth requires an email format. For accounts registered with Username + Password:
- **Synthetic Email Format**: `${cleanUsername.toLowerCase()}@getreal.internal`
- **Optional Real Email**: Stored in the Firestore profile for recovery.

#### Account Registration Flow
```javascript
async function registerWithFirebase(username, displayName, password, optionalEmail = '') {
  const auth = FirebaseService.getAuth();
  const db = FirebaseService.getDb();
  const internalEmail = `${username.toLowerCase()}@getreal.internal`;

  // 1. Check username availability in usernames collection
  const nameRef = db.collection('usernames').doc(username.toLowerCase());
  const snap = await nameRef.get();
  if (snap.exists) {
    return { success: false, error: `Username @${username} is already taken.` };
  }

  // 2. Create Auth user
  const userCredential = await auth.createUserWithEmailAndPassword(internalEmail, password);
  const user = userCredential.user;

  // 3. Update display name
  await user.updateProfile({ displayName: displayName || username });

  // 4. Reserve username & create user doc in Firestore
  const batch = db.batch();
  batch.set(nameRef, { uid: user.uid, username: username, createdAt: Date.now() });
  batch.set(db.collection('users').doc(user.uid), {
    uid: user.uid,
    username: username,
    displayName: displayName || username,
    email: optionalEmail || '',
    avatar: 'logo_avatar',
    bio: 'Exploring Get Real',
    createdAt: Date.now(),
    bookmarks: AccountManager.getBookmarks(),
    lastRead: AccountManager.getReadingProgress(),
    scratchpad: AccountManager.getScratchpad()
  });
  await batch.commit();

  return { success: true, user };
}
```

#### Real-Time User Data Sync
Listen to the user document in Firestore to synchronize bookmarks and scratchpad across devices:
```javascript
function listenUserData(uid) {
  const db = FirebaseService.getDb();
  return db.collection('users').doc(uid).onSnapshot(doc => {
    if (doc.exists) {
      const data = doc.data();
      if (data.bookmarks) AccountManager.saveBookmarks(data.bookmarks);
      if (data.scratchpad) AccountManager.saveScratchpad(data.scratchpad);
      if (data.lastRead) AccountManager.saveReadingProgress(data.lastRead.chapterNumber, data.lastRead.pageIndex);
    }
  });
}
```

---

### 8.8 Cloud Firestore Real-Time Chat & Discussion Board Architecture

#### 1. Data Schemas

##### Collection: `chat_rooms`
- **Path**: `chat_rooms/{roomId}`
- **Document Fields**:
  ```json
  {
    "id": "lobby",
    "name": "Lobby",
    "description": "Main public chat lobby for everyone",
    "creator": "System",
    "creatorUid": "system",
    "isProtected": false,
    "passwordHash": "",
    "salt": "",
    "bannedUsers": [],
    "createdAt": 1700000000000
  }
  ```

##### Subcollection: `chat_rooms/{roomId}/messages`
- **Path**: `chat_rooms/{roomId}/messages/{messageId}`
- **Document Fields**:
  ```json
  {
    "id": "msg_1700000000000_abc",
    "roomId": "lobby",
    "user": "SatoruGojo",
    "userUid": "auth_uid",
    "verified": true,
    "avatar": "logo_avatar",
    "text": "Hello everyone!",
    "isSystem": false,
    "timestamp": 1700000000000
  }
  ```
*Advantage*: Single-field index on `timestamp asc` runs without any composite index creation!

##### Collection: `forum_threads`
- **Path**: `forum_threads/{threadId}`
- **Document Fields**:
  ```json
  {
    "id": 1001,
    "board": "manga",
    "author": "GojoFan",
    "authorUid": "auth_uid",
    "verified": true,
    "avatar": "logo_avatar",
    "subject": "JJK Chapter 272 Ending Discussion",
    "comment": "What did everyone think of the finale?",
    "imageUrl": "",
    "replyCount": 2,
    "createdAt": 1700000000000,
    "lastActivity": 1700000000000
  }
  ```

##### Subcollection: `forum_threads/{threadId}/replies`
- **Path**: `forum_threads/{threadId}/replies/{replyId}`
- **Document Fields**:
  ```json
  {
    "id": 1002,
    "threadId": "1001",
    "author": "SukunaStan",
    "authorUid": "auth_uid",
    "verified": true,
    "avatar": "logo_avatar",
    "comment": ">>1001\nPeak fiction!",
    "createdAt": 1700000000000
  }
  ```

#### 2. Listener Lifecycle Management (Preventing Memory Leaks)
Each view must strictly manage subscription teardowns:

```javascript
// Chat Messages Listener Contract
let unsubscribeChatMessages = null;

function subscribeToRoomMessages(roomId) {
  // 1. Clean up existing listener
  if (unsubscribeChatMessages) {
    unsubscribeChatMessages();
    unsubscribeChatMessages = null;
  }

  if (!FirebaseService.isReady()) {
    // Offline local rendering
    renderMessages();
    return;
  }

  const db = FirebaseService.getDb();
  const query = db.collection('chat_rooms')
                  .doc(roomId)
                  .collection('messages')
                  .orderBy('timestamp', 'asc')
                  .limitToLast(100);

  unsubscribeChatMessages = query.onSnapshot(snapshot => {
    const messages = [];
    snapshot.forEach(doc => messages.push(doc.data()));
    // Update local store and render
    renderMessagesFromList(messages);
  }, err => {
    console.error('[Chat] Snapshot error:', err);
    renderMessages(); // Fallback to local storage
  });
}
```

#### 3. Recommended Firestore Security Rules
Developers can paste these rules directly into the Firebase Console:
```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // User Profiles
    match /users/{uid} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    
    // Unique Usernames
    match /usernames/{username} {
      allow read: if true;
      allow create: if request.auth != null;
    }
    
    // Chat Rooms & Messages
    match /chat_rooms/{roomId} {
      allow read: if true;
      allow write: if request.auth != null;
      
      match /messages/{messageId} {
        allow read: if true;
        allow create: if request.resource.data.text.size() > 0 &&
                        request.resource.data.text.size() <= 500;
      }
    }
    
    // Forum Threads & Replies
    match /forum_threads/{threadId} {
      allow read: if true;
      allow create: if request.resource.data.comment.size() > 0;
      allow update: if request.auth != null;
      
      match /replies/{replyId} {
        allow read: if true;
        allow create: if request.resource.data.comment.size() > 0;
      }
    }
  }
}
```
