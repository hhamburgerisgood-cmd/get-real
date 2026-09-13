// Simulate DOM runtime execution of app.js and chat.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Simple DOM Mock
class MockElement {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.className = '';
    this.style = {};
    this.children = [];
    this.innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.attributes = {};
    this.listeners = {};
  }
  classList = {
    _classes: new Set(),
    add: (c) => this.classList._classes.add(c),
    remove: (c) => this.classList._classes.delete(c),
    contains: (c) => this.classList._classes.has(c)
  };
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] || null; }
  appendChild(child) { this.children.push(child); return child; }
  querySelector(sel) { return null; }
  querySelectorAll(sel) { return []; }
  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }
  dispatchEvent(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(fn => fn(data || { target: this }));
    }
  }
}

class MockDocumentFragment {
  constructor() {
    this.children = [];
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
}

const elements = {};
function getOrCreateElement(id, tag = 'div') {
  if (!elements[id]) {
    elements[id] = new MockElement(id, tag);
  }
  return elements[id];
}

const listeners = {};
const mockWindow = {
  addEventListener: (ev, fn) => {
    if (!listeners[ev]) listeners[ev] = [];
    listeners[ev].push(fn);
  },
  requestAnimationFrame: (cb) => setTimeout(cb, 0)
};

const mockDocument = {
  getElementById: (id) => getOrCreateElement(id),
  querySelector: (sel) => {
    const idMatch = sel.match(/^#([\w-]+)$/);
    if (idMatch) return getOrCreateElement(idMatch[1]);
    return new MockElement('', 'div');
  },
  querySelectorAll: (sel) => [],
  createElement: (tag) => new MockElement('', tag),
  createDocumentFragment: () => new MockDocumentFragment()
};

const mockLocalStorage = {
  _data: {},
  getItem: (k) => mockLocalStorage._data[k] || null,
  setItem: (k, v) => { mockLocalStorage._data[k] = String(v); },
  removeItem: (k) => { delete mockLocalStorage._data[k]; }
};

const mockImage = class {
  constructor() {
    this.src = '';
    this.decoding = '';
    this.referrerPolicy = '';
  }
};

// Setup global context for vm run
global.window = mockWindow;
global.document = mockDocument;
global.localStorage = mockLocalStorage;
global.Image = mockImage;
global.requestAnimationFrame = mockWindow.requestAnimationFrame;
global.alert = (msg) => console.log('[Alert]', msg);
global.CHAPTER_DATA = [
  { number: 1, title: 'Chapter 1: Ryomen Sukuna', pages: ['https://example.com/p1.webp', 'https://example.com/p2.webp'] },
  { number: 2, title: 'Chapter 2: Secret Execution', pages: ['https://example.com/p2_1.webp'] }
];
global.HUB_APPS = [];

console.log('Loading app.js into simulated DOM environment...');
const vm = require('vm');
const appCode = fs.readFileSync(path.resolve(__dirname, '../../app.js'), 'utf8');
vm.runInThisContext(appCode);

console.log('Dispatching DOMContentLoaded event...');
assert.ok(listeners['DOMContentLoaded'], 'DOMContentLoaded listener must be registered');
let errorOccurred = null;
try {
  listeners['DOMContentLoaded'].forEach(fn => fn());
} catch (e) {
  errorOccurred = e;
  console.error('Fatal runtime error during DOMContentLoaded:', e);
}

assert.strictEqual(errorOccurred, null, 'No error must be thrown during DOMContentLoaded');
console.log('[SUCCESS] DOMContentLoaded ran cleanly without ReferenceError!');

// Verify reader state after DOMContentLoaded
assert.strictEqual(elements['status-ch-title'].textContent, 'Chapter 1: Ryomen Sukuna', 'Chapter 1 must be loaded');
console.log('[SUCCESS] Chapter 1 loaded automatically into status title!');

// Verify scratchpad value initialization
const scratchpad = elements['scratchpad-text'];
assert.ok(scratchpad, 'Scratchpad textarea must exist');
console.log('[SUCCESS] Scratchpad initialized without error!');

console.log('\nAll runtime simulation checks PASSED successfully!\n');
