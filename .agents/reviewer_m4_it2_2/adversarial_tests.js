/**
 * .agents/reviewer_m4_it2_2/adversarial_tests.js
 * Independent Adversarial Stress Test Suite for M4 Iteration 2 Review
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
  loadApplicationContext,
  createBrowserEnvironment,
  parseHTML,
  assert,
  assertEqual,
  assertNotEqual,
  assertContains,
  assertNotContains,
  assertMatch,
  ROOT_DIR
} = require('../../tests/harness');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function report(id, name, pass, err = null) {
  totalTests++;
  if (pass) {
    passedTests++;
    console.log(`[PASS] ${id}: ${name}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${id}: ${name} -> ${err ? err.message || err : 'Assertion failed'}`);
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runAdversarialSuite() {
  console.log('=== Reviewer M4 Iteration 2 Independent Adversarial Suite ===\n');

  // 1. ForumApp Idempotency & Duplicate Prevention
  try {
    const ctx = loadApplicationContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    // Switch once to forum to trigger initial ForumApp.init()
    ctx.window.switchMainView('forum');

    const btnSubmit = ctx.document.getElementById('forum-submit-thread-btn');
    const listenersAfterFirstInit = (btnSubmit._eventListeners['click'] || []).length;
    assertEqual(listenersAfterFirstInit, 1, 'Initial switch to forum attaches exactly 1 listener');

    // Call init / switch 25 times
    for (let i = 0; i < 25; i++) {
      ctx.window.ForumApp.init();
      ctx.window.switchMainView('forum');
    }

    const postListeners = (btnSubmit._eventListeners['click'] || []).length;
    assertEqual(postListeners, 1, `Click listeners on #forum-submit-thread-btn must stay at 1 after 25 switches (got ${postListeners})`);

    // Submit a thread and verify exactly 1 thread added
    const initialThreadCount = JSON.parse(ctx.window.localStorage.getItem('hub_forum_threads_v1')).length;
    
    // Simulate filling in form
    ctx.document.getElementById('post-subject-input').value = 'Adversarial Test Thread';
    ctx.document.getElementById('post-comment-input').value = 'Testing single submission behavior';
    btnSubmit.dispatchEvent({ type: 'click' });

    const threadsAfter = JSON.parse(ctx.window.localStorage.getItem('hub_forum_threads_v1'));
    assertEqual(threadsAfter.length, initialThreadCount + 1, 'Exactly one thread must be appended on submit');
    report('ADV-FORUM-01', 'ForumApp init idempotency and single listener binding', true);
  } catch (e) {
    report('ADV-FORUM-01', 'ForumApp init idempotency and single listener binding', false, e);
  }

  // 2. Scratchpad Live Sync & Guest Persistence
  try {
    const ctx = loadApplicationContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    const noteArea = ctx.document.getElementById('scratchpad-text');
    assert(noteArea !== null, 'scratchpad-text exists');

    // 2a. Live sync immediately on input
    const testText = 'Reviewer Adversarial Sync Test 12345';
    noteArea.value = testText;
    noteArea.dispatchEvent({ type: 'input', target: noteArea });

    const immediateAccountVal = ctx.window.AccountManager.getScratchpad();
    assertEqual(immediateAccountVal, testText, 'Live sync must return typed text immediately on input');

    // 2b. Storage persistence after debounce
    await sleep(350);
    const persisted = ctx.window.localStorage.getItem('hub_scratchpad_v1');
    assertEqual(persisted, testText, 'Guest notes must persist to localStorage after debounce');

    // 2c. Reload simulation
    const ctx2 = loadApplicationContext();
    // Pre-populate storage from ctx
    ctx2.window.localStorage.setItem('hub_scratchpad_v1', testText);
    ctx2.window.dispatchEvent({ type: 'DOMContentLoaded' });

    const noteArea2 = ctx2.document.getElementById('scratchpad-text');
    assertEqual(noteArea2.value, testText, 'On reload, guest notes must be restored in textarea');
    assertEqual(ctx2.window.AccountManager.getScratchpad(), testText, 'On reload, AccountManager must restore guest notes');

    // 2d. Clearing scratchpad
    noteArea2.value = '';
    noteArea2.dispatchEvent({ type: 'input', target: noteArea2 });
    await sleep(350);
    assertEqual(ctx2.window.localStorage.getItem('hub_scratchpad_v1'), '', 'Clearing notes persists empty string');

    report('ADV-SCRATCH-01', 'Scratchpad live sync, guest persistence, and reload restore', true);
  } catch (e) {
    report('ADV-SCRATCH-01', 'Scratchpad live sync, guest persistence, and reload restore', false, e);
  }

  // 3. Scratchpad View Switch Race Condition Defense
  try {
    const ctx = loadApplicationContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    const noteArea = ctx.document.getElementById('scratchpad-text');
    noteArea.value = 'Uncommitted draft text before view switch';
    noteArea.dispatchEvent({ type: 'input', target: noteArea });

    // Switch view to notes while debounce is still active
    ctx.window.switchMainView('notes');

    assertEqual(noteArea.value, 'Uncommitted draft text before view switch', 'Draft must not be wiped by initNotes() during debounce window');
    await sleep(350);
    assertEqual(ctx.window.localStorage.getItem('hub_scratchpad_v1'), 'Uncommitted draft text before view switch', 'Debounced draft must persist after window');

    report('ADV-SCRATCH-02', 'Scratchpad draft preservation on view switch during debounce', true);
  } catch (e) {
    report('ADV-SCRATCH-02', 'Scratchpad draft preservation on view switch during debounce', false, e);
  }

  // 4. Headless Image Safety (typeof Image === 'undefined')
  try {
    const ctx = loadApplicationContext();
    // Ensure Image is undefined
    delete ctx.window.Image;
    assert(typeof ctx.window.Image === 'undefined', 'Image must be undefined for headless test');

    // DOMContentLoaded calls setupReaderControls and selectChapter
    let crashed = false;
    try {
      ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });
    } catch (err) {
      crashed = true;
      throw err;
    }

    report('ADV-IMG-01', 'Headless environment safety when Image constructor is undefined', !crashed);
  } catch (e) {
    report('ADV-IMG-01', 'Headless environment safety when Image constructor is undefined', false, e);
  }

  // 5. Standalone Reader Generator Adversarial Sanitization & Script Breakout
  try {
    const ctx = loadApplicationContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    const evilTitle = '</script><script>alert("pwned")</script><img src=x onerror=alert(1)> "quotes" & \'single\'';
    const mockChapters = [
      {
        number: 1,
        title: evilTitle,
        pages: ['https://example.com/p1.jpg', 'https://example.com/p2.jpg']
      },
      {
        number: 2,
        title: null, // null title test
        pages: []
      }
    ];

    vm.runInContext(`
      allChapters = ${JSON.stringify(mockChapters)};
    `, ctx.window);

    let generatedHtml = '';
    ctx.window.Blob = class MockBlob {
      constructor(parts) {
        generatedHtml = parts.join('');
      }
    };
    ctx.window.URL = {
      createObjectURL: () => 'blob:mock-url',
      revokeObjectURL: () => {}
    };

    ctx.window.generatePortableReaderHtml();

    // Verify script breakout not present
    const scriptStart = generatedHtml.indexOf('<script>');
    const scriptEnd = generatedHtml.lastIndexOf('</script>');
    const scriptBody = generatedHtml.substring(scriptStart + 8, scriptEnd);

    assert(!scriptBody.includes('</script>'), 'Embedded script body must not contain unescaped </script>');
    assertContains(generatedHtml, '\\u003c/script>', 'Angle brackets must be unicode-escaped in JSON');
    assertContains(generatedHtml, 'function escapeHtml', 'Standalone reader must define escapeHtml');

    report('ADV-STANDALONE-01', 'Standalone reader JSON escaping, XSS sanitization, and null safety', true);
  } catch (e) {
    report('ADV-STANDALONE-01', 'Standalone reader JSON escaping, XSS sanitization, and null safety', false, e);
  }

  // 6. Keyboard and Wheel Isolation
  try {
    const ctx = loadApplicationContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    // Focus on select element
    const selectCh = ctx.document.getElementById('header-ch-select');
    ctx.window.switchMainView('reader');
    ctx.window.switchReaderTab('reader');

    const spaceEvt = {
      type: 'keydown',
      key: ' ',
      target: selectCh,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }
    };
    ctx.window.dispatchEvent(spaceEvt);
    assertEqual(spaceEvt.defaultPrevented, false, 'Spacebar on select element must not be intercepted');

    // Ctrl+Wheel in chat view
    ctx.window.switchMainView('chat');
    const zoomBefore = vm.runInContext('zoomFactor', ctx.window);
    const wheelEvt = {
      type: 'wheel',
      ctrlKey: true,
      deltaY: -100,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }
    };
    ctx.window.dispatchEvent(wheelEvt);
    const zoomAfter = vm.runInContext('zoomFactor', ctx.window);
    assertEqual(zoomBefore, zoomAfter, 'Wheel zoom must not change when outside active reader view');

    report('ADV-INPUT-01', 'Keyboard shortcut and wheel isolation across views and controls', true);
  } catch (e) {
    report('ADV-INPUT-01', 'Keyboard shortcut and wheel isolation across views and controls', false, e);
  }

  // 7. Chapter Catalog Highlighting & Sanitization
  try {
    const ctx = loadApplicationContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    // Inject malicious chapter
    const maliciousTitle = '<img src=x onerror=xss()>';
    const sampleChapters = [
      { number: 1, title: 'Chapter 1: Normal Title', pages: [] },
      { number: 2, title: maliciousTitle, pages: [] }
    ];

    vm.runInContext(`
      allChapters = ${JSON.stringify(sampleChapters)};
      renderChapterCatalog();
    `, ctx.window);

    const catalog = ctx.document.getElementById('chapter-list');
    const imgXss = catalog.querySelector('img[onerror]');
    assert(imgXss === null, 'Malicious chapter title must not inject active <img> tags into catalog');

    // Check active class
    vm.runInContext(`
      selectChapter(allChapters[1]);
    `, ctx.window);

    const activeItem = catalog.querySelector('.chapter-item.active.selected');
    assert(activeItem !== null, 'Active chapter must have both active and selected classes');
    assertEqual(activeItem.getAttribute('data-chapter-number'), '2', 'Active item data attribute must match chapter number');

    report('ADV-CATALOG-01', 'Chapter catalog XSS prevention and active item styling', true);
  } catch (e) {
    report('ADV-CATALOG-01', 'Chapter catalog XSS prevention and active item styling', false, e);
  }

  console.log('\n------------------------------------------------------------');
  console.log(`Reviewer Adversarial Suite Complete: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('------------------------------------------------------------\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAdversarialSuite().catch(err => {
  console.error('Fatal error in suite:', err);
  process.exit(1);
});
