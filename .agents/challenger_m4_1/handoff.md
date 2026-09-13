# Milestone M4 Adversarial Verification Report: Empirical Challenge Findings

**Agent ID**: `challenger_m4_1`  
**Working Directory**: `C:\Users\User\Desktop\Get Real\.agents\challenger_m4_1`  
**Workspace Root**: `C:\Users\User\Desktop\Get Real`  
**Timestamp**: `2026-09-13T08:05:00Z`  
**Target Milestone**: Milestone M4 (Features F14–F22: Runtime Bug Fixes & Performance Optimization)  
**Assigned Role**: Empirical Challenger & Adversarial Reviewer  
**Verdict**: **`REQUEST_CHANGES`**

---

## 1. Observation

Direct empirical observations from test suites (`tests/m4_adversarial_challenge.test.js`, `tests/m4_adversarial_suite.js`, and `tests/run_all_tests.js --filter R4`):

### 1.1 Core Test Suite Regression Failures
Running `node tests/run_all_tests.js --filter R4` results in **2 test failures** out of 12 tests:
```
  ✔ PASS [T1-R4-01] DOMContentLoaded handler crash resolution in app.js (82ms)
  ✔ PASS [T1-R4-02] Manga reader auto-loads Chapter 1 on startup (36ms)
  ✔ PASS [T1-R4-03] Keyboard shortcuts scoped exclusively to reader view (0ms)
  ✖ FAIL [T1-R4-04] Idempotent view switching handlers (prevent duplicate event listeners) (1ms)
  ✖ FAIL [T1-R4-05] Quick scratchpad persistence and AccountManager live wiring (36ms)
  ✔ PASS [T1-R4-06] Standalone reader export generator reliability (0ms)
```
- **T1-R4-04 Failure Detail**:
  `AssertionError: forum.js ForumApp.init() must guard against multiple initializations (Expected "function init() { ... }" to match /isInitialized|initialized|_isInit/)`
  - Observation: `forum.js:53` has NO idempotency guard. In contrast to `chat.js:55` (which was patched with `isInitialized`), `forum.js` was left unpatched by `worker_m4_1`.
- **T1-R4-05 Failure Detail**:
  `AssertionError: AccountManager.getScratchpad() should synchronize with noteArea input (Expected "Important test notes for Get Real", got "")`
  - Observation: In `app.js:82`, `noteArea.addEventListener('input', debounce((e) => { AccountManager.saveScratchpad(e.target.value); }, 300))` defers saving to AccountManager by 300ms. Synchronous readers see stale data immediately following an input event.

### 1.2 Area 1: Rapid View Switching Between Hub, Reader, Chat, Forum, Notes
Direct execution of `tests/m4_adversarial_challenge.test.js` (Test STRESS-1.1 & STRESS-1.2):
```
[FAIL] STRESS-1.1: ForumApp.init() listener accumulation on view switches
       -> Error/Finding: LEAK DETECTED: #forum-submit-thread-btn accumulated 10 click listeners (expected 1). Clicking submit will trigger 10 times.
[FAIL] STRESS-1.2: ForumApp.init() missing idempotency guard (F17 defect)
       -> Error/Finding: forum.js lacks isInitialized guard; each switchMainView("forum") re-registers AccountManager listeners and DOM click handlers without unbinding.
```
- Code inspection of `forum.js:53-66` and `forum.js:80-116`:
  ```javascript
  function init() {
    ...
    if (typeof AccountManager !== 'undefined') {
      AccountManager.onAccountChange(() => { renderForum(); });
    }
    setupForumEvents();
    renderForum();
  }
  ```
  Every time `switchMainView('forum')` is executed:
  1. An additional anonymous listener is pushed into `accountChangeListeners` array in `account.js`.
  2. `setupForumEvents()` attaches duplicate `click` listeners to `.board-nav-link`, `#btn-toggle-post-box`, `#forum-submit-thread-btn`, and `#forum-back-catalog-btn`.
- Test STRESS-1.5: Data Loss on View Switch:
  ```
  [FAIL] STRESS-1.5: Data loss: initNotes() clobbers unsaved user input on view switch
         -> Error/Finding: DATA LOSS BUG: User typed draft was clobbered by initNotes() on view switch! Expected "Unsaved draft text in scratchpad", got "".
  ```
  - Code inspection of `app.js:35-37` and `app.js:129-134`:
    ```javascript
    function switchMainView(viewId) {
      ...
      } else if (viewId === 'notes') {
        initNotes();
      }
    }
    function initNotes() {
      const noteArea = document.getElementById('scratchpad-text');
      if (noteArea) {
        noteArea.value = (typeof AccountManager !== 'undefined') ? AccountManager.getScratchpad() : (localStorage.getItem(STORAGE_NOTES) || '');
      }
    }
    ```
    If a user types notes and navigates to another view before the 300ms debounce timer expires, returning to notes triggers `initNotes()`, which overwrites `noteArea.value` with the stale storage value, irreversibly destroying the user's unpersisted draft.

