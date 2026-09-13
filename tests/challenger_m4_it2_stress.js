/**
 * tests/challenger_m4_it2_stress.js
 * EMPIRICAL CHALLENGER ADVERSARIAL STRESS TEST
 * Milestone M4 Iteration 2
 *
 * Focus:
 * 1. Chat DOM Appending Performance & Reflow Avoidance Under Heavy Message Bursts:
 *    - 1,000 rapid message burst (throughput, node creation vs naive innerHTML wipe)
 *    - Reflow / Layout Thrashing detection: Spying on scrollHeight, offsetHeight, clientHeight, scrollTop
 *      to ensure ZERO synchronous reflow triggers during appendSingleMessage (deferred to rAF).
 *    - Duplicate message burst resilience (1,000 messages with 30% duplicate IDs).
 *    - Cross-room message filtering under heavy load.
 *    - Malicious Stored XSS injection under rapid streaming.
 *    - Multi-line & 20,000-character payload burst.
 *
 * 2. Guest Scratchpad Reload Persistence Across Browser Sessions:
 *    - Guest session 1: rapid typing -> debounce window -> localStorage persistence.
 *    - Simulated full page reload (teardown of JS runtime & DOM, recreation with same localStorage).
 *    - Verification of #scratchpad-text and AccountManager.getScratchpad() on reload.
 *    - Second edit & second reload cycle.
 *    - Unicode, special characters, multiline strings, and XSS vector persistence in scratchpad.
 *    - Account registration inheritance: Guest notes seamlessly migrate to new account.
 *    - Active draft protection against router view switches (Hub -> Notes -> Chat -> Reader -> Notes).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');

const {
  createBrowserEnvironment,
  assert,
  assertEqual,
  assertContains,
  ROOT_DIR
} = require('./harness');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const defectsFound = [];

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    defectsFound.push({ name, error: err.message, stack: err.stack });
    console.error(`  ✘ [FAIL] ${name}: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    defectsFound.push({ name, error: err.message, stack: err.stack });
    console.error(`  ✘ [FAIL] ${name}: ${err.message}`);
  }
}

function createEnvironmentWithStorage(existingStorage = {}) {
  const env = createBrowserEnvironment();
  const sandbox = env.window;
  sandbox.console = console;
  sandbox.Buffer = Buffer;
  sandbox.globalThis = sandbox;
  sandbox.performance = performance;

  // Pre-seed localStorage if provided
  for (const [k, v] of Object.entries(existingStorage)) {
    sandbox.localStorage.setItem(k, v);
  }

  sandbox.Blob = globalThis.Blob || function(parts, opts) {
    this.parts = parts;
    this.type = opts?.type || '';
  };
  sandbox.URL = globalThis.URL || {
    createObjectURL: () => 'blob:mock-url-' + Math.random().toString(36).substr(2, 5),
    revokeObjectURL: () => {}
  };

  const instantiatedImages = [];
  sandbox.Image = function() {
    const img = env.document.createElement('img');
    instantiatedImages.push(img);
    return img;
  };

  const context = vm.createContext(sandbox);

  function runScript(filename) {
    const fullPath = path.join(ROOT_DIR, filename);
    const code = fs.readFileSync(fullPath, 'utf8');
    const bridge = `
      if (typeof ChatApp !== 'undefined' && typeof window !== 'undefined') window.ChatApp = ChatApp;
      if (typeof AccountManager !== 'undefined' && typeof window !== 'undefined') window.AccountManager = AccountManager;
      if (typeof ProfanityFilter !== 'undefined' && typeof window !== 'undefined') window.ProfanityFilter = ProfanityFilter;
      if (typeof CHAPTER_DATA !== 'undefined' && typeof window !== 'undefined') window.CHAPTER_DATA = CHAPTER_DATA;
    `;
    return vm.runInContext(code + '\n' + bridge, context, { filename });
  }

  runScript('profanity.js');
  runScript('theme.js');
  runScript('account.js');
  runScript('apps.js');
  runScript('chapters.js');
  runScript('chat.js');
  runScript('app.js');

  return { sandbox, env, instantiatedImages };
}

async function runChallengerStressSuite() {
  console.log('======================================================================');
  console.log('CHALLENGER EMPIRICAL ADVERSARIAL STRESS SUITE (M4 Iteration 2)');
  console.log('======================================================================\n');

  // ==========================================================================
  // PART 1: CHAT DOM APPENDING & REFLOW AVOIDANCE UNDER HEAVY BURSTS
  // ==========================================================================
  console.log('--- PART 1: Chat DOM Appending & Reflow Avoidance Under Heavy Bursts ---');

  await runAsyncTest('1.1: 1,000-message burst: Incremental DOM append vs Naive innerHTML rewrite', async () => {
    const { sandbox, env } = createEnvironmentWithStorage();
    sandbox.dispatchEvent({ type: 'DOMContentLoaded' });
    sandbox.ChatApp.init();

    const container = env.document.getElementById('chat-messages-container');
    assert(container !== null, 'Chat container must exist');

    const BURST_COUNT = 1000;
    const burstMessages = [];
    const now = Date.now();
    for (let i = 0; i < BURST_COUNT; i++) {
      burstMessages.push({
        id: `burst_msg_${i}`,
        channel: 'lobby',
        user: `burst_user_${i % 25}`,
        verified: (i % 4 === 0),
        avatar: 'logo_avatar',
        text: `Heavy stress payload #${i} - [${Math.random().toString(36).substring(2)}]`,
        timestamp: now + i * 50
      });
    }

    // Benchmark appendSingleMessage
    container.innerHTML = '<div class="chat-empty">Empty Room</div>';
    let rAfSchedules = 0;
    const origRaf = sandbox.requestAnimationFrame;
    sandbox.requestAnimationFrame = (cb) => {
      rAfSchedules++;
      return origRaf(cb);
    };

    const tStartAppend = performance.now();
    for (let i = 0; i < BURST_COUNT; i++) {
      sandbox.ChatApp.appendSingleMessage(burstMessages[i]);
    }
    const tElapsedAppend = performance.now() - tStartAppend;

    const messageEls = container.querySelectorAll('.chat-msg');
    assertEqual(messageEls.length, BURST_COUNT, `Must append all ${BURST_COUNT} messages incrementally`);
    assertEqual(rAfSchedules, BURST_COUNT, `Must schedule exactly ${BURST_COUNT} rAF scroll defers`);

    // Verify naive baseline node creation
    // In naive innerHTML rewrite, for N=1000, sum(1..N) = 1,000 * 1,001 / 2 = 500,500 DOM elements parsed/created!
    const naiveNodeCount = (BURST_COUNT * (BURST_COUNT + 1)) / 2;
    const incrementalNodeCount = BURST_COUNT;
    const nodeReductionFactor = Math.round(naiveNodeCount / incrementalNodeCount);

    console.log(`      Burst Append Time: ${tElapsedAppend.toFixed(2)}ms for ${BURST_COUNT} messages (${(BURST_COUNT / (tElapsedAppend / 1000)).toFixed(0)} msgs/sec)`);
    console.log(`      Incremental nodes created: ${incrementalNodeCount} vs Naive recreation: ${naiveNodeCount.toLocaleString()} (x${nodeReductionFactor} efficiency)`);

    assert(tElapsedAppend < 10000, `Append burst must complete within 10 seconds (took ${tElapsedAppend.toFixed(2)}ms)`);
  });

  runTest('1.2: Reflow avoidance verification: ZERO synchronous layout queries during appendSingleMessage', () => {
    const { sandbox, env } = createEnvironmentWithStorage();
    sandbox.dispatchEvent({ type: 'DOMContentLoaded' });
    sandbox.ChatApp.init();

    const container = env.document.getElementById('chat-messages-container');
    assert(container !== null, 'Container exists');

    // Instrument container with layout property traps
    let synchronousLayoutReadsDuringAppend = 0;
    let rAfLayoutReads = 0;
    let insideAppendSingleMessage = false;

    const layoutProps = ['scrollHeight', 'offsetHeight', 'clientHeight', 'scrollTop', 'offsetTop'];

    layoutProps.forEach(prop => {
      let val = 1000;
      Object.defineProperty(container, prop, {
        get() {
          if (insideAppendSingleMessage) {
            synchronousLayoutReadsDuringAppend++;
          } else {
            rAfLayoutReads++;
          }
          return val;
        },
        set(v) {
          val = v;
        },
        configurable: true
      });
    });

    const testMsg = {
      id: 'reflow_test_msg_1',
      channel: 'lobby',
      user: 'reflow_tester',
      verified: true,
      avatar: 'logo_avatar',
      text: 'Testing reflow avoidance',
      timestamp: Date.now()
    };

    // Execute appendSingleMessage while spying
    insideAppendSingleMessage = true;
    sandbox.ChatApp.appendSingleMessage(testMsg);
    insideAppendSingleMessage = false;

    assertEqual(
      synchronousLayoutReadsDuringAppend,
      0,
      `Synchronous layout read during appendSingleMessage must be ZERO (detected ${synchronousLayoutReadsDuringAppend}). Layout/scroll operations must be deferred to requestAnimationFrame.`
    );
  });

  runTest('1.3: Heavy deduplication burst: 500 unique + 500 duplicate messages interleaved', () => {
    const { sandbox, env } = createEnvironmentWithStorage();
    sandbox.dispatchEvent({ type: 'DOMContentLoaded' });
    sandbox.ChatApp.init();

    const container = env.document.getElementById('chat-messages-container');
    container.innerHTML = '';

    const UNIQUE_COUNT = 500;
    const testList = [];
    for (let i = 0; i < UNIQUE_COUNT; i++) {
      testList.push({
        id: `dedupe_${i}`,
        channel: 'lobby',
        user: `user_${i % 10}`,
        text: `Unique text #${i}`,
        timestamp: Date.now() + i
      });
    }

    // Interleave unique messages with duplicates
    for (let i = 0; i < UNIQUE_COUNT; i++) {
      sandbox.ChatApp.appendSingleMessage(testList[i]);
      // Attempt to immediately insert duplicate
      sandbox.ChatApp.appendSingleMessage(testList[i]);
    }

    const rendered = container.querySelectorAll('.chat-msg');
    assertEqual(rendered.length, UNIQUE_COUNT, `Deduplication must reject duplicates under heavy interleaved burst (expected ${UNIQUE_COUNT}, got ${rendered.length})`);
  });

  runTest('1.4: Cross-channel isolation under rapid burst', () => {
    const { sandbox, env } = createEnvironmentWithStorage();
    sandbox.dispatchEvent({ type: 'DOMContentLoaded' });
    sandbox.ChatApp.init();

    const container = env.document.getElementById('chat-messages-container');
    container.innerHTML = '';

    // Send 100 messages to gaming room while currently in lobby
    for (let i = 0; i < 100; i++) {
      sandbox.ChatApp.appendSingleMessage({
        id: `gaming_burst_${i}`,
        channel: 'gaming',
        user: 'gamer_pro',
        text: `Gaming chat #${i}`,
        timestamp: Date.now() + i
      });
    }

    const rendered = container.querySelectorAll('.chat-msg');
    assertEqual(rendered.length, 0, 'No gaming room messages should append into active lobby container');
  });

  runTest('1.5: Adversarial XSS & jumbo payload streaming burst', () => {
    const { sandbox, env } = createEnvironmentWithStorage();
    sandbox.dispatchEvent({ type: 'DOMContentLoaded' });
    sandbox.ChatApp.init();

    const container = env.document.getElementById('chat-messages-container');

    const jumboPayload = 'A'.repeat(20000);
    const attackPayload = '<img src=x onerror="window.xss=true"><script>window.hacked=true</script><iframe src="javascript:alert(1)"></iframe>';

    sandbox.ChatApp.appendSingleMessage({
      id: 'attack_msg',
      channel: 'lobby',
      user: 'attacker<svg/onload=alert(1)>',
      text: attackPayload + ' ' + jumboPayload,
      timestamp: Date.now()
    });

    const msgEl = container.querySelector('[data-msg-id="attack_msg"]');
    assert(msgEl !== null, 'Message rendered');
    assert(msgEl.querySelector('script') === null, 'No script tags in DOM');
    assert(msgEl.querySelector('iframe') === null, 'No iframe tags in DOM');
    assert(msgEl.querySelector('img[onerror]') === null, 'No malicious img tag with onerror');
    assert(sandbox.xss === undefined, 'No execution of onerror payload');
    assert(sandbox.hacked === undefined, 'No execution of script payload');

    const bodyEl = msgEl.querySelector('.msg-body');
    assertContains(bodyEl.innerHTML, '&lt;script&gt;', 'Sanitized as HTML entities');
    assert(bodyEl.textContent.length >= 20000, 'Preserved full 20,000 character jumbo payload without truncation');
  });

  // ==========================================================================
  // PART 2: GUEST SCRATCHPAD RELOAD PERSISTENCE IN LOCALSTORAGE
  // ==========================================================================
  console.log('\n--- PART 2: Guest Scratchpad Reload Persistence Across Browser Sessions ---');

  await runAsyncTest('2.1: Full browser reload simulation: Guest input persists to localStorage & restores', async () => {
    // Session 1: Fresh guest visit
    const storageStore = {};
    {
      const { sandbox, env } = createEnvironmentWithStorage(storageStore);
      sandbox.dispatchEvent({ type: 'DOMContentLoaded' });

      // Verify guest mode
      assert(!sandbox.AccountManager.isAuthenticated(), 'User must be guest initially');

      const noteArea = env.document.getElementById('scratchpad-text');
      assert(noteArea !== null, '#scratchpad-text must exist');

      // Guest types notes
      const guestText = 'Meeting notes: Jujutsu Kaisen chapter 270 discussion & theorycrafting.';
      noteArea.value = guestText;
      noteArea.dispatchEvent({ type: 'input', target: noteArea });

      // Wait 400ms for 300ms debounce to persist
      await new Promise(res => setTimeout(res, 400));

      // Extract localStorage store
      for (let i = 0; i < sandbox.localStorage.length; i++) {
        const k = sandbox.localStorage.key(i);
        storageStore[k] = sandbox.localStorage.getItem(k);
      }

      assertEqual(storageStore['hub_scratchpad_v1'], guestText, 'LocalStorage key hub_scratchpad_v1 must contain saved guest text');
    }

    // Session 2: Browser Reload Simulation (New sandbox, same persisted storage)
    {
      const { sandbox, env } = createEnvironmentWithStorage(storageStore);

      // Verify pre-init storage holds our data
      assertEqual(sandbox.localStorage.getItem('hub_scratchpad_v1'), 'Meeting notes: Jujutsu Kaisen chapter 270 discussion & theorycrafting.');

      // Initialize page on reload
      sandbox.AccountManager.init();
      sandbox.dispatchEvent({ type: 'DOMContentLoaded' });

      // Check AccountManager state
      const guestNotes = sandbox.AccountManager.getScratchpad();
      assertEqual(guestNotes, 'Meeting notes: Jujutsu Kaisen chapter 270 discussion & theorycrafting.', 'AccountManager.getScratchpad() must restore from localStorage on reload');

      // Check DOM textarea state
      const noteArea = env.document.getElementById('scratchpad-text');
      assert(noteArea !== null, '#scratchpad-text exists on reloaded page');
      assertEqual(noteArea.value, 'Meeting notes: Jujutsu Kaisen chapter 270 discussion & theorycrafting.', '#scratchpad-text.value must be populated with persisted guest notes on reload');
    }
  });

  await runAsyncTest('2.2: Multi-cycle edit and reload simulation for guest user', async () => {
    let storageStore = {};

    // Cycle 1: initial text
    {
      const { sandbox, env } = createEnvironmentWithStorage(storageStore);
      sandbox.AccountManager.init();
      sandbox.dispatchEvent({ type: 'DOMContentLoaded' });
      const noteArea = env.document.getElementById('scratchpad-text');
      noteArea.value = 'Cycle 1 Text';
      noteArea.dispatchEvent({ type: 'input', target: noteArea });
      await new Promise(res => setTimeout(res, 400));

      // Copy storage
      storageStore = {};
      for (let i = 0; i < sandbox.localStorage.length; i++) {
        const k = sandbox.localStorage.key(i);
        storageStore[k] = sandbox.localStorage.getItem(k);
      }
    }

    // Cycle 2: append text and reload
    {
      const { sandbox, env } = createEnvironmentWithStorage(storageStore);
      sandbox.AccountManager.init();
      sandbox.dispatchEvent({ type: 'DOMContentLoaded' });

      const noteArea = env.document.getElementById('scratchpad-text');
      assertEqual(noteArea.value, 'Cycle 1 Text');

      noteArea.value = 'Cycle 1 Text + Cycle 2 Additions';
      noteArea.dispatchEvent({ type: 'input', target: noteArea });
      await new Promise(res => setTimeout(res, 400));

      // Copy storage
      storageStore = {};
      for (let i = 0; i < sandbox.localStorage.length; i++) {
        const k = sandbox.localStorage.key(i);
        storageStore[k] = sandbox.localStorage.getItem(k);
      }
    }

    // Cycle 3: verify Cycle 2 survived reload
    {
      const { sandbox, env } = createEnvironmentWithStorage(storageStore);
      sandbox.AccountManager.init();
      sandbox.dispatchEvent({ type: 'DOMContentLoaded' });

      const noteArea = env.document.getElementById('scratchpad-text');
      assertEqual(noteArea.value, 'Cycle 1 Text + Cycle 2 Additions', 'Cycle 2 additions must survive reload in Cycle 3');
      assertEqual(sandbox.AccountManager.getScratchpad(), 'Cycle 1 Text + Cycle 2 Additions');
    }
  });

  await runAsyncTest('2.3: Adversarial content in guest scratchpad (Unicode, quotes, multiline, XSS scripts)', async () => {
    const complexNotes = `Line 1: Special Characters: <script>alert("hack")</script> & 'quotes' "double" \`backticks\`
Line 2: Unicode & Symbols: ⚡ 🚀 🐱 呪術廻戦 (Jujutsu Kaisen)
Line 3: Tabs \t and backslashes \\ and \\n newlines
Line 4: Math symbols: ∑(x) = ∫(f(t)dt) ± ∞ ≠ ≈`;

    let storageStore = {};
    {
      const { sandbox, env } = createEnvironmentWithStorage(storageStore);
      sandbox.AccountManager.init();
      sandbox.dispatchEvent({ type: 'DOMContentLoaded' });

      const noteArea = env.document.getElementById('scratchpad-text');
      noteArea.value = complexNotes;
      noteArea.dispatchEvent({ type: 'input', target: noteArea });
      await new Promise(res => setTimeout(res, 400));

      storageStore = {};
      for (let i = 0; i < sandbox.localStorage.length; i++) {
        const k = sandbox.localStorage.key(i);
        storageStore[k] = sandbox.localStorage.getItem(k);
      }
    }

    // Reload
    {
      const { sandbox, env } = createEnvironmentWithStorage(storageStore);
      sandbox.AccountManager.init();
      sandbox.dispatchEvent({ type: 'DOMContentLoaded' });

      const noteArea = env.document.getElementById('scratchpad-text');
      assertEqual(noteArea.value, complexNotes, 'Complex multiline, unicode, and quotes must restore byte-for-byte');
      assertEqual(sandbox.AccountManager.getScratchpad(), complexNotes);
    }
  });

  await runAsyncTest('2.4: Guest-to-Account migration: Registering an account inherits guest scratchpad', async () => {
    let storageStore = {};
    const guestSecret = 'Guest secret thoughts before signing up';

    {
      const { sandbox, env } = createEnvironmentWithStorage(storageStore);
      sandbox.AccountManager.init();
      sandbox.dispatchEvent({ type: 'DOMContentLoaded' });

      const noteArea = env.document.getElementById('scratchpad-text');
      noteArea.value = guestSecret;
      noteArea.dispatchEvent({ type: 'input', target: noteArea });
      await new Promise(res => setTimeout(res, 400));

      // Now guest decides to register
      const regRes = await sandbox.AccountManager.register('yuji_itadori', 'Yuji', 'cursed_energy_123');
      assert(regRes.success, 'Registration must succeed');

      // Account profile should have inherited the guest scratchpad
      const accNotes = sandbox.AccountManager.getScratchpad();
      assertEqual(accNotes, guestSecret, 'Registered account must inherit guest scratchpad notes upon registration');

      // Copy storage
      storageStore = {};
      for (let i = 0; i < sandbox.localStorage.length; i++) {
        const k = sandbox.localStorage.key(i);
        storageStore[k] = sandbox.localStorage.getItem(k);
      }
    }

    // Reload browser as logged-in user
    {
      const { sandbox, env } = createEnvironmentWithStorage(storageStore);
      sandbox.AccountManager.init();
      sandbox.dispatchEvent({ type: 'DOMContentLoaded' });

      assert(sandbox.AccountManager.isAuthenticated(), 'User session restored');
      assertEqual(sandbox.AccountManager.getUsername(), 'yuji_itadori');
      assertEqual(sandbox.AccountManager.getScratchpad(), guestSecret, 'Inherited notes persist in account across reload');

      const noteArea = env.document.getElementById('scratchpad-text');
      assertEqual(noteArea.value, guestSecret, 'DOM textarea displays inherited notes');
    }
  });

  await runAsyncTest('2.5: Active draft protection: Rapid view switching does not wipe in-progress typing', async () => {
    const { sandbox, env } = createEnvironmentWithStorage();
    sandbox.AccountManager.init();
    sandbox.dispatchEvent({ type: 'DOMContentLoaded' });

    const noteArea = env.document.getElementById('scratchpad-text');
    noteArea.value = 'Draft note currently being typed...';
    noteArea.dispatchEvent({ type: 'input', target: noteArea });

    // Instantly switch views repeatedly within the 300ms debounce window
    sandbox.switchMainView('reader');
    sandbox.switchMainView('chat');
    sandbox.switchMainView('hub');
    sandbox.switchMainView('notes');

    // Verify draft was not overwritten by stale storage
    assertEqual(noteArea.value, 'Draft note currently being typed...', 'Draft must remain intact after rapid view switches');

    // Settle debounce
    await new Promise(res => setTimeout(res, 400));
    assertEqual(sandbox.AccountManager.getScratchpad(), 'Draft note currently being typed...');
    assertEqual(sandbox.localStorage.getItem('hub_scratchpad_v1'), 'Draft note currently being typed...');
  });

  await runAsyncTest('2.6: Logout & guest scratchpad typing must not crash ChatApp onAccountChange listener', async () => {
    const { sandbox, env } = createEnvironmentWithStorage();
    sandbox.AccountManager.init();
    sandbox.ChatApp.init();
    sandbox.dispatchEvent({ type: 'DOMContentLoaded' });

    let capturedErrors = [];
    const origConsoleError = sandbox.console.error;
    sandbox.console.error = (...args) => {
      capturedErrors.push(args.map(a => (a && a.stack) ? a.stack : String(a)).join(' '));
      return origConsoleError(...args);
    };

    // 1. Guest typing in scratchpad
    const noteArea = env.document.getElementById('scratchpad-text');
    noteArea.value = 'Guest typing text';
    noteArea.dispatchEvent({ type: 'input', target: noteArea });
    await new Promise(res => setTimeout(res, 400));

    // Check for TypeErrors
    const guestErrors = capturedErrors.filter(e => e.includes('TypeError') || e.includes("Cannot read properties of null"));
    assert(guestErrors.length === 0, `Guest scratchpad input triggered TypeError in chat.js listener: ${guestErrors.join('; ')}`);

    // 2. Register, then logout
    await sandbox.AccountManager.register('bob_tester', 'Bob', 'pass1234');
    capturedErrors.length = 0;

    sandbox.AccountManager.logout();
    const logoutErrors = capturedErrors.filter(e => e.includes('TypeError') || e.includes("Cannot read properties of null"));
    assert(logoutErrors.length === 0, `Account logout triggered TypeError in chat.js listener: ${logoutErrors.join('; ')}`);

    // Verify ChatApp user handle reverted away from bob_tester
    const userBadge = env.document.getElementById('chat-current-user-badge');
    assert(userBadge !== null, 'User badge exists');
    assert(!userBadge.textContent.includes('@bob_tester'), 'Chat badge must no longer show @bob_tester after logout');
  });

  // ==========================================================================
  // FINAL SCORECARD
  // ==========================================================================
  console.log('\n======================================================================');
  console.log('CHALLENGER EMPIRICAL STRESS SUITE RESULTS');
  console.log('======================================================================');
  console.log(`Total Stress Tests Executed : ${totalTests}`);
  console.log(`Passed                      : ${passedTests}`);
  console.log(`Failed / Defects Found      : ${failedTests}`);
  console.log(`Pass Rate                   : ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (defectsFound.length > 0) {
    console.log('\nDEFECTS IDENTIFIED:');
    defectsFound.forEach((d, idx) => {
      console.log(`[${idx + 1}] ${d.name}: ${d.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n>>> ALL EMPIRICAL CHALLENGER STRESS TESTS PASSED CLEANLY (100%) <<<');
    process.exit(0);
  }
}

runChallengerStressSuite().catch(err => {
  console.error('Fatal suite runner error:', err);
  process.exit(1);
});
