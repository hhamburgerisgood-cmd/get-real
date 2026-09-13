/**
 * tests/m4_challenge_it2.test.js
 * Comprehensive Empirical Adversarial Verification Suite for Milestone M4 Iteration 2
 * 
 * Objectives:
 * 1. Test view switching 20 times between forum, chat, and reader:
 *    - Verify zero listener multiplication on all view elements, document, and window
 *    - Verify zero memory leaks / DOM element explosion
 *    - Verify single-fire event handlers after repeated switching
 * 2. Test scratchpad input rapid typing and view switching during debounce interval:
 *    - Verify zero draft loss for guest users during debounce window
 *    - Verify zero draft loss for authenticated users during debounce window
 *    - Verify multi-burst typing across rapid view switches
 *    - Verify focus protection and draft preservation across 20 transitions
 *    - Verify scratchpad clearing / deletion integrity during debounce interval
 * 3. Inspect runtime error logs on view transitions and reactive account events
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
  loadApplicationContext,
  assert,
  assertEqual,
  assertNotEqual,
  assertContains,
  ROOT_DIR
} = require('./harness');

const testResults = [];

function record(id, title, passed, details = null) {
  testResults.push({ id, title, passed, details });
  const mark = passed ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${id}: ${title}`);
  if (!passed && details) {
    console.log(`       -> Detail: ${details}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createTestContext() {
  const ctx = loadApplicationContext();
  if (typeof ctx.window.Image === 'undefined') {
    ctx.window.Image = function() {
      const img = ctx.document.createElement('img');
      img.decoding = 'auto';
      img.referrerPolicy = '';
      return img;
    };
  }

  // Intercept window/document listeners for exact auditing
  const trackedListeners = {
    window: {},
    document: {}
  };

  const origWinAdd = ctx.window.addEventListener;
  ctx.window.addEventListener = function(type, handler, opts) {
    if (!trackedListeners.window[type]) trackedListeners.window[type] = [];
    trackedListeners.window[type].push(handler);
    return origWinAdd.call(this, type, handler, opts);
  };

  const origDocAdd = ctx.document.addEventListener;
  ctx.document.addEventListener = function(type, handler, opts) {
    if (!trackedListeners.document[type]) trackedListeners.document[type] = [];
    trackedListeners.document[type].push(handler);
    return origDocAdd.call(this, type, handler, opts);
  };

  ctx.trackedListeners = trackedListeners;
  return ctx;
}

// Helper to count total DOM elements recursively
function countDomNodes(node) {
  if (!node) return 0;
  let count = 1;
  if (node.childNodes) {
    for (const child of node.childNodes) {
      if (child.nodeType === 1) { // ELEMENT_NODE
        count += countDomNodes(child);
      }
    }
  }
  return count;
}

async function runEmpiricalChallenge() {
  console.log('======================================================================');
  console.log('CHALLENGER M4-IT2: EMPIRICAL STRESS & ADVERSARIAL VERIFICATION');
  console.log('======================================================================\n');

  // =========================================================================
  // SUITE 1: 20X VIEW SWITCHING BETWEEN FORUM, CHAT, AND READER
  // =========================================================================
  console.log('--- SUITE 1: 20x View Switching (Forum <-> Chat <-> Reader) ---');

  // Test 1.1: Event listener multiplication across 20 cycles
  try {
    const ctx = createTestContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    // Initial switch to each view once to establish baseline initialized state
    ctx.window.switchMainView('forum');
    ctx.window.switchMainView('chat');
    ctx.window.switchMainView('reader');

    // Capture baseline element listener counts
    const submitBtn = ctx.document.getElementById('forum-submit-thread-btn');
    const togglePostBtn = ctx.document.getElementById('btn-toggle-post-box');
    const backCatBtn = ctx.document.getElementById('forum-back-catalog-btn');
    const boardLinks = ctx.document.querySelectorAll('.board-nav-link');
    const chatSendBtn = ctx.document.getElementById('chat-send-btn');
    const chatInput = ctx.document.getElementById('chat-input-box');
    const chatUserBtn = ctx.document.getElementById('chat-change-user-btn');

    const baselineForumSubmit = (submitBtn?._eventListeners['click'] || []).length;
    const baselineTogglePost = (togglePostBtn?._eventListeners['click'] || []).length;
    const baselineBackCat = (backCatBtn?._eventListeners['click'] || []).length;
    const baselineBoardLink0 = boardLinks.length > 0 ? (boardLinks[0]._eventListeners['click'] || []).length : 0;
    const baselineChatSend = (chatSendBtn?._eventListeners['click'] || []).length;
    const baselineChatInput = (chatInput?._eventListeners['keydown'] || []).length;
    const baselineChatUser = (chatUserBtn?._eventListeners['click'] || []).length;

    // Window / document level listeners
    const baselineWinKeydown = (ctx.trackedListeners.window['keydown'] || []).length;
    const baselineWinWheel = (ctx.trackedListeners.window['wheel'] || []).length;
    const baselineWinResize = (ctx.trackedListeners.window['resize'] || []).length;
    const baselineWinStorage = (ctx.trackedListeners.window['storage'] || []).length;

    // Perform 20 full cycles between forum, chat, and reader (60 view switches total)
    for (let i = 0; i < 20; i++) {
      ctx.window.switchMainView('forum');
      ctx.window.switchMainView('chat');
      ctx.window.switchMainView('reader');
    }

    // Measure post-switch listener counts
    const postForumSubmit = (submitBtn?._eventListeners['click'] || []).length;
    const postTogglePost = (togglePostBtn?._eventListeners['click'] || []).length;
    const postBackCat = (backCatBtn?._eventListeners['click'] || []).length;
    const postBoardLink0 = boardLinks.length > 0 ? (boardLinks[0]._eventListeners['click'] || []).length : 0;
    const postChatSend = (chatSendBtn?._eventListeners['click'] || []).length;
    const postChatInput = (chatInput?._eventListeners['keydown'] || []).length;
    const postChatUser = (chatUserBtn?._eventListeners['click'] || []).length;

    const postWinKeydown = (ctx.trackedListeners.window['keydown'] || []).length;
    const postWinWheel = (ctx.trackedListeners.window['wheel'] || []).length;
    const postWinResize = (ctx.trackedListeners.window['resize'] || []).length;
    const postWinStorage = (ctx.trackedListeners.window['storage'] || []).length;

    const listenerMultiplication = (
      postForumSubmit !== baselineForumSubmit ||
      postTogglePost !== baselineTogglePost ||
      postBackCat !== baselineBackCat ||
      postBoardLink0 !== baselineBoardLink0 ||
      postChatSend !== baselineChatSend ||
      postChatInput !== baselineChatInput ||
      postChatUser !== baselineChatUser ||
      postWinKeydown !== baselineWinKeydown ||
      postWinWheel !== baselineWinWheel ||
      postWinResize !== baselineWinResize ||
      postWinStorage !== baselineWinStorage
    );

    if (listenerMultiplication) {
      const leaks = [];
      if (postForumSubmit !== baselineForumSubmit) leaks.push(`forumSubmit: ${baselineForumSubmit} -> ${postForumSubmit}`);
      if (postTogglePost !== baselineTogglePost) leaks.push(`togglePost: ${baselineTogglePost} -> ${postTogglePost}`);
      if (postBackCat !== baselineBackCat) leaks.push(`backCat: ${baselineBackCat} -> ${postBackCat}`);
      if (postBoardLink0 !== baselineBoardLink0) leaks.push(`boardLink: ${baselineBoardLink0} -> ${postBoardLink0}`);
      if (postChatSend !== baselineChatSend) leaks.push(`chatSend: ${baselineChatSend} -> ${postChatSend}`);
      if (postChatInput !== baselineChatInput) leaks.push(`chatInput: ${baselineChatInput} -> ${postChatInput}`);
      if (postChatUser !== baselineChatUser) leaks.push(`chatUser: ${baselineChatUser} -> ${postChatUser}`);
      if (postWinKeydown !== baselineWinKeydown) leaks.push(`winKeydown: ${baselineWinKeydown} -> ${postWinKeydown}`);
      if (postWinWheel !== baselineWinWheel) leaks.push(`winWheel: ${baselineWinWheel} -> ${postWinWheel}`);
      if (postWinResize !== baselineWinResize) leaks.push(`winResize: ${baselineWinResize} -> ${postWinResize}`);
      if (postWinStorage !== baselineWinStorage) leaks.push(`winStorage: ${baselineWinStorage} -> ${postWinStorage}`);

      record('CHALLENGE-1.1', 'Zero listener multiplication after 20 view switches', false, `Listener multiplication detected: ${leaks.join(', ')}`);
    } else {
      record('CHALLENGE-1.1', 'Zero listener multiplication after 20 view switches', true);
    }
  } catch (err) {
    record('CHALLENGE-1.1', 'Zero listener multiplication after 20 view switches', false, err.message);
  }

  // Test 1.2: DOM element leak / unbounded node growth check across 20 switches
  try {
    const ctx = createTestContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    // Establish initial settled state across all 3 views
    ctx.window.switchMainView('forum');
    ctx.window.switchMainView('chat');
    ctx.window.switchMainView('reader');

    const settledNodeCount = countDomNodes(ctx.document.documentElement);

    // Switch 20 times between forum, chat, reader
    for (let i = 0; i < 20; i++) {
      ctx.window.switchMainView('forum');
      ctx.window.switchMainView('chat');
      ctx.window.switchMainView('reader');
    }

    const post20NodeCount = countDomNodes(ctx.document.documentElement);
    const nodeGrowth = post20NodeCount - settledNodeCount;

    if (nodeGrowth > 0) {
      record(
        'CHALLENGE-1.2',
        'Zero DOM node growth / memory leak after 20 view switches',
        false,
        `DOM leak detected: Node count increased by ${nodeGrowth} nodes (from ${settledNodeCount} to ${post20NodeCount}) without any content added!`
      );
    } else {
      record(
        'CHALLENGE-1.2',
        'Zero DOM node growth / memory leak after 20 view switches',
        true
      );
    }
  } catch (err) {
    record('CHALLENGE-1.2', 'Zero DOM node growth / memory leak after 20 view switches', false, err.message);
  }

  // Test 1.3: Single-fire event verification after 20 switches (functional integrity)
  try {
    const ctx = createTestContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    // Switch 20 times
    for (let i = 0; i < 20; i++) {
      ctx.window.switchMainView('forum');
      ctx.window.switchMainView('chat');
      ctx.window.switchMainView('reader');
    }

    // Switch to Chat and send one message
    ctx.window.switchMainView('chat');
    const chatInput = ctx.document.getElementById('chat-input-box');
    const chatSendBtn = ctx.document.getElementById('chat-send-btn');
    chatInput.value = 'Empirical test message after 20 switches';

    const messagesContainer = ctx.document.getElementById('chat-messages-container');
    const countBeforeSend = messagesContainer.querySelectorAll('.chat-msg').length;

    chatSendBtn.dispatchEvent({ type: 'click' });

    const countAfterSend = messagesContainer.querySelectorAll('.chat-msg').length;
    const addedMessages = countAfterSend - countBeforeSend;

    assertEqual(addedMessages, 1, `Sending a message should add exactly 1 DOM message node, but added ${addedMessages}`);

    // Switch to Forum and submit one thread
    ctx.window.switchMainView('forum');
    const subjInput = ctx.document.getElementById('post-subject-input');
    const commentInput = ctx.document.getElementById('post-comment-input');
    const forumSubmitBtn = ctx.document.getElementById('forum-submit-thread-btn');

    subjInput.value = 'Empirical Stress Thread';
    commentInput.value = 'Thread created after 20 view switches';

    const threadsList = ctx.document.getElementById('forum-threads-list');
    const threadsBefore = threadsList.querySelectorAll('.board-thread-card').length;

    forumSubmitBtn.dispatchEvent({ type: 'click' });

    const threadsAfter = threadsList.querySelectorAll('.board-thread-card').length;
    const addedThreads = threadsAfter - threadsBefore;

    assertEqual(addedThreads, 1, `Submitting a thread should add exactly 1 thread card, but added ${addedThreads}`);
    record('CHALLENGE-1.3', 'Single-fire event verification after 20 view switches', true);
  } catch (err) {
    record('CHALLENGE-1.3', 'Single-fire event verification after 20 view switches', false, err.message);
  }

  // =========================================================================
  // SUITE 2: SCRATCHPAD RAPID TYPING & VIEW SWITCHING DURING DEBOUNCE
  // =========================================================================
  console.log('\n--- SUITE 2: Scratchpad Rapid Typing & View Switch Debounce ---');

  // Test 2.1: Guest mode: 50-keystroke rapid typing burst + switch view during debounce (t = 20ms)
  try {
    const ctx = createTestContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });
    ctx.window.switchMainView('notes');

    const noteArea = ctx.document.getElementById('scratchpad-text');
    assert(noteArea !== null, '#scratchpad-text must exist');

    // Simulate 50 rapid sequential keystrokes
    let testDraft = 'Guest Rapid Notes Burst: ';
    for (let i = 1; i <= 50; i++) {
      testDraft += String.fromCharCode(65 + (i % 26));
      noteArea.value = testDraft;
      noteArea.dispatchEvent({ type: 'input', target: noteArea });
    }

    // Immediately (well within 300ms debounce interval) switch view away
    ctx.window.switchMainView('hub');
    ctx.window.switchMainView('forum');
    ctx.window.switchMainView('reader');

    // Verify draft was not clobbered during view switches
    assertEqual(noteArea.value, testDraft, 'DOM textarea must retain active draft during view switch');

    // Switch back to notes view at t=50ms (still within 300ms debounce)
    await sleep(50);
    ctx.window.switchMainView('notes');

    assertEqual(noteArea.value, testDraft, 'initNotes() must not reset draft when switching back to notes');

    // Now wait for debounce timer to complete (300ms debounce + margin)
    await sleep(350);

    // Verify draft is completely persisted in AccountManager and localStorage
    const storedInAccount = ctx.window.AccountManager.getScratchpad();
    const storedInStorage = ctx.window.localStorage.getItem('hub_scratchpad_v1');

    assertEqual(storedInAccount, testDraft, 'AccountManager must have full draft after debounce timer');
    assertEqual(storedInStorage, testDraft, 'localStorage must have full draft after debounce timer');

    record('CHALLENGE-2.1', 'Guest mode: rapid 50-keystroke typing + view switch during debounce', true);
  } catch (err) {
    record('CHALLENGE-2.1', 'Guest mode: rapid 50-keystroke typing + view switch during debounce', false, err.message);
  }

  // Test 2.2: Authenticated mode: rapid typing + 20 chaotic view transitions during debounce
  try {
    const ctx = createTestContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    // Register with proper parameters: (username, displayName, password, avatar)
    const regResult = await ctx.window.AccountManager.register('StressUser', 'Stress User', 'P@ssword123');
    assertEqual(regResult.success, true, 'Registration must succeed');

    const loginResult = await ctx.window.AccountManager.login('StressUser', 'P@ssword123');
    assertEqual(loginResult.success, true, 'Login must succeed');

    ctx.window.switchMainView('notes');
    const noteArea = ctx.document.getElementById('scratchpad-text');

    const authDraft = 'Authenticated User Secret Notes 2026';
    noteArea.value = authDraft;
    noteArea.dispatchEvent({ type: 'input', target: noteArea });

    // Perform 20 rapid view transitions during the 300ms debounce window
    const views = ['hub', 'chat', 'forum', 'reader', 'notes'];
    for (let i = 0; i < 20; i++) {
      ctx.window.switchMainView(views[i % views.length]);
    }

    assertEqual(noteArea.value, authDraft, 'DOM textarea must retain active draft throughout 20 view switches');

    // Wait for debounce timer to settle
    await sleep(350);

    const activeAcc = ctx.window.AccountManager.getActiveAccount();
    assert(activeAcc !== null, 'Active account must not be null');
    assertEqual(activeAcc.scratchpad, authDraft, 'Active user profile scratchpad must be saved with full draft');
    assertEqual(ctx.window.AccountManager.getScratchpad(), authDraft, 'AccountManager.getScratchpad() must return full draft');

    record('CHALLENGE-2.2', 'Authenticated mode: rapid typing + 20 view transitions during debounce', true);
  } catch (err) {
    record('CHALLENGE-2.2', 'Authenticated mode: rapid typing + 20 view transitions during debounce', false, err.message);
  }

  // Test 2.3: Multi-burst typing with interleaved view switches
  try {
    const ctx = createTestContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });
    ctx.window.switchMainView('notes');

    const noteArea = ctx.document.getElementById('scratchpad-text');

    // Burst 1
    noteArea.value = 'Line 1: Started writing...';
    noteArea.dispatchEvent({ type: 'input', target: noteArea });
    await sleep(100); // 100ms: debounce still pending

    // Switch view to chat while debounce is pending
    ctx.window.switchMainView('chat');
    await sleep(50); // 150ms elapsed total

    // Switch back to notes and continue typing Burst 2
    ctx.window.switchMainView('notes');
    assertEqual(noteArea.value, 'Line 1: Started writing...', 'Burst 1 draft must be preserved');

    noteArea.value = 'Line 1: Started writing...\nLine 2: Continuing thoughts...';
    noteArea.dispatchEvent({ type: 'input', target: noteArea });

    // Switch to reader
    ctx.window.switchMainView('reader');
    await sleep(100);

    // Switch back to notes and add Burst 3
    ctx.window.switchMainView('notes');
    assertEqual(noteArea.value, 'Line 1: Started writing...\nLine 2: Continuing thoughts...', 'Burst 2 draft must be preserved');

    noteArea.value = 'Line 1: Started writing...\nLine 2: Continuing thoughts...\nLine 3: Finished successfully!';
    noteArea.dispatchEvent({ type: 'input', target: noteArea });

    // Now switch away and let the final debounce timer fire
    ctx.window.switchMainView('hub');
    await sleep(400); // Wait for debounce to settle

    const finalExpected = 'Line 1: Started writing...\nLine 2: Continuing thoughts...\nLine 3: Finished successfully!';
    assertEqual(ctx.window.AccountManager.getScratchpad(), finalExpected, 'Final merged draft must be saved in AccountManager');
    assertEqual(ctx.window.localStorage.getItem('hub_scratchpad_v1'), finalExpected, 'Final merged draft must be saved in localStorage');

    // Switch back to notes and check rendered value
    ctx.window.switchMainView('notes');
    assertEqual(noteArea.value, finalExpected, 'Textarea value must match final saved draft');

    record('CHALLENGE-2.3', 'Multi-burst typing interleaved with view switches', true);
  } catch (err) {
    record('CHALLENGE-2.3', 'Multi-burst typing interleaved with view switches', false, err.message);
  }

  // Test 2.4: Active typing focus protection
  try {
    const ctx = createTestContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });
    ctx.window.switchMainView('notes');

    const noteArea = ctx.document.getElementById('scratchpad-text');
    ctx.document.activeElement = noteArea; // simulate focus

    noteArea.value = 'Active typing with focus';
    noteArea.dispatchEvent({ type: 'input', target: noteArea });

    // Call initNotes() explicitly as if view router triggered it
    ctx.window.initNotes();

    assertEqual(noteArea.value, 'Active typing with focus', 'initNotes() must return early when activeElement === noteArea');

    ctx.document.activeElement = ctx.document.body; // unfocus
    record('CHALLENGE-2.4', 'Focus protection in initNotes() prevents clobbering', true);
  } catch (err) {
    record('CHALLENGE-2.4', 'Focus protection in initNotes() prevents clobbering', false, err.message);
  }

  // Test 2.5: Clearing scratchpad / deletion race condition on view switch
  try {
    const ctx = createTestContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });
    ctx.window.switchMainView('notes');

    const noteArea = ctx.document.getElementById('scratchpad-text');

    // Step 1: User saves some initial notes
    ctx.window.AccountManager.saveScratchpad('Original Note Content to be Cleared');
    ctx.window.switchMainView('notes');
    assertEqual(noteArea.value, 'Original Note Content to be Cleared', 'Initial note should load');

    // Step 2: User clears the scratchpad (deletes everything)
    noteArea.value = '';
    noteArea.dispatchEvent({ type: 'input', target: noteArea });

    // Step 3: User switches views during the 300ms debounce interval
    ctx.window.switchMainView('hub');
    ctx.window.switchMainView('notes');

    if (noteArea.value !== '') {
      record(
        'CHALLENGE-2.5',
        'Scratchpad deletion integrity: clearing note preserved across view switches during debounce',
        false,
        `DATA CORRUPTION: User deleted all text (noteArea.value = ""), but initNotes() restored the old note ("${noteArea.value}"). DOM and persistent storage are now desynchronized.`
      );
    } else {
      // Let debounce timer fire and verify storage is also empty
      await sleep(350);
      assertEqual(ctx.window.AccountManager.getScratchpad(), '', 'AccountManager scratchpad must be empty');
      assertEqual(ctx.window.localStorage.getItem('hub_scratchpad_v1'), '', 'localStorage scratchpad must be empty');
      record('CHALLENGE-2.5', 'Scratchpad deletion integrity: clearing note preserved across view switches during debounce', true);
    }
  } catch (err) {
    record('CHALLENGE-2.5', 'Scratchpad deletion integrity: clearing note preserved across view switches during debounce', false, err.message);
  }

  // =========================================================================
  // SUITE 3: ADVERSARIAL INSPECTION OF REACTIVE ACCOUNT SUBSCRIPTIONS
  // =========================================================================
  console.log('\n--- SUITE 3: Adversarial Inspection: Account Subscriptions & Guest Events ---');

  // Test 3.1: ChatApp account change listener crash on null account (guest/logout)
  try {
    const ctx = createTestContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    // Switch to chat so ChatApp.init() hooks AccountManager.onAccountChange
    ctx.window.switchMainView('chat');

    let consoleErrorCaptured = null;
    const origConsoleError = ctx.window.console.error;
    ctx.window.console.error = function(...args) {
      consoleErrorCaptured = args.join(' ');
      origConsoleError.apply(this, args);
    };

    // User is in Guest mode. Trigger a scratchpad save or logout notification.
    // AccountManager calls notifyChange('scratchpad') which calls changeListeners with getActiveAccount() (null)
    ctx.window.AccountManager.saveScratchpad('Testing guest notification in ChatApp');

    ctx.window.console.error = origConsoleError;

    if (consoleErrorCaptured && consoleErrorCaptured.includes("Cannot read properties of null (reading 'username')")) {
      record(
        'CHALLENGE-3.1',
        'ChatApp.init() onAccountChange null-safety for guest users / logouts',
        false,
        `VULNERABILITY: chat.js:75 does \`currentUser = acc.username\` without checking \`if (acc)\`. When an unauthenticated guest saves scratchpad or logs out, AccountManager passes \`null\` to onAccountChange listeners, triggering: ${consoleErrorCaptured}`
      );
    } else {
      record('CHALLENGE-3.1', 'ChatApp.init() onAccountChange null-safety for guest users / logouts', true);
    }
  } catch (err) {
    record('CHALLENGE-3.1', 'ChatApp.init() onAccountChange null-safety for guest users / logouts', false, err.message);
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log('CHALLENGE SUITE RESULTS SUMMARY');
  console.log('======================================================================');
  const total = testResults.length;
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;

  console.log(`Total Challenge Tests: ${total}`);
  console.log(`Passed               : ${passed}`);
  console.log(`Failed               : ${failed}`);
  console.log(`Pass Rate            : ${Math.round((passed / total) * 100)}%\n`);

  if (failed > 0) {
    console.log('DEFECTS FOUND:');
    testResults.filter(r => !r.passed).forEach(r => {
      console.log(`  [FAIL] ${r.id}: ${r.title}`);
      console.log(`         ${r.details}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

runEmpiricalChallenge().catch(err => {
  console.error(err);
  process.exit(1);
});
