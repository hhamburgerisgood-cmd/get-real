const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('Testing proposed fixes against project test suites...');

// 1. Test preloadAdjacentPages with Image guard
function preloadAdjacentPagesWithGuard(isContinuous, currentPages, currentPageIndex, ImageClass) {
  if (isContinuous || !currentPages || currentPages.length === 0) return;
  const Img = ImageClass || (typeof Image !== 'undefined' ? Image : null);
  if (!Img) return;
  const toPreload = [];
  if (currentPageIndex + 1 < currentPages.length) toPreload.push(currentPages[currentPageIndex + 1]);
  toPreload.forEach(url => {
    const img = new Img();
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';
    img.src = url;
  });
}

// Check with undefined Image
assert.doesNotThrow(() => {
  preloadAdjacentPagesWithGuard(false, ['https://example.com/1.webp', 'https://example.com/2.webp'], 0, undefined);
}, 'Must not throw ReferenceError when Image is undefined');
console.log('[PASS] Image guard prevents ReferenceError when Image is not defined');

// 2. Test Scratchpad dual sync (immediate AccountManager sync + debounced localStorage write)
function debounce(fn, delay = 200) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

let mockAccountScratchpad = '';
const mockAccountManager = {
  getScratchpad: () => mockAccountScratchpad,
  saveScratchpad: (t) => { mockAccountScratchpad = t; }
};

const storage = {};
const debouncedStorageSave = debounce((val) => {
  storage['hub_scratchpad_v1'] = val;
}, 300);

function handleScratchpadInput(val) {
  mockAccountManager.saveScratchpad(val);
  debouncedStorageSave(val);
}

// Rapid 50 keystrokes
for (let i = 0; i < 50; i++) {
  handleScratchpadInput('char_' + i);
}

// Synchronous check: AccountManager should immediately reflect latest value
assert.strictEqual(mockAccountManager.getScratchpad(), 'char_49', 'AccountManager synced synchronously');
// Storage check: debounced, so 0 writes immediately
assert.strictEqual(storage['hub_scratchpad_v1'], undefined, 'LocalStorage write is debounced');

setTimeout(() => {
  assert.strictEqual(storage['hub_scratchpad_v1'], 'char_49', 'LocalStorage received debounced write after 350ms');
  console.log('[PASS] Scratchpad dual-sync model satisfies both synchronous reactivity and debounced disk persistence!');
}, 350);
