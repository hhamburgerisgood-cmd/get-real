# Test Infrastructure & 4-Tier E2E Methodology

## Overview
The "Get Real" web application test suite is a requirement-driven, zero-external-dependency automated testing infrastructure built directly on standard Node.js. It verifies the complete transformation of the Get Real web application across all visual, functional, security, performance, and cloud integration requirements (R1–R6) defined in `ORIGINAL_REQUEST.md` and `PROJECT.md`.

---

## 1. Test Architecture

### 1.1 Zero-Dependency Headless Browser & DOM Simulation
The application client is a vanilla JavaScript static web app. To provide deterministic, sub-second execution in any standard Node.js runtime without fragile browser drivers or complex package installations, the test infrastructure uses `tests/harness.js`.

The harness provides:
- **Lightweight Virtual DOM**: Full DOM hierarchy (`DOMDocument`, `DOMElement`, `DOMTextNode`, `DOMCommentNode`) supporting standard DOM manipulation (`appendChild`, `removeChild`, `insertBefore`, `innerHTML`, `textContent`, `classList`, `style`, `dataset`, `attributes`).
- **CSS Selector Engine**: Compound, descendant, class, ID, and attribute selectors (`querySelector`, `querySelectorAll`, `getElementsByClassName`, `getElementsByTagName`, `matchesSelector`).
- **Browser Web APIs**:
  - `window` and `document` environments parsed directly from `index.html`.
  - `localStorage` and `sessionStorage` in-memory mock storage engines.
  - `window.crypto` with native Web Crypto API (`crypto.subtle.digest('SHA-256')` and `crypto.getRandomValues`).
  - `window.matchMedia` for OS-level theme preference simulation.
  - Event dispatching and propagation (`addEventListener`, `removeEventListener`, `dispatchEvent`, `click`, `focus`, `blur`).
  - DOM life-cycle events (`DOMContentLoaded`, `storage`, `keydown`, `resize`).
- **VM Sandboxing**: `node:vm` context execution for loading application scripts (`theme.js`, `account.js`, `apps.js`, `chapters.js`, `chat.js`, `forum.js`, `profanity.js`, `firebase-config.js`, `app.js`) with isolated global scopes and shared singletons.
- **Authoritative Assertion Helpers**: Explicit value checking (`assert`, `assertEqual`, `assertNotEqual`, `assertContains`, `assertNotContains`, `assertMatch`, `assertReject`).

---

## 2. 4-Tier Test Methodology

The test suite is structured into four distinct, vertically stratified tiers:

```
+-------------------------------------------------------------+
| Tier 4: Real-World Application Workloads                    |
| Full multi-view end-to-end user journeys & workflows        |
+-------------------------------------------------------------+
| Tier 3: Cross-Feature Combinations                          |
| Pairwise interactions between distinct subsystem states     |
+-------------------------------------------------------------+
| Tier 2: Boundary & Corner Cases                             |
| Adversarial inputs, XSS payloads, rate limits, quota stress |
+-------------------------------------------------------------+
| Tier 1: Feature Coverage                                    |
| Requirement happy paths & functional contracts (R1-R6)     |
+-------------------------------------------------------------+
```

### Tier 1: Feature Coverage (>=5 test cases per feature across R1-R6)
Direct verification of core functional requirements:
- **R1. Branding & AI Tell Elimination**:
  - Removal of footer pill `"GET REAL · Powered by Elgatitolover GIFs · ChromeOS Ready"`.
  - Rebranding "The Board" card tag from `'4CHAN-STYLE FORUM'` to `'DISCUSSION BOARD'`.
  - Sanitization of hub subtitle and input placeholders (no "school safety", "homework", or "tripcode").
  - Replacement of artificial seed comments with realistic community threads.
  - Removal of greentext parsing; quotes rendered as semantic `<blockquote>`.
- **R2. Universal SVG Icon Migration**:
  - Replacement of 72 UI emojis across all modules with Lucide SVG vector icons (`viewBox="0 0 24 24"`, `stroke-width="2"`).
  - Validation across theme toggle, reader controls, chat controls, forum controls, and account modal tabs.
- **R3. Header Layout & UI Theme Consistency**:
  - Dedicated `.header-actions-universal` container strictly top-right in all 5 view headers.
  - Standardized dimensions, padding, and hover states for account pill and theme buttons.
  - Elimination of hardcoded dark hex colors; mapping to CSS design tokens (`--bg`, `--surface`, `--border`, `--text`).
  - Light mode and Dark mode contrast integrity.
- **R4. Runtime Bug Fixes & Performance Optimization**:
  - Fix for fatal `DOMContentLoaded` crashes (`setupEventListeners` and `updateBookmarkCountBadge`).
  - Chapter 1 auto-load and active catalog highlight.
  - Keyboard shortcuts scoped exclusively to reader view.
  - Idempotent view switching without event listener accumulation.
  - Scratchpad persistence and AccountManager live synchronization.
  - Standalone reader export generation.
- **R5. Security & Hardening**:
  - Strict HTML entity and attribute escaping in chat and forum (preventing Stored XSS).
  - Minimum 1.5s rate-limiting debounce on chat messages and forum thread/reply creation.
  - Password field masking and salted SHA-256 cryptographic hashing.