### 1.3 Area 2: Rapid Chapter Search Filtering and Debouncing
- Test STRESS-2.1 & STRESS-2.2:
  - 50 rapid keystrokes at 2ms intervals are cleanly debounced to 1 invocation at 180ms delay.
  - Regex metacharacters (`.*+?^${}()|[]\`), SQL injection strings, and unicode characters do not crash.
- Test STRESS-2.3: Unhandled TypeError on Corrupted / Null Chapter Metadata:
  ```
  [FAIL] STRESS-2.3: renderChapterCatalog crashes on null chapter title (Robustness gap)
         -> Error/Finding: VULNERABILITY: c.title.toLowerCase() threw unhandled TypeError: Cannot read properties of null (reading 'toLowerCase')
  ```
  - Code inspection of `app.js:231-234`:
    `return c.title.toLowerCase().includes(q) || c.number.toString().includes(q);`
    If `c.title` or `c.number` is `null` or `undefined` (e.g., from an offline imported folder with malformed metadata), search crashes completely.
- Test STRESS-2.4: Stored XSS in Chapter Catalog DOM Insertion:
  ```
  [FAIL] STRESS-2.4: Stored XSS in Chapter Catalog rendering (app.js:242)
         -> Error/Finding: SECURITY GAP: Chapter title is interpolated directly into el.innerHTML without escapeHtml(), creating active DOM elements from chapter titles.
  ```
  - Code inspection of `app.js:242-245`:
    ```javascript
    el.innerHTML = `
      <span style="...">${ch.isLocal ? 'OFFLINE' : '#' + ch.number}</span>
      <span style="..." title="${ch.title}">${ch.title}</span>
    `;
    ```
    `ch.title` is raw-interpolated into `innerHTML` without HTML entity encoding.

### 1.4 Area 3: Standalone Reader HTML Generation
- Test STRESS-3.1, 3.3, 3.4:
  - Script breakout protection via `.replace(/</g, '\\u003c')` successfully prevents `</script>` breakouts.
  - Complex quotes and empty chapter lists export cleanly without syntax errors.
- Test STRESS-3.2: Stored XSS in Standalone Reader Template:
  ```
  [FAIL] STRESS-3.2: Stored XSS in Standalone Reader template renderList()
         -> Error/Finding: SECURITY GAP: Standalone reader template concatenates ch.title directly into item.innerHTML without escaping. If chapter metadata contains HTML/scripts, XSS executes in exported file.
  ```
  - Code inspection of `app.js:948`:
    ```javascript
    item.innerHTML = '<span class="ch-badge">#' + ch.number + '</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + ch.title + '</span>';
    ```
    The standalone reader HTML template contains direct concatenation of `ch.title` into `item.innerHTML`. Opening an exported standalone file containing malicious chapter titles executes arbitrary JavaScript.

### 1.5 Area 4: Keyboard Shortcuts Scoping and Global Mouse Wheel Listener
- Test STRESS-4.1 to 4.4:
  - Keyboard shortcuts (Space, Arrow keys, D, A, F, Ctrl+B) are correctly inactive under `#view-hub`, `#view-chat`, `#view-forum`, `#view-notes`, when on non-reader subtabs (`#rsub-bookmarks`, `#rsub-download`), and when typing in `<input>` or `<textarea>`.
- Test STRESS-4.5: Dropdown Navigation Collision:
  ```
  [FAIL] STRESS-4.5: handleKeyDown interferes with SELECT dropdown navigation
         -> Error/Finding: EDGE CASE: e.target.tagName is SELECT; handleKeyDown checks only INPUT and TEXTAREA, so pressing Space in chapter dropdown flips pages instead of opening dropdown.
  ```
  - Code inspection of `app.js:467`:
    `if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;`
    `<select>` elements (such as `#header-ch-select`) are not excluded.
- Test STRESS-4.6: Leaked Global Mouse Wheel Listener:
  ```
  [FAIL] STRESS-4.6: handleWheel global side-effect under non-reader views
         -> Error/Finding: LEAKED LISTENER: handleWheel attaches globally to window without active-view check. While on Chat, Ctrl+Wheel called preventDefault() and changed manga zoom from 1 to 1.1.
  ```
  - Code inspection of `app.js:186` & `app.js:485-490`:
    ```javascript
    window.addEventListener('wheel', handleWheel, { passive: false });
    ...
    function handleWheel(e) {
      if (e.ctrlKey) {
        e.preventDefault();
        setZoom(e.deltaY < 0 ? zoomFactor + 0.1 : Math.max(0.5, zoomFactor - 0.1));
      }
    }
    ```
    Unlike `handleKeyDown`, `handleWheel` contains NO check for `view-reader.classList.contains('active')`. In any view (Chat, Forum, Hub, Notes), pressing Ctrl+Wheel to zoom the browser window is hijacked: standard page zoom is blocked by `e.preventDefault()`, and the hidden manga reader's `zoomFactor` is mutated.

---

## 2. Logic Chain

1. **Premise**: `PROJECT.md` Feature F17 requires:
   `"Idempotent View Switch Handlers: Prevent event listener duplication in ChatApp.init() and ForumApp.init() on view switch"`.
   - **Observation 1.1 & 1.2**: `ChatApp.init()` implemented an `isInitialized` guard, but `ForumApp.init()` was completely untouched.
   - **Deduction**: Navigating to the forum repeatedly registers multiple listeners on the thread submit button and the global AccountManager.
   - **Empirical Confirmation**: STRESS-1.1 proves that switching to forum 10 times registers 10 separate `click` listeners on `#forum-submit-thread-btn`. Submitting a thread fires 10 times concurrently. Test `T1-R4-04` fails.

2. **Premise**: `PROJECT.md` Feature F18 requires:
   `"Restore scratchpad input event listener, sync to AccountManager, debounce storage writes"`.
   - **Observation 1.1**: Test `T1-R4-05` expects `AccountManager.getScratchpad()` to synchronize with `noteArea` input immediately upon dispatching `input`.
   - **Deduction**: Wrapping the call to `AccountManager.saveScratchpad()` in a 300ms debounce causes `AccountManager.getScratchpad()` to return stale text immediately after typing.
   - **Observation 1.2**: `initNotes()` in `app.js:129` resets `noteArea.value` whenever `#view-notes` is activated.
   - **Deduction**: If a user switches views during the 300ms debounce window, the draft is wiped by `initNotes()` before persistence.

3. **Premise**: `ORIGINAL_REQUEST.md` §R5 requires:
   `"Treat all chat messages, forum threads, replies, and account bios as untrusted input. Enforce strict HTML escaping/sanitization"`.
   - **Observation 1.3 & 1.4**: Both `renderChapterCatalog` (`app.js:242`) and the standalone reader generator (`app.js:948`) interpolate `ch.title` into `innerHTML` without `escapeHtml()`.
   - **Deduction**: Any HTML tag inside chapter titles creates live DOM elements and executes script payloads.

4. **Premise**: `PROJECT.md` Feature F16 requires:
   `"Keyboard Shortcuts Active-View Scoping: Scope handleKeyDown shortcuts to reader view only; prevent accidental triggers elsewhere"`.
   - **Observation 1.5**: While `handleKeyDown` was scoped to `#view-reader` and `#rsub-reader`, `handleWheel` (`app.js:186, 485`) was attached to `window` with NO view check.
   - **Deduction**: Ctrl+Wheel globally hijacks standard browser zoom in Chat, Forum, Hub, and Notes views, breaking standard browser accessibility.

5. **Conclusion**:
   Because multiple functional regressions (T1-R4-04, T1-R4-05), critical listener leaks (ForumApp), data loss race conditions (initNotes), XSS vulnerabilities, and hijacked browser zoom exist in the Milestone M4 deliverables, Milestone M4 CANNOT be approved without fixes.

---

## 3. Adversarial Review Challenge Report

### Challenge Summary
**Overall risk assessment**: **CRITICAL**

### Challenges

#### 1. [Critical] ForumApp Event Listener Accumulation & Memory Leak (F17 Defect)
- **Assumption challenged**: `worker_m4_1` claimed F17 ("Prevent event listener duplication in ChatApp.init() and ForumApp.init() on view switch") was fully completed.
- **Attack scenario**: User navigates between Hub, Forum, and Chat during normal site navigation.
- **Blast radius**: Each visit adds listeners to `#forum-submit-thread-btn` and `AccountManager.onAccountChange`. Clicking post results in duplicate thread creation and thread spam. Test `T1-R4-04` permanently fails.
- **Mitigation**: Add an `isInitialized` guard to `forum.js` identical to `chat.js:55-70` so that `setupForumEvents()` and `AccountManager.onAccountChange` run strictly once.

#### 2. [High] Scratchpad Data Loss Race Condition in `initNotes()` (F18 Defect)
- **Assumption challenged**: Debouncing `#scratchpad-text` with 300ms is safe across view switches.
- **Attack scenario**: User types notes, navigates to another view (or back to Hub) within 300ms, and returns to notes.
- **Blast radius**: `initNotes()` resets `noteArea.value` with stale storage data, destroying user text.
- **Mitigation**: In `app.js:82`, update in-memory `AccountManager.saveScratchpad(e.target.value)` synchronously while debouncing storage/broadcast writes; in `initNotes()`, only update `noteArea.value` if `document.activeElement !== noteArea` and `noteArea.value` is empty or clean.

#### 3. [High] Stored XSS in Chapter Catalog and Standalone Reader Template
- **Assumption challenged**: Chapter metadata is always trustworthy and contains only alphanumeric titles.
- **Attack scenario**: Offline chapters imported via folder picker or remote chapters contain `<img src=x onerror=...>` in their title.
- **Blast radius**: Arbitrary script execution in both the main application and the standalone exported reader.
- **Mitigation**: Wrap `ch.title` in `escapeHtml(ch.title)` before interpolating into `innerHTML`, or set `textContent` instead of using string templates.

#### 4. [Medium] Leaked Global Wheel Zoom Hijack
- **Assumption challenged**: Scoping `handleKeyDown` to the active reader view was sufficient for input scoping.
- **Attack scenario**: User in Chat or Forum presses Ctrl+Wheel to zoom the browser view.
- **Blast radius**: Browser zoom is blocked by `e.preventDefault()`, and the hidden manga reader zoom level changes unexpectedly.
- **Mitigation**: Add active view check to `handleWheel`:
  ```javascript
  const readerView = document.getElementById('view-reader');
  if (!readerView || !readerView.classList.contains('active')) return;
  ```

#### 5. [Low] Chapter Dropdown Keydown Collision
- **Assumption challenged**: Only `<input>` and `<textarea>` elements receive keyboard focus.
- **Attack scenario**: User clicks `#header-ch-select` and presses Spacebar to select an option.
- **Blast radius**: Reader flips to the next page instead of allowing dropdown interaction.
- **Mitigation**: In `app.js:467`, check `e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT'`.

---

## 4. Caveats

- Milestone M1–M3 and M5–M6 features are unmerged in the working directory; their respective tests in `tests/run_all_tests.js` are expected to fail until their respective milestones are reached.
- The remote CDN host (`https://jjkmangaa.com/...`) was not subjected to network saturation tests to preserve external bandwidth limits; offline fallback generation in `fetchChapterPages` was verified in-memory.

---

## 5. Conclusion & Action Items

**Milestone M4 Verdict**: **`REQUEST_CHANGES`**

Worker `worker_m4_1` must implement the following targeted corrections:
1. **Patch `forum.js` (F17)**:
   Add `let isInitialized = false;` guard to `ForumApp.init()` to prevent duplicate listeners on view switches (resolves `T1-R4-04` and `STRESS-1.1`).
2. **Patch `app.js` Scratchpad Sync (F18)**:
   Synchronize `AccountManager.saveScratchpad(e.target.value)` immediately in-memory while debouncing disk persistence, and guard `initNotes()` against overwriting active user drafts (resolves `T1-R4-05` and `STRESS-1.5`).
3. **Patch `app.js` HTML Escaping (F15 & F22)**:
   Escape `ch.title` in `renderChapterCatalog` (`app.js:242`) and standalone reader `renderList` (`app.js:948`). Handle null/undefined title gracefully (resolves `STRESS-2.3`, `STRESS-2.4`, `STRESS-3.2`).
4. **Patch `app.js` `handleWheel` & `handleKeyDown` (F16)**:
   Scope `handleWheel` to `#view-reader.active` and exclude `SELECT` in `handleKeyDown` (resolves `STRESS-4.5`, `STRESS-4.6`).

---

## 6. Verification Method

To independently execute and verify all adversarial challenge findings:

```powershell
# 1. Run Challenger Empirical Stress Test Suite
node tests/m4_adversarial_challenge.test.js

# 2. Run Milestone M4 Baseline Requirement Tests
node tests/run_all_tests.js --filter R4

# 3. Run Benchmark and Scratchpad Race Suite
node tests/m4_adversarial_suite.js
```
