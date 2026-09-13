/**
 * tests/m4_adversarial_suite.js
 * Adversarial Benchmark & Stress Testing Suite for Milestone M4
 * 
 * Verifies:
 * 1. Chat DOM appending benchmark (500 rapid messages) vs innerHTML wipe, layout thrashing, deduplication, O(N) query overhead, edge cases.
 * 2. Scratchpad rapid input stress test (50 rapid keystrokes), debounce coalescing, write counts, data integrity, view switch race conditions, guest persistence defect.
 * 3. Image loading attributes (decoding="async", referrerpolicy="no-referrer", loading="lazy") and preload link generation vs new Image().
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

// Helper to create an isolated sandbox for testing
function createTestContext(options = {}) {
  const env = createBrowserEnvironment();
  const sandbox = env.window;
  sandbox.console = console;
  sandbox.Buffer = Buffer;
  sandbox.globalThis = sandbox;
  sandbox.performance = performance;

  // Polyfill Blob and URL
  sandbox.Blob = globalThis.Blob || function(parts, opts) {
    this.parts = parts;
    this.type = opts?.type || '';
  };
  sandbox.URL = globalThis.URL || {
    createObjectURL: () => 'blob:mock-url-' + Math.random().toString(36).substr(2, 5),
    revokeObjectURL: () => {}
  };

  // Polyfill Image with telemetry
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
  if (options.includeAccountManager !== false) {
    runScript('account.js');
  }
  runScript('apps.js');
  runScript('chapters.js');
  runScript('chat.js');
  runScript('app.js');

  return { sandbox, env, instantiatedImages, runScript };
}

async function runAdversarialSuite() {
  console.log('================================================================');
  console.log('  MILESTONE M4 EMPIRICAL ADVERSARIAL BENCHMARK & STRESS SUITE   ');
  console.log('================================================================\n');

  const report = {
    chatBenchmark: null,
    scratchpadStress: null,
    imageLoading: null,
    findings: []
  };

  // ==========================================================================
  // SECTION 1: CHAT DOM APPENDING BENCHMARK (500 RAPID MESSAGES)
  // ==========================================================================
  console.log('--- SECTION 1: Chat DOM Appending vs innerHTML Benchmark ---');
  try {
    const { sandbox, env } = createTestContext();
    sandbox.dispatchEvent({ type: 'DOMContentLoaded' });
    sandbox.ChatApp.init();

    const container = env.document.getElementById('chat-messages-container');
    assert(container !== null, 'Chat messages container must exist');

    // Generate 500 distinct synthetic messages
    const NUM_MESSAGES = 500;
    const testMessages = [];
    const baseTime = Date.now() - 100000;
    for (let i = 0; i < NUM_MESSAGES; i++) {
      testMessages.push({
        id: `bench_msg_${i}`,
        channel: 'lobby',
        user: `tester_${i % 15}`,
        verified: (i % 3 === 0),
        avatar: 'logo_avatar',
        text: `Benchmarking message payload number #${i} - payload: [${Math.random().toString(36).substring(2)}]`,
        timestamp: baseTime + (i * 200)
      });
    }

    // Benchmark 1A: M4 Incremental appendSingleMessage (500 messages)
    container.innerHTML = '<div class="chat-empty">Empty Room</div>';
    let rafCalls = 0;
    const originalRaf = sandbox.requestAnimationFrame;
    sandbox.requestAnimationFrame = (cb) => {
      rafCalls++;
      return originalRaf(cb);
    };

    const tStartAppend = performance.now();
    for (let i = 0; i < NUM_MESSAGES; i++) {
      sandbox.ChatApp.appendSingleMessage(testMessages[i]);
    }
    const tElapsedAppend = performance.now() - tStartAppend;

    // Verify DOM state after appendSingleMessage
    assert(container.querySelector('.chat-empty') === null, 'Empty room placeholder must be removed');
    const appendedMsgNodes = container.querySelectorAll('.chat-msg');
    assertEqual(appendedMsgNodes.length, NUM_MESSAGES, `Container must have exactly ${NUM_MESSAGES} message nodes`);
    assertEqual(rafCalls, NUM_MESSAGES, `Each message append should schedule scroll via rAF (called ${rafCalls} times)`);

    // Verify first and last message content integrity
    const firstMsg = container.firstElementChild;
    assertEqual(firstMsg.getAttribute('data-msg-id'), 'bench_msg_0', 'First message ID match');
    assertContains(firstMsg.querySelector('.msg-body').textContent, 'Benchmarking message payload number #0', 'First message body match');

    const lastMsg = container.lastElementChild;
    assertEqual(lastMsg.getAttribute('data-msg-id'), `bench_msg_${NUM_MESSAGES - 1}`, 'Last message ID match');
    assertContains(lastMsg.querySelector('.msg-body').textContent, `Benchmarking message payload number #${NUM_MESSAGES - 1}`, 'Last message body match');

    // Benchmark 1B: Naive innerHTML wipe (Simulating pre-M4 baseline)
    container.innerHTML = '<div class="chat-empty">Empty Room</div>';
    let synchronousReflowQueries = 0;
    let totalNodesParsedOrCreatedNaive = 0;

    const tStartNaive = performance.now();
    for (let i = 1; i <= NUM_MESSAGES; i++) {
      const slice = testMessages.slice(0, i);
      totalNodesParsedOrCreatedNaive += slice.length;
      container.innerHTML = slice.map(m => `
        <div class="chat-msg" data-msg-id="${m.id}">
          <div class="msg-header">
            <span class="msg-user">@${m.user}</span>
            <span class="msg-time">12:00</span>
          </div>
          <div class="msg-body">${m.text}</div>
        </div>
      `).join('');
      container.scrollTop = container.scrollHeight;
      synchronousReflowQueries++;
    }
    const tElapsedNaive = performance.now() - tStartNaive;

    report.chatBenchmark = {
      messageCount: NUM_MESSAGES,
      incrementalAppendMs: Number(tElapsedAppend.toFixed(2)),
      naiveInnerHtmlWipeMs: Number(tElapsedNaive.toFixed(2)),
      nodesCreatedIncremental: NUM_MESSAGES,
      nodesCreatedOrParsedNaive: totalNodesParsedOrCreatedNaive,
      synchronousLayoutReflowsNaive: synchronousReflowQueries,
      rAfDeferredScrollsIncremental: rafCalls
    };

    console.log(`[PASS] 500-Message Benchmark:`);
    console.log(`       - Incremental appendSingleMessage : ${tElapsedAppend.toFixed(2)} ms (${NUM_MESSAGES} nodes created, 0 innerHTML wipes)`);
    console.log(`       - Naive innerHTML wipe baseline   : ${tElapsedNaive.toFixed(2)} ms (${totalNodesParsedOrCreatedNaive.toLocaleString()} nodes recreated, ${synchronousReflowQueries} forced synchronous reflows)`);

    // Edge Cases:
    // 1. Deduplication
    const countBeforeDupe = container.querySelectorAll('.chat-msg').length;
    sandbox.ChatApp.appendSingleMessage(testMessages[0]);
    const countAfterDupe = container.querySelectorAll('.chat-msg').length;
    assertEqual(countAfterDupe, countBeforeDupe, 'Duplicate message ID must not create duplicate DOM element');
    console.log('[PASS] Deduplication: duplicate message ID rejected without DOM mutation');

    // 2. Channel Filtering
    const foreignMsg = {
      id: 'foreign_1',
      channel: 'other_secret_room',
      user: 'stranger',
      text: 'Secret payload',
      timestamp: Date.now()
    };
    sandbox.ChatApp.appendSingleMessage(foreignMsg);
    assert(container.querySelector('[data-msg-id="foreign_1"]') === null, 'Message for foreign channel must not append to active room');
    console.log('[PASS] Channel Filtering: foreign room message ignored');

    // 3. XSS Tag Escaping
    const xssMsg = {
      id: 'xss_msg',
      channel: 'lobby',
      user: 'hacker<script>',
      text: '<script>window.pwned=true;</script><img src="x" onerror="window.pwned=true;"><b>injected</b>',
      timestamp: Date.now()
    };
    sandbox.ChatApp.appendSingleMessage(xssMsg);
    const xssEl = container.querySelector('[data-msg-id="xss_msg"]');
    assert(xssEl !== null, 'XSS test message rendered');
    assert(xssEl.querySelector('script') === null, 'No raw <script> element must exist in message DOM');
    assert(xssEl.querySelector('img.account-avatar-mini') !== null, 'Avatar image is permitted');
    assert(xssEl.querySelector('img[src="x"]') === null, 'Injected <img> tag must not exist in message DOM');
    assertContains(xssEl.querySelector('.msg-body').innerHTML, '&lt;script&gt;', 'XSS tags properly escaped as HTML entities');
    console.log('[PASS] Sanitization: script & image tags escaped without DOM execution');

  } catch (err) {
    console.error(`[FAIL] Section 1 Error: ${err.message}`);
    report.findings.push({ section: 'Chat DOM Benchmark', error: err.message, stack: err.stack });
  }

  // ==========================================================================
  // SECTION 2: SCRATCHPAD RAPID INPUT & DEBOUNCE STRESS TEST
  // ==========================================================================
  console.log('\n--- SECTION 2: Scratchpad Rapid Input & Debounce Stress Test ---');

  // Test 2.1: Standalone / Fallback Mode (Without AccountManager or Direct LocalStorage)
  console.log('  [2.1] Fallback Mode (Direct localStorage):');
  try {
    const { sandbox, env } = createTestContext({ includeAccountManager: false });
    sandbox.dispatchEvent({ type: 'DOMContentLoaded' });

    const noteArea = env.document.getElementById('scratchpad-text');
    assert(noteArea !== null, 'Scratchpad textarea #scratchpad-text must exist');

    const storageWrites = [];
    const origSetItem = sandbox.localStorage.setItem.bind(sandbox.localStorage);
    sandbox.localStorage.setItem = (key, val) => {
      storageWrites.push({ time: performance.now(), key, val });
      return origSetItem(key, val);
    };

    // 50 Rapid Keystrokes (10ms interval = 500ms total typing duration)
    const targetText = 'StressTest: 50 rapid sequential keystrokes typed at 10ms speed!';
    const keystrokes = targetText.slice(0, 50).split('');
    assertEqual(keystrokes.length, 50, 'Exactly 50 keystrokes');

    let currentVal = '';
    for (let k = 0; k < keystrokes.length; k++) {
      currentVal += keystrokes[k];
      noteArea.value = currentVal;
      noteArea.dispatchEvent({ type: 'input', target: noteArea });
    }

    const writesDuringTyping = storageWrites.filter(w => w.key === 'hub_scratchpad_v1');
    assertEqual(writesDuringTyping.length, 0, `LocalStorage must NOT be thrashed during typing burst (expected 0 writes, got ${writesDuringTyping.length})`);
    console.log('[PASS] Scratchpad Debounce: 0 localStorage writes during 50-keystroke rapid burst (no thrashing)');

    // Wait 400ms (debounce delay is 300ms)
    await new Promise(resolve => setTimeout(resolve, 400));

    const writesAfterDebounce = storageWrites.filter(w => w.key === 'hub_scratchpad_v1');
    assertEqual(writesAfterDebounce.length, 1, `LocalStorage should receive EXACTLY 1 write after debounce period (got ${writesAfterDebounce.length})`);
    assertEqual(writesAfterDebounce[0].val, currentVal, 'Persisted text must EXACTLY match full 50-keystroke string without dropped characters');
    console.log(`[PASS] Scratchpad Integrity: 1 write executed with complete 50-char text: "${writesAfterDebounce[0].val}"`);

    // Paced Bursts (25 keystrokes -> 400ms pause -> 25 keystrokes -> 400ms pause)
    storageWrites.length = 0;
    const burst1Text = currentVal + ' + PartA';
    noteArea.value = burst1Text;
    noteArea.dispatchEvent({ type: 'input', target: noteArea });

    await new Promise(resolve => setTimeout(resolve, 400));
    assertEqual(storageWrites.length, 1, 'Burst 1 should produce exactly 1 write after 400ms');
    assertEqual(storageWrites[0].val, burst1Text, 'Burst 1 text preserved');

    const burst2Text = burst1Text + ' + PartB';
    noteArea.value = burst2Text;
    noteArea.dispatchEvent({ type: 'input', target: noteArea });

    await new Promise(resolve => setTimeout(resolve, 400));
    assertEqual(storageWrites.length, 2, 'Burst 2 should produce second write after 400ms');
    assertEqual(storageWrites[1].val, burst2Text, 'Burst 2 text preserved');
    console.log('[PASS] Paced Bursts: 2 distinct debounce writes recorded cleanly across pauses');

  } catch (err) {
    console.error(`[FAIL] Section 2.1 Error: ${err.message}`);
    report.findings.push({ section: 'Scratchpad Fallback Mode', error: err.message, stack: err.stack });
  }

  // Test 2.2: Authenticated AccountManager Mode
  console.log('\n  [2.2] Authenticated AccountManager Mode:');
  try {
    const { sandbox, env } = createTestContext({ includeAccountManager: true });
    // Register and login an account
    sandbox.dispatchEvent({ type: 'DOMContentLoaded' });
    
    // Create and login test user
    const acc = {
      id: 'acc_test_1',
      username: 'test_writer',
      displayName: 'Test Writer',
      passwordHash: 'hash',
      passwordSalt: 'salt',
      createdAt: Date.now(),
      scratchpad: ''
    };
    sandbox.localStorage.setItem('hub_accounts_v2', JSON.stringify([acc]));
    sandbox.localStorage.setItem('hub_active_account_id', 'acc_test_1');
    sandbox.localStorage.setItem('hub_active_session', 'true');
    sandbox.AccountManager.init();

    const noteArea = env.document.getElementById('scratchpad-text');
    assert(noteArea !== null, 'Scratchpad textarea must exist');

    const targetText = 'Authenticated note typed rapidly by registered user!';
    const keystrokes = targetText.split('');
    let cur = '';
    for (const ch of keystrokes) {
      cur += ch;
      noteArea.value = cur;
      noteArea.dispatchEvent({ type: 'input', target: noteArea });
    }

    assertEqual(sandbox.AccountManager.getScratchpad(), targetText, 'AccountManager scratchpad synchronously updated during typing');
    console.log('[PASS] Authenticated Scratchpad: synchronous in-memory update verified');

    await new Promise(resolve => setTimeout(resolve, 400));
    assertEqual(sandbox.AccountManager.getScratchpad(), targetText, 'AccountManager scratchpad contains full text after settling');
    console.log('[PASS] Authenticated Scratchpad: full text maintained in account profile');

  } catch (err) {
    console.error(`[FAIL] Section 2.2 Error: ${err.message}`);
    report.findings.push({ section: 'Scratchpad Authenticated Mode', error: err.message, stack: err.stack });
  }

  // Test 2.3: ADVERSARIAL CHALLENGE: Guest User Persistence & View Switch Race
  console.log('\n  [2.3] Adversarial Analysis: Guest User Persistence & View Switch Race:');
  try {
    const { sandbox, env } = createTestContext({ includeAccountManager: true });
    sandbox.dispatchEvent({ type: 'DOMContentLoaded' });
    const noteArea = env.document.getElementById('scratchpad-text');

    // 2.3.1 Guest user persistence test
    noteArea.value = 'Important notes written by guest user';
    noteArea.dispatchEvent({ type: 'input', target: noteArea });
    await new Promise(resolve => setTimeout(resolve, 400));

    // Check if guest notes were written to localStorage
    const savedLocalNotes = sandbox.localStorage.getItem('hub_scratchpad_v1');
    const guestAccountNotes = sandbox.AccountManager.getScratchpad();
    console.log(`       Guest note in AccountManager memory : "${guestAccountNotes}"`);
    console.log(`       Guest note in localStorage (hub_scratchpad_v1) : ${JSON.stringify(savedLocalNotes)}`);

    if (savedLocalNotes === null || savedLocalNotes === '') {
      console.warn(`[DEFECT CONFIRMED] Guest Scratchpad is NOT persisted to localStorage!`);
      console.warn(`       In app.js:83, when AccountManager is defined, it calls AccountManager.saveScratchpad().`);
      console.warn(`       In account.js:489, when not logged in, AccountManager saves only to in-memory guestData.scratchpad and does NOT write to localStorage!`);
      console.warn(`       Consequence: A guest user will LOSE their scratchpad notes upon page reload!`);
      report.findings.push({
        type: 'DEFECT',
        severity: 'MEDIUM',
        subsystem: 'Scratchpad / AccountManager',
        description: 'Guest scratchpad notes are saved only to in-memory guestData and never persisted to localStorage (hub_scratchpad_v1). On page refresh, all guest notes are lost.'
      });
    }

    // 2.3.2 View switch race condition
    // User types new text
    const draftText = 'Brand new critical draft note!';
    noteArea.value = draftText;
    noteArea.dispatchEvent({ type: 'input', target: noteArea });

    // User switches view to 'notes' within 50ms (before 300ms debounce fires)
    sandbox.switchMainView('notes');
    const valueImmediatelyAfterSwitch = noteArea.value;

    await new Promise(resolve => setTimeout(resolve, 400));
    const savedAfterTimer = sandbox.AccountManager.getScratchpad();

    if (valueImmediatelyAfterSwitch !== draftText || savedAfterTimer !== draftText) {
      console.warn(`[DEFECT CONFIRMED] View Switch Race Condition:`);
      console.warn(`       Expected saved text : "${draftText}"`);
      console.warn(`       Actual noteArea val : "${valueImmediatelyAfterSwitch}"`);
      console.warn(`       Actual saved text   : "${savedAfterTimer}"`);
      console.warn(`       RATIONALE: initNotes() in app.js:129 unconditionally overwrites noteArea.value from storage when switchMainView('notes') is called, clobbering unpersisted user input during the debounce window.`);
      report.findings.push({
        type: 'DEFECT',
        severity: 'HIGH',
        subsystem: 'Scratchpad / Router',
        description: "switchMainView('notes') invokes initNotes() which unconditionally overwrites noteArea.value with stale storage data before active debounce timer expires, permanently destroying typed user draft."
      });
    } else {
      console.log('[PASS] View switch did not clobber active draft');
    }

  } catch (err) {
    console.error(`[FAIL] Section 2.3 Error: ${err.message}`);
    report.findings.push({ section: 'Scratchpad Guest & Race Analysis', error: err.message, stack: err.stack });
  }

  // ==========================================================================
  // SECTION 3: IMAGE LOADING ATTRIBUTES & PRELOAD VERIFICATION
  // ==========================================================================
  console.log('\n--- SECTION 3: Image Loading Attributes & Preload Verification ---');
  try {
    const { sandbox, env, instantiatedImages } = createTestContext();
    sandbox.dispatchEvent({ type: 'DOMContentLoaded' });

    // 1. Single-Page Mode Image Attributes
    const singleImg = env.document.getElementById('current-page-img');
    assert(singleImg !== null, '#current-page-img must exist');

    const singleDecoding = singleImg.getAttribute('decoding');
    const singleReferrer = singleImg.getAttribute('referrerpolicy');
    assertEqual(singleDecoding, 'async', 'Single page image must have decoding="async"');
    assertEqual(singleReferrer, 'no-referrer', 'Single page image must have referrerpolicy="no-referrer"');
    console.log(`[PASS] Single-Page Image Attributes: decoding="${singleDecoding}", referrerpolicy="${singleReferrer}"`);

    // 2. Continuous Mode Image Attributes
    sandbox.toggleReadingMode();
    const contWrap = env.document.getElementById('continuous-wrapper');
    assert(contWrap !== null, '#continuous-wrapper must exist');
    const contImages = contWrap.querySelectorAll('img.continuous-img');
    assert(contImages.length > 0, `Continuous wrapper must contain pages (found ${contImages.length})`);

    let allContValid = true;
    for (const img of contImages) {
      if (img.getAttribute('decoding') !== 'async' ||
          img.getAttribute('referrerpolicy') !== 'no-referrer' ||
          img.loading !== 'lazy') {
        allContValid = false;
        break;
      }
    }
    assert(allContValid, 'All continuous images must have decoding="async", referrerpolicy="no-referrer", and loading="lazy"');
    console.log(`[PASS] Continuous Images (${contImages.length} pages): all set decoding="async", referrerpolicy="no-referrer", loading="lazy"`);

    // 3. Preload Mechanism Inspection
    sandbox.toggleReadingMode(); // back to single page
    instantiatedImages.length = 0;

    sandbox.preloadAdjacentPages();
    console.log(`\n  Preload Telemetry:`);
    console.log(`  - Detached Image instances created via new Image() : ${instantiatedImages.length}`);

    let imagePreloadValid = false;
    if (instantiatedImages.length > 0) {
      const img0 = instantiatedImages[0];
      console.log(`    img[0].decoding       : "${img0.decoding}"`);
      console.log(`    img[0].referrerPolicy : "${img0.referrerPolicy}"`);
      console.log(`    img[0].src            : "${img0.src}"`);
      imagePreloadValid = (img0.decoding === 'async' && img0.referrerPolicy === 'no-referrer' && !!img0.src);
    }

    // Check for <link rel="preload"> generation in <head>
    const preloadLinks = env.document.head.querySelectorAll('link[rel="preload"]');
    console.log(`  - <link rel="preload"> elements in document.head    : ${preloadLinks.length}`);

    if (preloadLinks.length === 0) {
      console.log('  [NOTE on Preload Links]: Preload link generation in <head> is NOT implemented in app.js.');
      console.log('       Preloading is executed strictly via detached new Image() instances in JavaScript.');
      report.findings.push({
        type: 'SPEC_GAP',
        severity: 'LOW',
        subsystem: 'Reader / Preload',
        description: 'Preload link generation (<link rel="preload" as="image" href="..."> in document.head) is not implemented; preloading is performed exclusively via detached JavaScript Image instances (new Image()).'
      });
    }

    // 4. Standalone Reader Generator Inspection
    let standaloneHtml = '';
    const origBlob = sandbox.Blob;
    sandbox.Blob = function(parts, opts) {
      standaloneHtml = parts.join('');
      return new origBlob(parts, opts);
    };
    sandbox.generatePortableReaderHtml();

    assert(standaloneHtml.length > 0, 'Standalone reader HTML must be generated');
    const hasStandaloneAsyncContinuous = standaloneHtml.includes("img.decoding = 'async'");
    const hasStandaloneSingleAsync = /<img[^>]+id="current-page-img"[^>]+decoding="async"/.test(standaloneHtml) ||
                                     standaloneHtml.includes("img.decoding = 'async'");
    const hasStandaloneReferrer = standaloneHtml.includes('meta name="referrer" content="no-referrer"') ||
                                  standaloneHtml.includes('referrerpolicy="no-referrer"');
    const hasStandaloneAdjacentPreload = standaloneHtml.includes('preloadAdjacentPages') ||
                                         standaloneHtml.includes('new Image()');

    console.log(`\n  Standalone Reader Template Analysis:`);
    console.log(`  - Continuous images decoding="async" : ${hasStandaloneAsyncContinuous}`);
    console.log(`  - Single page image decoding="async" : ${hasStandaloneSingleAsync}`);
    console.log(`  - Referrer policy (no-referrer)     : ${hasStandaloneReferrer}`);
    console.log(`  - Preload logic for adjacent pages   : ${hasStandaloneAdjacentPreload}`);

    if (!hasStandaloneAdjacentPreload) {
      console.log('  [NOTE on Standalone Preload]: Standalone portable reader does not include adjacent page preloading.');
    }

    report.imageLoading = {
      singlePageDecoding: singleDecoding,
      singlePageReferrer: singleReferrer,
      continuousPagesChecked: contImages.length,
      continuousAllValid: allContValid,
      detachedImagePreloadCount: instantiatedImages.length,
      detachedImagePreloadCompliant: imagePreloadValid,
      headPreloadLinksCount: preloadLinks.length,
      standaloneReader: {
        continuousAsync: hasStandaloneAsyncContinuous,
        singleAsync: hasStandaloneSingleAsync,
        referrerPolicy: hasStandaloneReferrer,
        adjacentPreload: hasStandaloneAdjacentPreload
      }
    };

  } catch (err) {
    console.error(`[FAIL] Section 3 Error: ${err.message}`);
    report.findings.push({ section: 'Image Loading & Preload', error: err.message, stack: err.stack });
  }

  // ==========================================================================
  // SUMMARY & VERDICT EVALUATION
  // ==========================================================================
  console.log('\n================================================================');
  console.log('                     SUITE RESULTS SUMMARY                      ');
  console.log('================================================================');
  console.log(JSON.stringify(report, null, 2));

  return report;
}

if (require.main === module) {
  runAdversarialSuite().then(report => {
    console.log(`\nAdversarial Suite Execution Finished.`);
    console.log(`Findings Recorded: ${report.findings.length}`);
  });
}

module.exports = { runAdversarialSuite };
