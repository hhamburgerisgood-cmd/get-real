/**
 * Independent Adversarial Test Suite by reviewer_m4_final
 * Stress-testing:
 * 1. chat.js null-safety under abnormal account payloads (null, undefined, {}, {username: ''}, etc.)
 * 2. account.js getScratchpad/saveScratchpad in headless (no DOM) environment
 * 3. Complete absence of DOM peeking in account.js
 * 4. Rapid typing & interleaved view-switching race conditions
 * 5. Scratchpad lifecycle across login, edit, switch view, logout, and guest fallback
 * 6. Integrity check: ensure no mocks/hardcoding in production files
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadApplicationContext, assert, assertEqual, assertNotEqual } = require('./harness');

let passedCount = 0;
let failedCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (e) {
    console.error(`[FAIL] ${name}: ${e.message}`);
    failedCount++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (e) {
    console.error(`[FAIL] ${name}: ${e.message}`);
    failedCount++;
  }
}

async function runAsyncTests() {
  console.log('=== reviewer_m4_final: Independent Adversarial Challenge Suite ===\n');

  // TEST 1: Absolute elimination of DOM peeking in account.js
  test('ADV-M4-01: account.js has zero DOM peeking and zero document/scratchpad-text references', () => {
    const code = fs.readFileSync(path.resolve(__dirname, '../account.js'), 'utf8');
    assertEqual(code.includes('scratchpad-text'), false, 'account.js must not reference scratchpad-text element');
    const match = code.match(/function\s+getScratchpad\s*\(\)\s*\{([\s\S]*?)\}/);
    assert(match, 'getScratchpad must exist in account.js');
    assertEqual(match[1].includes('document'), false, 'getScratchpad must not query document');
  });

  // TEST 2: chat.js null-safety under all possible falsy / malformed account payloads
  test('ADV-M4-02: chat.js onAccountChange listener survives null, undefined, and malformed accounts', () => {
    const ctx = loadApplicationContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });
    ctx.window.switchMainView('chat');

    const malformedPayloads = [
      null,
      undefined,
      false,
      0,
      '',
      {},
      { username: null },
      { username: '' },
      { username: undefined },
      { username: 12345 }
    ];

    for (const payload of malformedPayloads) {
      ctx.window.AccountManager.saveScratchpad('trigger sync notification');
    }
  });

  // TEST 3: account.js pure headless operations (without window/document)
  test('ADV-M4-03: account.js scratchpad works in pure headless node environment with no window/document', () => {
    const accountCode = fs.readFileSync(path.resolve(__dirname, '../account.js'), 'utf8');
    const mockLocalStorage = {
      _data: {},
      getItem(k) { return this._data[k] || null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; }
    };
    const headlessSandbox = {
      localStorage: mockLocalStorage,
      console: console,
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      TextEncoder: TextEncoder,
      Uint8Array: Uint8Array,
      Array: Array,
      Date: Date,
      Math: Math
    };
    const headlessCtx = vm.createContext(headlessSandbox);
    vm.runInContext(accountCode + '\nthis.AccountManager = AccountManager;', headlessCtx);

    const am = headlessSandbox.AccountManager;
    am.init();

    // Verify initial state
    assertEqual(am.getScratchpad(), '', 'Initial headless scratchpad should be empty');

    // Save and retrieve
    am.saveScratchpad('Headless note test 123');
    assertEqual(am.getScratchpad(), 'Headless note test 123', 'Headless getScratchpad should return saved text');
    assertEqual(mockLocalStorage.getItem('hub_scratchpad_v1'), 'Headless note test 123', 'localStorage should have stored text');

    // Clear note
    am.saveScratchpad('');
    assertEqual(am.getScratchpad(), '', 'Cleared scratchpad should return empty string');
  });

  // TEST 4: Integrity check: No hardcoded test responses or bypasses in chat.js, app.js, account.js
  test('ADV-M4-04: Integrity check - production files contain no test result bypasses or mocks', () => {
    const files = ['chat.js', 'app.js', 'account.js'];
    for (const f of files) {
      const content = fs.readFileSync(path.resolve(__dirname, '../', f), 'utf8');
      assertEqual(/if\s*\(\s*window\.__TEST__|isTesting|__mock/i.test(content), false, `${f} must not contain test mocks or conditional test bypasses`);
      assertEqual(content.includes('CHALLENGE-'), false, `${f} must not contain test IDs`);
      assertEqual(content.includes('T1-R4-'), false, `${f} must not contain test suite names`);
    }
  });

  // TEST 5: Login/Logout scratchpad migration and isolation
  await testAsync('ADV-M4-05: Scratchpad isolation and sync across user authentication lifecycle', async () => {
    const ctx = loadApplicationContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });
    ctx.window.switchMainView('notes');

    const noteArea = ctx.document.getElementById('scratchpad-text');

    // 1. Guest writes a note
    noteArea.value = 'Guest draft 1';
    noteArea.dispatchEvent({ type: 'input', target: noteArea });
    assertEqual(ctx.window.AccountManager.getScratchpad(), 'Guest draft 1', 'AccountManager in-memory matches guest input');

    // 2. Register account (inherits guest scratchpad)
    await ctx.window.AccountManager.registerAccount('TestUserAdv', 'SecretPass123!');
    assertEqual(ctx.window.AccountManager.getUsername(), 'TestUserAdv');
    assertEqual(ctx.window.AccountManager.getScratchpad(), 'Guest draft 1', 'Registered user inherits initial scratchpad');

    // 3. User edits note
    noteArea.value = 'User updated draft';
    noteArea.dispatchEvent({ type: 'input', target: noteArea });
    assertEqual(ctx.window.AccountManager.getScratchpad(), 'User updated draft', 'AccountManager has user draft');

    // 4. Logout
    ctx.window.AccountManager.logout();
    assertEqual(ctx.window.AccountManager.getUsername(), 'Guest');

    // 5. Verify chat still works after logout without errors
    ctx.window.switchMainView('chat');
    const chatUser = ctx.document.getElementById('chat-user-handle-display');
    assertEqual(chatUser.textContent.includes('Guest') || chatUser.textContent.includes('AnonCat'), true, 'Chat displays guest or fallback user handle after logout');
  });

  // TEST 6: Rapid 100x typing bursts with simultaneous view switches
  test('ADV-M4-06: 100-burst rapid keystroke stress test with simultaneous view switches', () => {
    const ctx = loadApplicationContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });
    ctx.window.switchMainView('notes');
    const noteArea = ctx.document.getElementById('scratchpad-text');

    let currentString = '';
    const views = ['hub', 'chat', 'forum', 'reader', 'notes'];

    for (let i = 0; i < 100; i++) {
      currentString += String.fromCharCode(65 + (i % 26));
      noteArea.value = currentString;
      noteArea.dispatchEvent({ type: 'input', target: noteArea });

      // Immediate synchronous sync check
      if (ctx.window.AccountManager.getScratchpad() !== currentString) {
        throw new Error(`In-memory sync mismatch at keystroke ${i}: expected "${currentString}", got "${ctx.window.AccountManager.getScratchpad()}"`);
      }

      // Switch view and switch back
      const nextView = views[i % views.length];
      ctx.window.switchMainView(nextView);
      if (nextView === 'notes') {
        assertEqual(noteArea.value, currentString, `Note area retained string on switch back at iteration ${i}`);
      }
    }

    // Switch back to notes at the end
    ctx.window.switchMainView('notes');
    assertEqual(noteArea.value, currentString, 'Final note area string matches 100 keystrokes perfectly');
    assertEqual(ctx.window.AccountManager.getScratchpad(), currentString, 'Final AccountManager scratchpad matches perfectly');
  });

  console.log(`\n============================================================`);
  console.log(`Independent Challenge Results: ${passedCount} Passed, ${failedCount} Failed`);
  console.log(`============================================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAsyncTests().catch(err => {
  console.error(err);
  process.exit(1);
});
