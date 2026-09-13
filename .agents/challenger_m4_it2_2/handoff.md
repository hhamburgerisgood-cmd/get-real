# Handoff Report: Milestone M4 Iteration 2 Adversarial Stress Testing

**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

1. **Worker Suite & Regression Verification**:
   - `node tests/m4_adversarial_suite.js`: Exited with code `0`. 0 defects reported.
     - Section 1 (Chat DOM 500-message benchmark): Incremental `appendSingleMessage` created 500 nodes with 0 innerHTML wipes (vs naive baseline recreating 125,250 nodes).
     - Section 2 (Scratchpad rapid input & debounce): 0 localStorage writes during 50-keystroke rapid typing, 1 coalesced write after 300ms debounce.
     - Section 3 (Image attributes): `decoding="async"`, `referrerpolicy="no-referrer"`, `loading="lazy"` verified across all 58 pages.
   - `node tests/run_all_tests.js --feature R4`: 12/12 passed (100%).
   - `node tests/m4_adversarial_challenge.test.js`: 19/19 passed (100%).

2. **Chat DOM Appending & Reflow Avoidance Under Heavy Bursts**:
   - Spied on layout getters (`scrollHeight`, `offsetHeight`, `clientHeight`, `scrollTop`, `offsetTop`) on `#chat-messages-container` during `appendSingleMessage` calls in `tests/challenger_m4_it2_stress.js`:
     - Synchronous layout queries during `appendSingleMessage`: **0**.
     - All scroll positioning operations (`container.scrollTop = container.scrollHeight`) are cleanly deferred into `requestAnimationFrame(() => { ... })`.
   - Verified 1,000-message burst append throughput: 1,000 nodes created, duplicate IDs cleanly rejected, foreign room messages ignored, XSS script/iframe/onerror tags escaped as HTML entities.

3. **Guest Scratchpad Reload Persistence**:
   - Verified that `AccountManager.saveScratchpad(text)` writes guest input to `localStorage.setItem('hub_scratchpad_v1', text)` and `loadGuestData()` restores it on initial load.
   - Tested multi-cycle reload: brand-new browser contexts initialized with persisted storage correctly restore `#scratchpad-text` and `AccountManager.getScratchpad()`.
   - Verified draft preservation: switching views between Hub, Reader, Chat, and Notes during active typing does not clobber user drafts.
   - Verified account migration: registering an account transfers guest notes to the newly created account profile.

4. **Empirical Defect Uncovered**:
   - File: `chat.js`, lines 74–79:
     ```javascript
     AccountManager.onAccountChange((acc) => {
       currentUser = acc.username;
       renderUserHeader();
       updateRoomHeader();
       announcePresence();
     });
     ```
   - Executing `node tests/repro_chat_guest_typeerror.js` or running `tests/challenger_m4_it2_stress.js` reproduces the verbatim crash:
     ```
     TypeError: Cannot read properties of null (reading 'username')
         at chat.js:75:27
         at account.js:544:13
         at Array.forEach (<anonymous>)
         at notifyListeners (account.js:543:21)
         at notifyChange (account.js:539:5)
         at Object.saveScratchpad (account.js:518:5)
     ```
   - Triggers for this crash:
     1. Reader initialization on startup: `selectChapter(allChapters[0], 0)` in `app.js:116` calls `saveReadingProgress` in `account.js:468` -> fires `notifyChange('readingProgress')` -> `chat.js:75` crashes.
     2. Scratchpad typing as a guest: `saveScratchpad(text)` in `account.js:507` -> fires `notifyChange('scratchpad')` -> `chat.js:75` crashes every 300ms after user pauses typing.
     3. User logout: `AccountManager.logout()` in `account.js:303` -> sets `activeAccountId = null` -> fires `notifyChange('logout')` -> `chat.js:75` crashes on `acc.username`.
     4. Chat lockout after logout: Because `currentUser = acc.username` crashes before line 76 (`renderUserHeader()`), `currentUser` in `chat.js` remains permanently set to the logged-out username. When the user attempts to send a chat message as a guest, `chat.js:819` detects `!isAuth && AccountManager.isUsernameRegistered(currentUser)` and blocks the user with an anti-impersonation alert, locking them out of sending messages.

---

## 2. Logic Chain

1. In `account.js:543-545`, `notifyListeners(reason)` passes `getActiveAccount()` to all registered callbacks:
   `changeListeners.forEach(cb => { try { cb(getActiveAccount(), reason); } catch(e) { console.error(e); } });`
2. When the user is not authenticated (guest session) or has just logged out, `getActiveAccount()` evaluates to `null`.
3. In `chat.js:74-79`, the registered change listener unconditionally accesses `acc.username`:
   `AccountManager.onAccountChange((acc) => { currentUser = acc.username; ... });`
4. Attempting to access `.username` on `null` immediately throws `TypeError: Cannot read properties of null (reading 'username')`.
5. This directly violates the Acceptance Criteria in `ORIGINAL_REQUEST.md`:
   *"Zero unhandled errors in the browser console upon loading the page or switching between any of the 5 views."*
6. Additionally, because the exception aborts execution of the listener, `currentUser` is never updated back to a guest handle, and `renderUserHeader()` is skipped. As a result, the user is locked out of chat after logging out because `sendMessage()` flags them as an unauthenticated user impersonating a registered account.

---

## 3. Caveats

- In `tests/m4_adversarial_suite.js`, preloading is conducted via `new Image()` rather than dynamic `<link rel="preload">` in `<head>`. This was noted as a low-severity `SPEC_GAP` in the worker report and does not cause runtime failure or functional issues.
- All other R4 features (chapter 1 autoload, keyboard scoping, catalog debouncing, scratchpad reload persistence, incremental chat append, and reflow avoidance) are functioning properly.

---

## 4. Conclusion

Milestone M4 features show high implementation quality and performance across chat DOM appending (zero reflows, rAF scrolling) and guest scratchpad reload persistence (`hub_scratchpad_v1`).

However, **REQUEST_CHANGES** is required due to the confirmed runtime defect in `chat.js:75:27`:
- In `chat.js:74-79`, `AccountManager.onAccountChange` must guard against `acc` being `null`:
  ```javascript
  AccountManager.onAccountChange((acc) => {
    currentUser = (acc && acc.username) ? acc.username : (AccountManager.getUsername() || localStorage.getItem(STORAGE_USER) || 'AnonCat');
    renderUserHeader();
    updateRoomHeader();
    announcePresence();
  });
  ```
This one-line fix will eliminate the console `TypeError` on guest page loads, chapter selections, scratchpad debouncing, and logout events, and will ensure chat permissions correctly reset upon logout.

---

## 5. Verification Method

To independently verify the defect and validate the upcoming fix:

1. **Minimal Defect Reproduction**:
   ```powershell
   node tests/repro_chat_guest_typeerror.js
   ```
   *Current behavior*: Outputs `TypeError: Cannot read properties of null (reading 'username') at chat.js:75:27` on scratchpad save and on logout.
   *Expected after remediation*: Clean execution with 0 TypeErrors.

2. **Challenger Adversarial Stress Suite**:
   ```powershell
   node tests/challenger_m4_it2_stress.js
   ```
   *Current behavior*: 10/11 passed, Test 2.6 fails due to the null listener crash.
   *Expected after remediation*: 11/11 passed (100%), exit code 0.

3. **Worker Test Suites**:
   ```powershell
   node tests/run_all_tests.js --feature R4
   node tests/m4_adversarial_challenge.test.js
   node tests/m4_adversarial_suite.js
   ```
   *Expected*: All pass with 100% success rate.
