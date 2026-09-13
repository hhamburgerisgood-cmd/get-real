const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('==================================================');
console.log('VERIFICATION SUITE: Milestone M4 Runtime & Perf');
console.log('==================================================\n');

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error('       Error:', err.message);
  }
}

const appJs = fs.readFileSync(path.resolve(__dirname, '../../app.js'), 'utf8');
const chatJs = fs.readFileSync(path.resolve(__dirname, '../../chat.js'), 'utf8');

// Test 1: setupEventListeners is never called in app.js
test('1. setupEventListeners() is no longer called in app.js', () => {
  assert.strictEqual(/setupEventListeners\s*\(/.test(appJs), false, 'setupEventListeners() should not be called');
});

// Test 2: updateBookmarkCountBadge is never called in app.js
test('2. updateBookmarkCountBadge() is no longer called in app.js', () => {
  assert.strictEqual(/updateBookmarkCountBadge\s*\(/.test(appJs), false, 'updateBookmarkCountBadge() should not be called');
});

// Test 3: setupReaderControls and updateBookmarksBadge exist and are called in DOMContentLoaded
test('3. setupReaderControls() and updateBookmarksBadge() are called in DOMContentLoaded', () => {
  assert.ok(/setupReaderControls\s*\(/.test(appJs), 'setupReaderControls must be called');
  assert.ok(/updateBookmarksBadge\s*\(/.test(appJs), 'updateBookmarksBadge must be called');
  assert.ok(appJs.includes('function setupReaderControls('), 'setupReaderControls must be declared');
  assert.ok(appJs.includes('function updateBookmarksBadge('), 'updateBookmarksBadge must be declared');
});

// Test 4: debounce utility exists in app.js
test('4. debounce utility is defined in app.js', () => {
  assert.ok(appJs.includes('function debounce('), 'debounce function must be declared in app.js');
});

// Test 5: Scratchpad auto-save is debounced
test('5. Scratchpad auto-save listener uses debounce', () => {
  assert.ok(appJs.includes("noteArea.addEventListener('input', debounce("), 'noteArea input listener must be debounced');
});

// Test 6: Search input is debounced in setupReaderControls
test('6. Search input listener uses debounce in setupReaderControls', () => {
  assert.ok(/searchInput\.addEventListener\('input',\s*debounce\(/.test(appJs), 'searchInput input listener must be debounced');
});

// Test 7: Resize listener is debounced
test('7. Window resize event listener is debounced', () => {
  assert.ok(/window\.addEventListener\('resize',\s*debounce\(/.test(appJs), 'window resize listener must be debounced');
});

// Test 8: Chapter 1 auto-load exists
test('8. First chapter auto-loads on startup', () => {
  assert.ok(appJs.includes('selectChapter(allChapters[0], 0)'), 'selectChapter(allChapters[0], 0) must be called');
});

// Test 9: handleKeyDown is scoped to reader view & subview with preventDefault
test('9. handleKeyDown is scoped to reader view and prevents default spacebar scroll', () => {
  assert.ok(appJs.includes("document.getElementById('view-reader')"), 'Must check view-reader element');
  assert.ok(appJs.includes("document.getElementById('rsub-reader')"), 'Must check rsub-reader element');
  assert.ok(appJs.includes("!readerView.classList.contains('active')"), 'Must check readerView active class');
  assert.ok(appJs.includes("!readerSub.classList.contains('active')"), 'Must check readerSub active class');
  assert.ok(/e\.key === ' '[\s\S]*?e\.preventDefault\(\)/.test(appJs), 'Spacebar must call preventDefault()');
});

// Test 10: updateCatalogSelection updates selected class on chapter item
test('10. Chapter catalog item selection updates active class', () => {
  assert.ok(appJs.includes('function updateCatalogSelection()'), 'updateCatalogSelection function must exist');
  assert.ok(appJs.includes('data-chapter-number'), 'data-chapter-number must be set on chapter items');
  assert.ok(appJs.includes('el.classList.add(\'selected\')'), 'Active chapter must receive selected class');
  assert.ok(appJs.includes('el.classList.remove(\'selected\')'), 'Non-active chapters must have selected class removed');
  assert.ok(/selectChapter[\s\S]*?updateCatalogSelection\(\)/.test(appJs), 'selectChapter must call updateCatalogSelection');
});

// Test 11: Reader image loading optimization (decoding async, preload, DocumentFragment)
test('11. Reader images optimized with async decoding, preloading, and DocumentFragment', () => {
  assert.ok(appJs.includes("img.setAttribute('decoding', 'async')"), 'Continuous images must set decoding="async"');
  assert.ok(appJs.includes("imgEl.setAttribute('decoding', 'async')"), 'Single-page image must set decoding="async"');
  assert.ok(appJs.includes('function preloadAdjacentPages()'), 'preloadAdjacentPages must be implemented');
  assert.ok(appJs.includes('document.createDocumentFragment()'), 'Continuous mode must use DocumentFragment');
  assert.ok(appJs.includes('fragment.appendChild(img)'), 'Images appended to fragment before container');
});

// Test 12: Standalone reader export fixes
test('12. Standalone reader export escapes JSON, wires button, and preserves search filter', () => {
  assert.ok(appJs.includes("JSON.stringify(allChapters).replace(/</g, '\\\\u003c')") || appJs.includes("JSON.stringify(allChapters).replace(/</g, '\\u003c')"), 'JSON must be escaped for < script tags');
  assert.ok(appJs.includes("document.getElementById('btn-generate-standalone-reader')?.addEventListener('click', generatePortableReaderHtml)"), 'Export button must be wired in setupReaderControls');
  assert.ok(appJs.includes('search-ch'), 'Standalone reader must query search-ch in loadChapter');
  assert.ok(/loadChapter[\s\S]*?searchInput[\s\S]*?CHAPTERS\.filter/.test(appJs), 'Standalone loadChapter must preserve search query filter');
});

// Test 13: chat.js layout thrashing elimination and incremental append
test('13. ChatApp eliminates layout thrashing via appendSingleMessage, rAF, and DocumentFragment', () => {
  assert.ok(chatJs.includes('function appendSingleMessage('), 'appendSingleMessage must be implemented');
  assert.ok(chatJs.includes('function createMessageElement('), 'createMessageElement must be implemented');
  assert.ok(chatJs.includes('requestAnimationFrame'), 'Scrolling must be wrapped in requestAnimationFrame');
  assert.ok(chatJs.includes('document.createDocumentFragment()'), 'renderMessages must use DocumentFragment');
  assert.ok(/saveMessage[\s\S]*?appendSingleMessage\(msg\)/.test(chatJs), 'saveMessage must call appendSingleMessage instead of full re-render');
  assert.ok(chatJs.includes('isInitialized = true'), 'ChatApp.init must guard against duplicate listeners via isInitialized');
  assert.ok(/appendSingleMessage/.test(chatJs), 'ChatApp must export appendSingleMessage');
});

// Test 14: Debounce runtime behavior test
test('14. Debounce utility delays execution and coalesces rapid invocations', (done) => {
  let counter = 0;
  // Extract debounce definition from appJs and evaluate
  const debounceMatch = appJs.match(/function debounce\(fn, delay = 200\) {[\s\S]*?^}/m);
  assert.ok(debounceMatch, 'Debounce function code matched');
  const fnDebounce = new Function(`return (${debounceMatch[0]})`)();
  
  const debounced = fnDebounce((val) => {
    counter += val;
  }, 50);

  debounced(1);
  debounced(2);
  debounced(3);

  assert.strictEqual(counter, 0, 'Counter must be 0 immediately after synchronous calls');

  setTimeout(() => {
    assert.strictEqual(counter, 3, 'Counter must be 3 after delay (only last call executed)');
  }, 100);
});

console.log(`\nResults: ${passedTests} / ${totalTests} passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
} else {
  console.log('All Milestone M4 verification tests PASSED!\n');
}