- **R6. Firebase Real-Time Integration & Offline Fallback**:
  - `firebase-config.js` initialization with Firebase v10 CDN SDK.
  - Graceful fallback banner and transparent local storage routing when unconfigured/offline.
  - Real-time `onSnapshot` listener registration and clean unsubscription.

### Tier 2: Boundary & Corner Cases (>=5 test cases per feature across R1-R6)
Stress-testing system robustness against hostile, invalid, or boundary conditions:
- **R1 Boundaries**: Empty thread comments, nested blockquotes (`>>`, `>>>`), title case variations, logo image fallback rendering.
- **R2 Boundaries**: SVG attribute validation, missing icon fallbacks, zoom factor scaling, modal action icon fidelity.
- **R3 Boundaries**: Rapid 100x theme toggle stress, system `prefers-color-scheme` live changes, minimum 320px viewport responsive alignment, corrupt theme localStorage recovery.
- **R4 Boundaries**: Regex metacharacter catalog searches (`.*+?^${}()|[]\`), out-of-bounds chapter navigation, zero-bookmark badge handling, rapid 50x keydown bursts.
- **R5 Boundaries**: Hostile XSS vectors (`<script>`, `<img onerror>`, attribute breakout `' onclick=alert(1)`), empty/10,000-character password hashing, rapid 10x rate-limit bursts.
- **R6 Boundaries**: Unconfigured placeholder API keys, offline transition mid-session, localStorage quota exhaustion protection, repeated room listener switching memory leaks.

### Tier 3: Cross-Feature Combinations (Pairwise Interactions)
Verification of multi-feature state coherence across module boundaries:
- **Theme + Live Chat**: Toggling theme while inside active chat updates SVG icons and maintains chat bubble contrast tokens.
- **Account + Forum**: Switching active accounts while in forum updates default thread author and header avatar synchronously.
- **Offline Mode + Bookmarks**: Bookmarking chapters when offline persists locally and syncs to account state without network errors.
- **Chat Rate Limiting + Room Switching**: Changing rooms does not reset or bypass active 1.5s cooldown timers.
- **Forum Blockquotes + XSS Sanitization**: Quoted malicious inputs render safely inside semantic `<blockquote>` tags as plain escaped text.
- **Theme + Standalone Reader Export**: Exporting reader while in custom theme embeds clean SVGs and escaped JSON chapter data.
- **Scratchpad + View Router**: Switching between Notes, Reader, Chat, and Hub preserves scratchpad buffer and character counts.
- **Reader Zoom + Theme Toggle**: Reader canvas background tokens switch cleanly without resetting zoom scale or page positions.

### Tier 4: Real-World Application Workloads (End-to-End User Journeys)
Full multi-step simulation of authentic user workflows:
- **Journey 1 (Manga Reader Deep Dive)**: Launch app -> auto-load Ch. 1 -> page forward -> jump to Ch. 3 -> bookmark page -> filter catalog -> toggle continuous mode.
- **Journey 2 (Offline Content Creator & Reader)**: Open scratchpad -> write notes -> switch to dark mode -> bookmark chapter -> trigger standalone reader export -> verify export contents.
- **Journey 3 (Community Member Workflow)**: Register/switch account -> navigate to forum -> create thread -> inspect replies -> quote earlier comment -> verify blockquote rendering.
- **Journey 4 (Multi-Room Live Chat & Moderation)**: Enter chat -> join Lobby -> send message -> attempt rapid spam burst -> verify rate limit rejection -> switch to Tech room -> verify member list.
- **Journey 5 (Full Hybrid Lifecycle)**: Hub start -> account setup -> offline banner check -> manga reading with bookmarks -> scratchpad note taking -> theme toggle -> forum posting -> chat messaging.

---

## 3. Test Runner & Execution

### 3.1 CLI Execution
The test runner is executable with zero dependencies:
```bash
node tests/run_all_tests.js
```

### 3.2 CLI Options & Filtering
The runner supports granular execution flags:
- `node tests/run_all_tests.js --tier 1` : Run Tier 1 Feature Coverage tests only
- `node tests/run_all_tests.js --tier 2` : Run Tier 2 Boundary & Corner Case tests only
- `node tests/run_all_tests.js --tier 3` : Run Tier 3 Cross-Feature Combination tests only
- `node tests/run_all_tests.js --tier 4` : Run Tier 4 Real-World Application Workloads only
- `node tests/run_all_tests.js --filter <pattern>` : Run tests whose name matches pattern
- `node tests/run_all_tests.js --verbose` : Output detailed diagnostic stack traces for every test
- `node tests/run_all_tests.js --help` : Display help menu

### 3.3 Exit Codes
- `0`: All executed tests passed successfully.
- `1`: One or more tests failed (diagnostic breakdown output to console).

---

## 4. Test Suite File Structure
```
tests/
+-- harness.js                  # Virtual DOM, browser environment, VM sandbox, and assertions
+-- tier1_features.test.js      # Tier 1: Feature Coverage tests (R1-R6, 36 test cases)
+-- tier2_boundaries.test.js    # Tier 2: Boundary & Corner Case tests (R1-R6, 34 test cases)
+-- tier3_cross_feature.test.js # Tier 3: Cross-Feature Combination tests (8 pairwise tests)
+-- tier4_workloads.test.js     # Tier 4: Real-World Workload User Journeys (5 end-to-end journeys)
+-- run_all_tests.js            # Main CLI runner, aggregator, and diagnostic reporter
```
