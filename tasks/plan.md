# Implementation Plan: Get Real Overhaul

## Overview
Decompose the comprehensive overhaul of Get Real into verified, vertically-sliced tasks. This plan eliminates AI tells and 4chan branding, implements crisp Lucide SVG icons, unifies header layouts with universal top-right controls, fixes runtime bugs, hardens client-side security, optimizes performance, and integrates Firebase (Auth + Cloud Firestore) with an offline fallback.

## Architecture Decisions
- **Lucide SVG Icons**: Inline standard 24x24 SVG icons with stroke-width 2, replacing raw emojis to ensure consistent multi-platform rendering.
- **Universal Header Actions**: Standardize a `.header-actions-universal` container placed in the top-right corner of all 5 views.
- **Theme Design Tokens**: Replace hardcoded dark-mode hex strings with CSS variables (`var(--bg)`, `var(--surface)`, `var(--border)`, `var(--text)`, `var(--text-muted)`) so Light Mode renders with high contrast.
- **Firebase BaaS with Resilient Local Fallback**: Use Firebase v10 CDN SDK for Auth and Firestore; if configuration keys are missing or offline, gracefully fall back to local storage without throwing runtime errors.
- **Security & XSS Prevention**: Enforce strict HTML escaping on all dynamic chat and forum text; apply rate-limiting to prevent message and thread spam.

## Task List

### Phase 1: Foundations, Bug Fixes & AI Tell Removal
- [ ] Task 1: Fix critical runtime bugs in `app.js` (`setupEventListeners` and `updateBookmarkCountBadge`).
- [ ] Task 2: Remove AI tells, 4chan tags, and footer pill across `apps.js`, `index.html`, and `README.md`.
- [ ] Task 3: Sanitize placeholders, seed content, and remove greentext parsing in `forum.js`.

### Checkpoint: Phase 1 Verification
- [ ] `app.js` loads without `ReferenceError` in the browser console.
- [ ] Reader controls, keyboard navigation, and bookmarks function properly.
- [ ] All 4chan tags, footer pill, and artificial seed comments are gone.

### Phase 2: SVG Icon Migration & Header / Theme Consistency
- [ ] Task 4: Replace UI emojis with Lucide SVGs across `index.html`, `theme.js`, and `style.css`.
- [ ] Task 5: Standardize top-right header controls (`.header-actions-universal`) across all 5 views.
- [ ] Task 6: Resolve hardcoded dark colors and canvas backgrounds in `style.css` and `index.html` for Light Mode contrast.

### Checkpoint: Phase 2 Verification
- [ ] Zero emoji characters in UI buttons, tabs, or headers.
- [ ] Account and Theme buttons align identically in the top-right corner of every view.
- [ ] Toggling Light Mode shows proper contrast with zero pitch-black input boxes or unreadable text.

### Phase 3: Security Hardening & Performance Optimization
- [ ] Task 7: Implement input sanitization and XSS escaping in `chat.js` and `forum.js`.
- [ ] Task 8: Add rate-limiting cooldowns on message sending and thread creation.
- [ ] Task 9: Optimize asset loading, reader image decoding, and event listener debouncing.

### Checkpoint: Phase 3 Verification
- [ ] HTML injection attempts in chat and forum render as harmless text.
- [ ] Spamming send/post triggers cooldown warning.
- [ ] Smooth transitions and zero layout shifts.

### Phase 4: Firebase Real-Time Backend Integration
- [ ] Task 10: Create `firebase-config.js` with Firebase v10 CDN loader, configuration scaffolding, and offline fallback.
- [ ] Task 11: Connect `account.js` to Firebase Auth with username/password support and profile sync.
- [ ] Task 12: Connect `chat.js` to Firestore real-time message stream.
- [ ] Task 13: Connect `forum.js` to Firestore threads and replies collection.

### Checkpoint: Complete Verification
- [ ] App operates seamlessly offline / without credentials, displaying setup guidance.
- [ ] When credentials are provided, chat and forum sync in real time across browser windows.
- [ ] Final end-to-end verification and documentation update.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Firebase keys missing on initial clone | High | Resilient fallback to local storage so the site never breaks |
| XSS via user-supplied URLs or markdown | High | Strict URL scheme validation (http/https only) and text sanitization |
| Light mode contrast breakage | Med | Test every view under both light and dark themes using CSS variables |
