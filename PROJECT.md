# Project: "Get Real" Web Application Transformation

## Architecture
- **Client Architecture**: Zero-bundler, static multi-view vanilla web application running directly in any modern browser.
- **Views**: Hub (`#view-hub`), Reader (`#view-reader`), Live Chat (`#view-chat`), Discussion Board (`#view-forum`), Quick Scratchpad (`#view-notes`).
- **Core Modules**:
  - `index.html`: Application structure, modal containers, and view shells.
  - `style.css`: Design system, CSS variables (`:root` / `.dark-mode`), layouts, responsive rules.
  - `theme.js`: `ThemeManager` singleton (light/dark mode toggle, persistence, icon updating).
  - `account.js`: `AccountManager` singleton (user credentials, salted SHA-256 hashing, active profile, cloud/local sync).
  - `apps.js`: Application registry for hub cards and navigation.
  - `app.js`: View router (`switchMainView`), reader controls, chapter catalog, bookmarks, scratchpad bridge, portable reader generator.
  - `chat.js`: `ChatApp` singleton (rooms list, active room, message stream, member list, moderation).
  - `forum.js`: `ForumApp` singleton (catalog of threads, board navigation, reply threads, blockquotes).
  - `firebase-config.js`: Firebase App, Auth, and Firestore initialization with fallback detection.
  - `profanity.js`: Content moderation dictionary filter.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | Hub Footer Pill Removal | Remove "Powered by Elgatitolover GIFs · ChromeOS Ready" footer pill and sanitize hub subtitle | M1 | ORIGINAL_REQUEST §R1 |
| F02 | Forum Rebranding | Rename "The Board" card tag from '4CHAN-STYLE FORUM' to 'DISCUSSION BOARD', sanitize subtitles | M1 | ORIGINAL_REQUEST §R1 |
| F03 | Input Placeholder Sanitization | Remove school safety, homework, and tripcode references across all inputs and modals | M1 | ORIGINAL_REQUEST §R1 |
| F04 | Realistic Seed Threads | Replace fake seed comments in forum.js with realistic community manga and tech threads | M1 | ORIGINAL_REQUEST §R1 |
| F05 | Semantic Blockquotes | Replace greentext formatting with semantic <blockquote> and CSS styling | M1 | ORIGINAL_REQUEST §R1 |
| F06 | Universal Lucide SVG Icons | Replace all 72 UI emojis across all files with clean Lucide-style SVG vector icons | M2 | ORIGINAL_REQUEST §R2 |
| F07 | Reader & Navigation SVG Controls | Standardize all reader tabs, toolbar chevrons, zoom, fullscreen, and download icons | M2 | ORIGINAL_REQUEST §R2 |
| F08 | Chat & Forum SVG Controls | Standardize lock, crown, users, pencil, send, plus, back icons in chat and forum | M2 | ORIGINAL_REQUEST §R2 |
| F09 | Account Modal SVG Tabs & Badges | Standardize key, user-plus, user, cloud, check, trash, and copy icons in account modal | M2 | ORIGINAL_REQUEST §R2 |
| F10 | Universal Header Actions Layout | Implement `.header-actions-universal` flex container strictly top-right across all 5 views | M3 | ORIGINAL_REQUEST §R3 |
| F11 | Standardized Header Action Buttons | Equalize size, padding, border-radius, and hover states for account and theme buttons | M3 | ORIGINAL_REQUEST §R3 |
| F12 | Theme Design Tokens & Contrast Fixes | Map all hardcoded dark hex colors to CSS variables (--bg, --surface, --border, --text) | M3 | ORIGINAL_REQUEST §R3 |
| F13 | Light Mode Visual Verification | Eliminate black-box inputs, dark canvas background, and invisible white-on-white text | M3 | ORIGINAL_REQUEST §R3 |
| F14 | DOMContentLoaded Crash Resolution | Fix setupEventListeners -> setupReaderControls & updateBookmarkCountBadge -> updateBookmarksBadge | M4 | ORIGINAL_REQUEST §R4 |
| F15 | Reader Initialization & Chapter 1 Load | Ensure Chapter 1 auto-loads, chapter catalog highlights active, controls bind reliably | M4 | ORIGINAL_REQUEST §R4 |
| F16 | Keyboard Shortcuts Active-View Scoping | Scope handleKeyDown shortcuts to reader view only; prevent accidental triggers elsewhere | M4 | ORIGINAL_REQUEST §R4 |
| F17 | Idempotent View Switch Handlers | Prevent event listener duplication in ChatApp.init() and ForumApp.init() on view switch | M4 | ORIGINAL_REQUEST §R4 |
| F18 | Scratchpad Persistence & Event Wiring | Restore scratchpad input event listener, sync to AccountManager, debounce storage writes | M4 | ORIGINAL_REQUEST §R4 |
| F19 | Asset Loading & Reader Optimization | Add async decoding, lazy loading, and single-page preloading to manga reader images | M4 | ORIGINAL_REQUEST §R4 |
| F20 | Chat Layout Thrashing Elimination | Replace full innerHTML rewrite on message append with incremental DOM append and rAF scroll | M4 | ORIGINAL_REQUEST §R4 |
| F21 | Search & Resize Debouncing | Add debounce to chapter catalog search, chat room search, and resize events | M4 | ORIGINAL_REQUEST §R4 |
| F22 | Standalone Reader Export Reliability | Escape embedded JSON, fix search reset bug on chapter click, wire up export button | M4 | ORIGINAL_REQUEST §R4 |
| F23 | Strict HTML & Attribute Sanitization | Implement canonical escapeHtml/escapeAttr replacing flawed div.innerHTML single-quote gap | M5 | ORIGINAL_REQUEST §R5 |
| F24 | Rate-Limiting & Cooldown Protection | Enforce minimum 1.5s debounce/cooldown on chat sends and forum thread/reply submissions | M5 | ORIGINAL_REQUEST §R5 |
| F25 | Secure Password Masking & Hashing | Replace window.prompt passwords with masked modal inputs; enforce Web Crypto salted SHA-256 | M5 | ORIGINAL_REQUEST §R5 |
| F26 | Safe Config Templating | Keep private keys out of repository; provide clear configuration templates | M5 | ORIGINAL_REQUEST §R5 |
| F27 | Firebase CDN SDK Integration | Create firebase-config.js using official Firebase v10 CDN SDK for App, Auth, Firestore | M6 | ORIGINAL_REQUEST §R6 |
| F28 | Firebase User Auth Integration | Connect user sign-up and login to Firebase Auth with username mapping and profile sync | M6 | ORIGINAL_REQUEST §R6 |
| F29 | Real-Time Chat Synchronization | Connect chat rooms and message collections to Firestore onSnapshot real-time listeners | M6 | ORIGINAL_REQUEST §R6 |
| F30 | Real-Time Discussion Board Sync | Connect forum threads and replies subcollections to Firestore onSnapshot listeners | M6 | ORIGINAL_REQUEST §R6 |
| F31 | Offline / Unconfigured Fallback Banner | Display non-intrusive setup banner when keys are missing; fallback 100% to local storage | M6 | ORIGINAL_REQUEST §R6 |
| F32 | Full E2E Test Suite & Hardening | Pass 100% of E2E test suite (Tiers 1-4) and complete Tier 5 adversarial verification | M7 | ORIGINAL_REQUEST Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Branding & AI Tell Elimination | F01, F02, F03, F04, F05 | none | PLANNED |
| M2 | Universal SVG Icon Migration | F06, F07, F08, F09 | none | PLANNED |
| M3 | Header Layout & Theme Consistency | F10, F11, F12, F13 | M1, M2 | PLANNED |
| M4 | Runtime Bug Fixes & Performance | F14, F15, F16, F17, F18, F19, F20, F21, F22 | none | PLANNED |
| M5 | Security & Hardening | F23, F24, F25, F26 | none | PLANNED |
| M6 | Firebase Real-Time & Fallback | F27, F28, F29, F30, F31 | M5 | PLANNED |
| M7 | E2E Test Verification & Hardening | F32 (Pass 100% E2E tests + Tier 5 adversarial) | M1-M6, TEST_READY | PLANNED |

