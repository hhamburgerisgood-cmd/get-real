/**
 * tests/m4_adversarial_challenge.test.js
 * Comprehensive Empirical Stress-Testing Suite for Milestone M4
 * 
 * Areas Tested:
 * 1. Rapid view switching between Hub, Reader, Chat, Forum, Notes (duplicate listeners, memory leaks, crashes)
 * 2. Rapid chapter search filtering and debouncing
 * 3. Standalone reader HTML generation with malicious or edge-case chapter data
 * 4. handleKeyDown and handleWheel behavior across views and form controls
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
} = require('./harness');

const results = [];

function recordTest(id, name, passed, details = null) {
  results.push({ id, name, passed, details });
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${id}: ${name}`);
  if (!passed && details) {
    console.log(`       -> Error/Finding: ${details}`);
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createChallengeContext() {
  const ctx = loadApplicationContext();
  if (typeof ctx.window.Image === 'undefined') {
    ctx.window.Image = function() {
      const img = ctx.document.createElement('img');
      img.decoding = 'auto';
      img.referrerPolicy = '';
      return img;
    };
  }
  vm.runInContext(`
    window.allChapters = allChapters;
    window.setAllChapters = function(list) { allChapters = list; window.allChapters = list; };
    window.getAllChapters = function() { return allChapters; };
    window.getZoomFactor = function() { return zoomFactor; };
  `, ctx.window);
  return ctx;
}

async function runSuite() {
  console.log('======================================================================');
  console.log('CHALLENGER M4 EMPIRICAL ADVERSARIAL STRESS-TEST SUITE');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // AREA 1: RAPID VIEW SWITCHING STRESS TESTS
  // -------------------------------------------------------------------------
  console.log('--- AREA 1: Rapid View Switching Stress Tests ---');

  // Test 1.1: ForumApp listener accumulation on repeated view switches
  try {
    const ctx = createChallengeContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    const submitBtn = ctx.document.getElementById('forum-submit-thread-btn');
    const initialListeners = (submitBtn._eventListeners['click'] || []).length;

    // Rapidly switch between Hub and Forum 10 times
    for (let i = 0; i < 10; i++) {
      ctx.window.switchMainView('hub');
      ctx.window.switchMainView('forum');
    }

    const postSwitchListeners = (submitBtn._eventListeners['click'] || []).length;
    if (postSwitchListeners > initialListeners + 1) {
      recordTest(
        'STRESS-1.1',
        'ForumApp.init() listener accumulation on view switches',
        false,
        `LEAK DETECTED: #forum-submit-thread-btn accumulated ${postSwitchListeners} click listeners (expected 1). Clicking submit will trigger ${postSwitchListeners} times.`
      );
    } else {
      recordTest('STRESS-1.1', 'ForumApp.init() listener accumulation on view switches', true);
    }
  } catch (err) {
    recordTest('STRESS-1.1', 'ForumApp.init() listener accumulation on view switches', false, err.message);
  }

  // Test 1.2: ForumApp idempotency guard verification (F17 defect)
  try {
    const forumCode = fs.readFileSync(path.join(ROOT_DIR, 'forum.js'), 'utf8');
    const hasInitGuard = /isInitialized|initialized|_isInit/.test(forumCode);

    if (!hasInitGuard) {
      recordTest(
        'STRESS-1.2',
        'ForumApp.init() missing idempotency guard (F17 defect)',
        false,
        'forum.js lacks isInitialized guard; each switchMainView("forum") re-registers AccountManager listeners and DOM click handlers without unbinding.'
      );
    } else {
      recordTest('STRESS-1.2', 'ForumApp.init() missing idempotency guard (F17 defect)', true);
    }
  } catch (err) {
    recordTest('STRESS-1.2', 'ForumApp.init() missing idempotency guard (F17 defect)', false, err.message);
  }

  // Test 1.3: Rapid chaotic view switching (500 transitions across all 5 views)
  try {
    const ctx = createChallengeContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    const views = ['hub', 'reader', 'chat', 'forum', 'notes'];
    let errorOccurred = null;

    for (let i = 0; i < 500; i++) {
      const targetView = views[i % views.length];
      try {
        ctx.window.switchMainView(targetView);
      } catch (e) {
        errorOccurred = e;
        break;
      }
    }

    if (errorOccurred) {
      recordTest('STRESS-1.3', 'Rapid chaotic 500x view switching stability', false, errorOccurred.message);
    } else {
      const activeViews = ctx.document.querySelectorAll('.app-view.active');
      assertEqual(activeViews.length, 1, 'Exactly one view must be active');
      recordTest('STRESS-1.3', 'Rapid chaotic 500x view switching stability', true);
    }
  } catch (err) {
    recordTest('STRESS-1.3', 'Rapid chaotic 500x view switching stability', false, err.message);
  }

  // Test 1.4: ChatApp idempotency under rapid switching
  try {
    const ctx = createChallengeContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    for (let i = 0; i < 10; i++) {
      ctx.window.switchMainView('hub');
      ctx.window.switchMainView('chat');
    }

    const chatSendBtn = ctx.document.getElementById('chat-send-btn');
    const sendListeners = (chatSendBtn._eventListeners['click'] || []).length;
    assertEqual(sendListeners, 1, 'ChatApp click listeners should not duplicate');
    recordTest('STRESS-1.4', 'ChatApp.init() idempotency under repeated switching', true);
  } catch (err) {
    recordTest('STRESS-1.4', 'ChatApp.init() idempotency under repeated switching', false, err.message);
  }

  // Test 1.5: Scratchpad data clobber on view switch during debounce window
  try {
    const ctx = createChallengeContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    const noteArea = ctx.document.getElementById('scratchpad-text');
    noteArea.value = 'Unsaved draft text in scratchpad';
    noteArea.dispatchEvent({ type: 'input', target: noteArea });

    // Switch view to notes (invokes initNotes()) before debounce timer (300ms) fires
    ctx.window.switchMainView('hub');
    ctx.window.switchMainView('notes');

    const noteAreaValueAfterSwitch = noteArea.value;

    if (noteAreaValueAfterSwitch !== 'Unsaved draft text in scratchpad') {
      recordTest(
        'STRESS-1.5',
        'Data loss: initNotes() clobbers unsaved user input on view switch',
        false,
        `DATA LOSS BUG: User typed draft was clobbered by initNotes() on view switch! Expected "Unsaved draft text in scratchpad", got "${noteAreaValueAfterSwitch}".`
      );
    } else {
      recordTest('STRESS-1.5', 'Scratchpad draft preserved across view switch', true);
    }
  } catch (err) {
    recordTest('STRESS-1.5', 'Scratchpad data clobber test', false, err.message);
  }


  // -------------------------------------------------------------------------
  // AREA 2: RAPID CHAPTER SEARCH FILTERING & DEBOUNCING
  // -------------------------------------------------------------------------
  console.log('\n--- AREA 2: Rapid Chapter Search Filtering & Debouncing ---');

  // Test 2.1: Debounce coalescing under 50 rapid keystrokes
  try {
    const ctx = createChallengeContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    const searchInput = ctx.document.getElementById('search-input');
    let renderCount = 0;
    const origRender = ctx.window.renderChapterCatalog;
    ctx.window.renderChapterCatalog = function(...args) {
      renderCount++;
      return origRender.apply(this, args);
    };

    // Burst 50 keystrokes at 2ms intervals
    for (let i = 1; i <= 50; i++) {
      searchInput.value = 'ch ' + i;
      searchInput.dispatchEvent({ type: 'input', target: searchInput });
      await sleep(2);
    }

    const countDuringBurst = renderCount;
    await sleep(220); // Wait 220ms for 180ms debounce
    const countAfterDebounce = renderCount;

    if (countAfterDebounce <= 2 && countDuringBurst === 0) {
      recordTest('STRESS-2.1', 'Chapter search debounces rapid 50-keystroke burst', true);
    } else {
      recordTest(
        'STRESS-2.1',
        'Chapter search debounces rapid 50-keystroke burst',
        false,
        `Expected <=2 renders (burst: 0, after: 1), but got burst: ${countDuringBurst}, after: ${countAfterDebounce}`
      );
    }
  } catch (err) {
    recordTest('STRESS-2.1', 'Chapter search debounces rapid 50-keystroke burst', false, err.message);
  }

  // Test 2.2: Search filter with adversarial query strings
  try {
    const ctx = createChallengeContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    const adversarialQueries = [
      '',
      '   ',
      '.*+?^${}()|[]\\\\',
      '"><script>alert(1)</script>',
      '\' OR 1=1 --',
      '宿儺',
      '🔥',
      'A'.repeat(5000),
      'undefined',
      'null',
      'NaN'
    ];

    let passedAllQueries = true;
    let failedQuery = null;

    for (const q of adversarialQueries) {
      try {
        ctx.window.renderChapterCatalog(q);
      } catch (err) {
        passedAllQueries = false;
        failedQuery = `${q}: ${err.message}`;
        break;
      }
    }

    if (passedAllQueries) {
      recordTest('STRESS-2.2', 'Chapter search handles adversarial queries safely', true);
    } else {
      recordTest('STRESS-2.2', 'Chapter search handles adversarial queries safely', false, `Query failed: ${failedQuery}`);
    }
  } catch (err) {
    recordTest('STRESS-2.2', 'Chapter search handles adversarial queries safely', false, err.message);
  }

  // Test 2.3: Chapter data edge case: missing or null title/number
  try {
    const ctx = createChallengeContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    const currentList = ctx.window.getAllChapters();
    ctx.window.setAllChapters([...currentList, { number: 999, title: null, pages: [] }]);

    let crashed = false;
    let crashMsg = '';
    try {
      ctx.window.renderChapterCatalog('test');
    } catch (e) {
      crashed = true;
      crashMsg = e.message;
    }

    ctx.window.setAllChapters(currentList);

    if (crashed) {
      recordTest(
        'STRESS-2.3',
        'renderChapterCatalog crashes on null chapter title (Robustness gap)',
        false,
        `VULNERABILITY: c.title.toLowerCase() threw unhandled TypeError: ${crashMsg}`
      );
    } else {
      recordTest('STRESS-2.3', 'renderChapterCatalog handles null chapter title', true);
    }
  } catch (err) {
    recordTest('STRESS-2.3', 'renderChapterCatalog robustness on corrupted chapter data', false, err.message);
  }

  // Test 2.4: XSS injection in Chapter Catalog item rendering
  try {
    const ctx = createChallengeContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    const maliciousTitle = '<img src="x" onerror="window.__catalog_xss=1">';
    const currentList = ctx.window.getAllChapters();
    ctx.window.setAllChapters([{ number: 9999, title: maliciousTitle, pages: [] }, ...currentList]);

    ctx.window.renderChapterCatalog('');

    const chapterList = ctx.document.getElementById('chapter-list');
    const innerHtml = chapterList.innerHTML;
    const imgInCatalog = chapterList.querySelector('img[onerror]');

    ctx.window.setAllChapters(currentList);

    if (imgInCatalog || innerHtml.includes('<img src="x" onerror=')) {
      recordTest(
        'STRESS-2.4',
        'Stored XSS in Chapter Catalog rendering (app.js:242)',
        false,
        'SECURITY GAP: Chapter title is interpolated directly into el.innerHTML without escapeHtml(), creating active DOM elements from chapter titles.'
      );
    } else {
      recordTest('STRESS-2.4', 'Stored XSS in Chapter Catalog rendering', true);
    }
  } catch (err) {
    recordTest('STRESS-2.4', 'Stored XSS in Chapter Catalog rendering', false, err.message);
  }


  // -------------------------------------------------------------------------
  // AREA 3: STANDALONE READER HTML GENERATION STRESS TESTS
  // -------------------------------------------------------------------------
  console.log('\n--- AREA 3: Standalone Reader HTML Generation Stress Tests ---');

  // Test 3.1: Embedded JSON script breakout attack
  try {
    const ctx = createChallengeContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    const originalChapters = ctx.window.getAllChapters();
    ctx.window.setAllChapters([
      {
        number: 1,
        title: '</script><script>window.__script_breakout=true;</script>',
        pages: ['https://example.com/p1.jpg']
      }
    ]);

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
    ctx.window.setAllChapters(originalChapters);

    const scriptStart = generatedHtml.indexOf('<script>');
    const scriptEnd = generatedHtml.lastIndexOf('</script>');
    const scriptContent = generatedHtml.substring(scriptStart + 8, scriptEnd);

    if (scriptContent.includes('</script>')) {
      recordTest(
        'STRESS-3.1',
        'Standalone reader JSON script breakout protection',
        false,
        'Script breakout possible! Raw "</script>" found inside standalone script tag.'
      );
    } else {
      recordTest('STRESS-3.1', 'Standalone reader JSON script breakout protection', true);
    }
  } catch (err) {
    recordTest('STRESS-3.1', 'Standalone reader JSON script breakout protection', false, err.message);
  }

  // Test 3.2: Stored XSS inside standalone reader template renderList
  try {
    const ctx = createChallengeContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    const xssPayload = '<img src=x onerror=window.__standalone_xss=1>';
    const originalChapters = ctx.window.getAllChapters();
    ctx.window.setAllChapters([
      {
        number: 1,
        title: xssPayload,
        pages: ['https://example.com/p1.jpg']
      }
    ]);

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
    ctx.window.setAllChapters(originalChapters);

    // Look at renderList in generatedHtml
    const hasUnescapedTitleConcat = /item\.innerHTML\s*=\s*['"]<span class="ch-badge">#['"]\s*\+\s*ch\.number\s*\+\s*['"].*?\+\s*ch\.title\s*\+\s*['"]<\/span>['"]/.test(generatedHtml);

    if (hasUnescapedTitleConcat) {
      recordTest(
        'STRESS-3.2',
        'Stored XSS in Standalone Reader template renderList()',
        false,
        'SECURITY GAP: Standalone reader template concatenates ch.title directly into item.innerHTML without escaping. If chapter metadata contains HTML/scripts, XSS executes in exported file.'
      );
    } else {
      recordTest('STRESS-3.2', 'Stored XSS in Standalone Reader template renderList()', true);
    }
  } catch (err) {
    recordTest('STRESS-3.2', 'Stored XSS in Standalone Reader template renderList()', false, err.message);
  }

  // Test 3.3: Quotes and edge cases in chapter title and pages
  try {
    const ctx = createChallengeContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

    const edgeCaseChapters = [
      {
        number: 1.5,
        title: 'Chapter "Sukuna\'s" `Domain` & <Expansion>',
        pages: ['https://example.com/page\'1".jpg', '']
      }
    ];

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

    const originalChapters = ctx.window.getAllChapters();
    ctx.window.setAllChapters(edgeCaseChapters);
    ctx.window.generatePortableReaderHtml();
    ctx.window.setAllChapters(originalChapters);

    const parsed = parseHTML(generatedHtml);
    assert(parsed !== null, 'Generated HTML must parse');

    recordTest('STRESS-3.3', 'Standalone reader handles complex quotes and special characters', true);
  } catch (err) {
    recordTest('STRESS-3.3', 'Standalone reader handles complex quotes and special characters', false, err.message);
  }

  // Test 3.4: Empty chapters array export behavior
  try {
    const ctx = createChallengeContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

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

    const originalChapters = ctx.window.getAllChapters();
    ctx.window.setAllChapters([]);
    ctx.window.generatePortableReaderHtml();
    ctx.window.setAllChapters(originalChapters);

    assertContains(generatedHtml, 'const CHAPTERS = [];', 'Export should contain empty array');
    recordTest('STRESS-3.4', 'Standalone reader export with empty chapters array', true);
  } catch (err) {
    recordTest('STRESS-3.4', 'Standalone reader export with empty chapters array', false, err.message);
  }


  // -------------------------------------------------------------------------
  // AREA 4: KEYBOARD SHORTCUTS SCOPING & WHEEL LISTENER
  // -------------------------------------------------------------------------
  console.log('\n--- AREA 4: Keyboard Shortcuts Scoping & Wheel Listener ---');

  // Test 4.1: Shortcuts in Hub view
  try {
    const ctx = createChallengeContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });
    ctx.window.switchMainView('hub');

    const evtSpace = { type: 'keydown', key: ' ', target: ctx.document.body, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    ctx.window.dispatchEvent(evtSpace);

    const evtD = { type: 'keydown', key: 'd', target: ctx.document.body, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    ctx.window.dispatchEvent(evtD);

    assertEqual(evtSpace.defaultPrevented, false, 'Space on Hub should not preventDefault');
    assertEqual(evtD.defaultPrevented, false, 'D on Hub should not preventDefault');
    recordTest('STRESS-4.1', 'handleKeyDown ignored in Hub view', true);
  } catch (err) {
    recordTest('STRESS-4.1', 'handleKeyDown ignored in Hub view', false, err.message);
  }

  // Test 4.2: Shortcuts in Chat view
  try {
    const ctx = createChallengeContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });
    ctx.window.switchMainView('chat');

    const evt = { type: 'keydown', key: 'ArrowRight', target: ctx.document.body, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    ctx.window.dispatchEvent(evt);

    assertEqual(evt.defaultPrevented, false, 'ArrowRight on Chat should not preventDefault');
    recordTest('STRESS-4.2', 'handleKeyDown ignored in Chat view', true);
  } catch (err) {
    recordTest('STRESS-4.2', 'handleKeyDown ignored in Chat view', false, err.message);
  }

  // Test 4.3: Shortcuts in Reader Bookmarks Subview
  try {
    const ctx = createChallengeContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });
    ctx.window.switchMainView('reader');
    ctx.window.switchReaderTab('bookmarks');

    const evt = { type: 'keydown', key: ' ', target: ctx.document.body, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    ctx.window.dispatchEvent(evt);

    assertEqual(evt.defaultPrevented, false, 'Space on Bookmarks subview should not preventDefault');
    recordTest('STRESS-4.3', 'handleKeyDown ignored in Reader Bookmarks subview', true);
  } catch (err) {
    recordTest('STRESS-4.3', 'handleKeyDown ignored in Reader Bookmarks subview', false, err.message);
  }

  // Test 4.4: Shortcuts when typing in INPUT or TEXTAREA
  try {
    const ctx = createChallengeContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });
    ctx.window.switchMainView('reader');
    ctx.window.switchReaderTab('reader');

    const searchInput = ctx.document.getElementById('search-input');
    const evt = { type: 'keydown', key: ' ', target: searchInput, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    ctx.window.dispatchEvent(evt);

    assertEqual(evt.defaultPrevented, false, 'Space while focused on input should not trigger reader pagination');
    recordTest('STRESS-4.4', 'handleKeyDown ignored when typing in INPUT fields', true);
  } catch (err) {
    recordTest('STRESS-4.4', 'handleKeyDown ignored when typing in INPUT fields', false, err.message);
  }

  // Test 4.5: Shortcuts when navigating SELECT element
  try {
    const ctx = createChallengeContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });
    ctx.window.switchMainView('reader');
    ctx.window.switchReaderTab('reader');

    const selectEl = ctx.document.getElementById('header-ch-select');
    const evt = { type: 'keydown', key: ' ', target: selectEl, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    ctx.window.dispatchEvent(evt);

    if (evt.defaultPrevented) {
      recordTest(
        'STRESS-4.5',
        'handleKeyDown interferes with SELECT dropdown navigation',
        false,
        'EDGE CASE: e.target.tagName is SELECT; handleKeyDown checks only INPUT and TEXTAREA, so pressing Space in chapter dropdown flips pages instead of opening dropdown.'
      );
    } else {
      recordTest('STRESS-4.5', 'handleKeyDown does not interfere with SELECT dropdown', true);
    }
  } catch (err) {
    recordTest('STRESS-4.5', 'handleKeyDown SELECT dropdown check', false, err.message);
  }

  // Test 4.6: Global Wheel Listener scoping
  try {
    const ctx = createChallengeContext();
    ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });
    ctx.window.switchMainView('chat');

    const initialZoom = ctx.window.getZoomFactor();
    const evtWheel = {
      type: 'wheel',
      ctrlKey: true,
      deltaY: -100,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }
    };

    ctx.document.dispatchEvent(evtWheel);

    const postZoom = ctx.window.getZoomFactor();

    if (evtWheel.defaultPrevented || postZoom !== initialZoom) {
      recordTest(
        'STRESS-4.6',
        'handleWheel global side-effect under non-reader views',
        false,
        `LEAKED LISTENER: handleWheel attaches globally to window without active-view check. While on Chat, Ctrl+Wheel called preventDefault() and changed manga zoom from ${initialZoom} to ${postZoom}.`
      );
    } else {
      recordTest('STRESS-4.6', 'handleWheel scoped properly', true);
    }
  } catch (err) {
    recordTest('STRESS-4.6', 'handleWheel global side-effect check', false, err.message);
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log('STRESS TEST SUITE SUMMARY');
  console.log('======================================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Total Stress Tests: ${total}`);
  console.log(`Passed            : ${passed}`);
  console.log(`Failed / Bugs     : ${failed}`);
  console.log(`Pass Rate         : ${Math.round((passed / total) * 100)}%\n`);

  if (failed > 0) {
    console.log('DEFECTS & VULNERABILITIES IDENTIFIED:');
    results.filter(r => !r.passed).forEach((r, idx) => {
      console.log(`  ${idx + 1}. [${r.id}] ${r.name}`);
      console.log(`     Detail: ${r.details}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

runSuite().catch(err => {
  console.error(err);
  process.exit(1);
});
