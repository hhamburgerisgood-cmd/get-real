# Get Real Overhaul — Task Checklist

## Phase 1: Foundations, Bug Fixes & AI Tell Removal
- [ ] **Task 1: Fix critical runtime bugs in `app.js`**
  - **Acceptance criteria:**
    - Line 66 calls `setupReaderControls()` instead of undefined `setupEventListeners()`.
    - Line 67 calls `updateBookmarksBadge()` instead of undefined `updateBookmarkCountBadge()`.
    - Console shows zero unhandled errors on page load.
  - **Verification:** Run `node -c app.js`; load in browser and verify event listeners attach.
  - **Files:** `app.js`

- [ ] **Task 2: Remove AI tells and 4chan branding**
  - **Acceptance criteria:**
    - Forum card tag in `apps.js` set to `DISCUSSION BOARD`.
    - Forum subtitle in `apps.js` set to `Threaded discussions · Quotes & replies`.
    - Hub footer pill completely removed from `index.html`.
    - Academic/homework phrasing removed from scratchpad and bio placeholders.
  - **Verification:** Search for "4chan", "Elgatitolover GIFs", and "ChromeOS" in codebase; verify 0 matches.
  - **Files:** `apps.js`, `index.html`, `README.md`

- [ ] **Task 3: Modernize Discussion Board & remove greentext**
  - **Acceptance criteria:**
    - Greentext formatting replaced with standard blockquotes.
    - Tripcode placeholders removed; author defaults to "Guest" or current username.
    - AI seed posts replaced with authentic community discussion threads.
  - **Verification:** Post comment starting with `>` and verify standard quote styling.
  - **Files:** `forum.js`, `style.css`

## Checkpoint: Phase 1
- [ ] Page loads cleanly without JavaScript errors.
- [ ] Reader controls function properly.
- [ ] AI watermarks and 4chan tags eliminated.

---

## Phase 2: SVG Icons & UI Consistency
- [ ] **Task 4: Replace UI emojis with Lucide SVG icons**
  - **Acceptance criteria:**
    - Theme toggle uses Sun and Moon SVGs.
    - Reader tabs, toolbar, and controls use Book, Bookmark, Download, Chevron SVGs.
    - Chat controls use Lock, Crown, Users, Pencil, Send SVGs.
    - Forum and Account modal tabs use proper SVG icons.
  - **Verification:** Inspect all buttons across views; zero raw emoji icons found.
  - **Files:** `index.html`, `theme.js`, `app.js`, `chat.js`, `forum.js`, `style.css`

- [ ] **Task 5: Unify header layouts across all views**
  - **Acceptance criteria:**
    - Standardized `.header-actions-universal` container in the top-right corner of every view header.
    - Account pill button and Theme toggle button are identically sized and placed across all views.
    - Chat header no longer uses custom mismatched account styling.
  - **Verification:** Switch between all 5 views; top-right controls do not shift or jump.
  - **Files:** `index.html`, `style.css`

- [ ] **Task 6: Fix color variables for Light Mode support**
  - **Acceptance criteria:**
    - Replace hardcoded hex colors (`#0D0E13`, `#242836`, `#141722`, `#334155`, `#8B94A7`) with CSS variables.
    - `.reader-canvas` background uses `var(--bg)` or dedicated canvas variable.
    - Inputs in modals have proper contrast in both Light and Dark mode.
  - **Verification:** Toggle Light Mode; verify all text, inputs, and borders are clearly legible.
  - **Files:** `index.html`, `style.css`

## Checkpoint: Phase 2
- [ ] All UI emojis replaced with SVGs.
- [ ] Headers consistent across all views.
- [ ] Light and Dark modes render cleanly.

---

## Phase 3: Security & Performance
- [ ] **Task 7: Input sanitization & XSS prevention**
  - **Acceptance criteria:**
    - Chat message and forum comment rendering sanitizes all user input.
    - HTML tags are escaped before insertion.
  - **Verification:** Send `<script>alert(1)</script>` in chat and forum; verify rendered as text.
  - **Files:** `chat.js`, `forum.js`

- [ ] **Task 8: Anti-spam rate limiting**
  - **Acceptance criteria:**
    - Rapid sending of chat messages is throttled with a 1.5s cooldown.
    - Rapid posting of forum threads is throttled.
  - **Verification:** Attempt rapid double-click on send/post; cooldown feedback is displayed.
  - **Files:** `chat.js`, `forum.js`

- [ ] **Task 9: Performance optimization**
  - **Acceptance criteria:**
    - Image elements use `loading="lazy"` and `decoding="async"`.
    - Event listeners on search and resize are debounced.
  - **Verification:** Measure page load and navigation responsiveness.
  - **Files:** `app.js`, `index.html`

## Checkpoint: Phase 3
- [ ] Security tests pass (no XSS, rate limiting active).
- [ ] Performance optimizations applied.

---

## Phase 4: Firebase Backend Integration
- [ ] **Task 10: Firebase configuration & offline fallback scaffolding**
  - **Acceptance criteria:**
    - `firebase-config.js` initializes Firebase v10 CDN SDK.
    - Gracefully falls back to local storage if config is not yet supplied.
    - Clear documentation on how to add Firebase credentials.
  - **Verification:** Site loads and functions normally even with blank Firebase config.
  - **Files:** `firebase-config.js`, `index.html`

- [ ] **Task 11: Firebase Auth integration in `account.js`**
  - **Acceptance criteria:**
    - Sign up and log in interact with Firebase Auth.
    - User profile and bookmarks sync to Firestore when authenticated.
  - **Files:** `account.js`

- [ ] **Task 12: Real-time chat integration in `chat.js`**
  - **Acceptance criteria:**
    - Messages read and write to Firestore `chat_messages` collection in real time.
  - **Files:** `chat.js`

- [ ] **Task 13: Shared forum integration in `forum.js`**
  - **Acceptance criteria:**
    - Threads and replies read and write to Firestore collections in real time.
  - **Files:** `forum.js`

## Checkpoint: Final Verification
- [ ] All acceptance criteria met across all phases.
- [ ] Code committed and pushed to GitHub repository.