## Interface Contracts

### Universal Header Contract (`index.html` ↔ `style.css` ↔ `theme.js` ↔ `account.js`)
- Container class: `.header-actions-universal`
- Elements inside:
  1. `<button class="btn btn-pill account-pill-btn" onclick="AccountManager.openModal()">`
     - Child elements: `<img class="account-avatar-mini">`, `<span class="account-username-text">`, `<span class="account-verified-pill-icon">`
  2. `<button class="btn btn-pill theme-toggle-btn" onclick="ThemeManager.toggle()">`
     - Child elements: `<span class="theme-icon-slot">`, `<span class="theme-mode-text">`
- Position: Top-right corner of every view header (`margin-left: auto; flex-shrink: 0;`).

### Sanitizer & Rate-Limiter Contract (`chat.js`, `forum.js`, `account.js`)
- `escapeHtml(str)`: Escapes `&`, `<`, `>`, `"`, `'`, and `` ` ``.
- `RateLimiter.check(actionKey, cooldownMs)`: Returns `{ allowed: boolean, remainingMs: number, remainingSec: string }`.
- `hashPassword(password, salt)`: Returns `Promise<string>` containing 64-character hex SHA-256 hash using `crypto.subtle`.

### Firebase Service Contract (`firebase-config.js` ↔ `chat.js` ↔ `forum.js` ↔ `account.js`)
- Global object: `window.FirebaseService = { isConfigured: boolean, isOnline: boolean, auth, db, ... }`
- Event callbacks / listeners:
  - `FirebaseService.onChatMessages(roomId, callback)`: returns unsubscribe function.
  - `FirebaseService.sendChatMessage(roomId, messageData)`: returns `Promise<void>`.
  - `FirebaseService.onForumThreads(boardId, callback)`: returns unsubscribe function.
  - `FirebaseService.postForumThread(threadData)`: returns `Promise<string>`.
  - `FirebaseService.onThreadReplies(threadId, callback)`: returns unsubscribe function.
  - `FirebaseService.postThreadReply(threadId, replyData)`: returns `Promise<void>`.
- Fallback semantics: When `isConfigured === false`, all methods invoke local storage operations transparently with zero errors.

## Code Layout
- `index.html`: Main markup, view definitions, modals, and templates.
- `style.css`: Stylesheet, CSS variables, utility classes, and layout rules.
- `theme.js`: Theme toggle logic, SVG icon integration, theme persistence.
- `apps.js`: Application definitions for the hub cards.
- `app.js`: View switcher, reader controls, chapter rendering, bookmarks, scratchpad, portable export.
- `chapters.js`: Manga chapter metadata.
- `chat.js`: Live chat application, rooms, messages, host controls.
- `forum.js`: Discussion board engine, thread rendering, replies, quotes.
- `account.js`: Account manager, auth modal, profile persistence, cloud sync.
- `firebase-config.js`: Firebase v10 CDN SDK integration, auth, Firestore real-time sync, offline fallback.
- `profanity.js`: Text moderation utility.
- `tests/`: Automated E2E and unit test suite.
