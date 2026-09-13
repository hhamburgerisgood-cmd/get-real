const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

// Simple DOM element mock
class MockElement {
  constructor(id, tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      contains: (c) => this.classList._classes.has(c)
    };
  }
}

const elements = {
  'view-hub': new MockElement('view-hub'),
  'view-reader': new MockElement('view-reader'),
  'view-chat': new MockElement('view-chat'),
  'view-forum': new MockElement('view-forum'),
  'view-notes': new MockElement('view-notes'),
  'rsub-reader': new MockElement('rsub-reader'),
  'rsub-bookmarks': new MockElement('rsub-bookmarks')
};

const windowListeners = {};
const mockWindow = {
  addEventListener: (ev, fn) => {
    if (!windowListeners[ev]) windowListeners[ev] = [];
    windowListeners[ev].push(fn);
  }
};

const mockDoc = {
  getElementById: (id) => elements[id] || null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};

let nextPageCalled = false;
let prevPageCalled = false;
let toggleFullscreenCalled = false;
let addCurrentBookmarkCalled = false;

const sandbox = {
  window: mockWindow,
  document: mockDoc,
  isContinuous: false,
  nextPage: () => { nextPageCalled = true; },
  prevPage: () => { prevPageCalled = true; },
  toggleFullscreen: () => { toggleFullscreenCalled = true; },
  addCurrentBookmark: () => { addCurrentBookmarkCalled = true; },
  console: console
};

vm.createContext(sandbox);

// Extract handleKeyDown from app.js
const appJs = fs.readFileSync('app.js', 'utf8');
const match = appJs.match(/function handleKeyDown\(e\) {[\s\S]*?\n}/);
assert.ok(match, 'handleKeyDown must be defined');

vm.runInContext(match[0], sandbox);

function resetFlags() {
  nextPageCalled = false;
  prevPageCalled = false;
  toggleFullscreenCalled = false;
  addCurrentBookmarkCalled = false;
}

function fireKey(key, options = {}) {
  resetFlags();
  let defaultPrevented = false;
  const event = {
    key,
    target: options.target || new MockElement('body'),
    shiftKey: !!options.shiftKey,
    ctrlKey: !!options.ctrlKey,
    metaKey: !!options.metaKey,
    preventDefault: () => { defaultPrevented = true; }
  };
  sandbox.handleKeyDown(event);
  return { defaultPrevented };
}

// 1. Test when view-reader is NOT active (e.g. on Hub, Chat, Forum, Notes)
elements['view-reader'].classList.remove('active');
elements['rsub-reader'].classList.remove('active');

[' ', 'ArrowRight', 'ArrowLeft', 'd', 'a', 'f', 'b'].forEach(key => {
  const res = fireKey(key, { ctrlKey: key === 'b' });
  assert.strictEqual(res.defaultPrevented, false, `Default should not be prevented for ${key} when reader is inactive`);
  assert.strictEqual(nextPageCalled, false, `nextPage should not be called for ${key} when reader is inactive`);
  assert.strictEqual(prevPageCalled, false, `prevPage should not be called for ${key} when reader is inactive`);
  assert.strictEqual(toggleFullscreenCalled, false, `toggleFullscreen should not be called for ${key} when reader is inactive`);
  assert.strictEqual(addCurrentBookmarkCalled, false, `addCurrentBookmark should not be called for ${key} when reader is inactive`);
});
console.log('[PASS] Hub/Chat/Forum/Notes views completely unaffected by keyboard shortcuts');

// 2. Test when view-reader is active but rsub-reader is NOT active (e.g. on Bookmarks tab)
elements['view-reader'].classList.add('active');
elements['rsub-reader'].classList.remove('active');

const resBookmarks = fireKey(' ');
assert.strictEqual(resBookmarks.defaultPrevented, false, 'Default not prevented on bookmarks tab');
assert.strictEqual(nextPageCalled, false, 'nextPage not called on bookmarks tab');
console.log('[PASS] Reader Bookmarks sub-tab unaffected by reader keyboard shortcuts');

// 3. Test when inside input or textarea inside active reader
elements['rsub-reader'].classList.add('active');
const inputTarget = new MockElement('search-input', 'input');
const resInput = fireKey(' ', { target: inputTarget });
assert.strictEqual(resInput.defaultPrevented, false, 'Default not prevented when focused on input');
assert.strictEqual(nextPageCalled, false, 'nextPage not called when focused on input');
console.log('[PASS] Input/Textarea fields unaffected by reader keyboard shortcuts');

// 4. Test active reader view key handling
// Space -> nextPage
const resSpace = fireKey(' ');
assert.strictEqual(resSpace.defaultPrevented, true, 'Space must preventDefault in reader');
assert.strictEqual(nextPageCalled, true, 'Space must advance page');

// Shift+Space -> prevPage
const resShiftSpace = fireKey(' ', { shiftKey: true });
assert.strictEqual(resShiftSpace.defaultPrevented, true, 'Shift+Space must preventDefault in reader');
assert.strictEqual(prevPageCalled, true, 'Shift+Space must go to prev page');

// ArrowRight -> nextPage
const resArrowR = fireKey('ArrowRight');
assert.strictEqual(resArrowR.defaultPrevented, true);
assert.strictEqual(nextPageCalled, true);

// ArrowLeft -> prevPage
const resArrowL = fireKey('ArrowLeft');
assert.strictEqual(resArrowL.defaultPrevented, true);
assert.strictEqual(prevPageCalled, true);

// 'f' -> toggleFullscreen
const resF = fireKey('f');
assert.strictEqual(resF.defaultPrevented, true);
assert.strictEqual(toggleFullscreenCalled, true);

// Ctrl+b -> addCurrentBookmark
const resCtrlB = fireKey('b', { ctrlKey: true });
assert.strictEqual(resCtrlB.defaultPrevented, true);
assert.strictEqual(addCurrentBookmarkCalled, true);

// Continuous mode spacebar: should NOT flip page and should NOT preventDefault (allows browser scrolling)
sandbox.isContinuous = true;
const resContSpace = fireKey(' ');
assert.strictEqual(resContSpace.defaultPrevented, false, 'Continuous mode spacebar must not prevent default scroll');
assert.strictEqual(nextPageCalled, false, 'Continuous mode spacebar must not flip page');

console.log('[PASS] Active reader navigation key handlers work as intended');
console.log('\nAll keyboard shortcut tests PASSED!\n');
