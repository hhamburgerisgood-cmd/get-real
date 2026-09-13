const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

class MockElement {
  constructor(id, tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.style = { cssText: '' };
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => {
        this.classList._classes.delete(c);
        if (this.className) this.className = this.className.replace(new RegExp('\\b' + c + '\\b', 'g'), '').trim();
      },
      contains: (c) => this.classList._classes.has(c) || (this.className && new RegExp('\\b' + c + '\\b').test(this.className))
    };
    this.attrs = {};
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] || null; }
  addEventListener(event, fn) {}
  appendChild(c) {
    if (c.tagName === 'FRAGMENT') {
      c.children.forEach(child => this.children.push(child));
      c.children = [];
      return c;
    }
    this.children.push(c);
    return c;
  }
  querySelectorAll(sel) {
    const res = [];
    function walk(n) {
      if (sel.includes('.chapter-item') && n.className && n.className.includes('chapter-item')) res.push(n);
      n.children.forEach(walk);
    }
    this.children.forEach(walk);
    return res;
  }
}

const chapterList = new MockElement('chapter-list');
const headerSelect = new MockElement('header-ch-select', 'select');
const statusTitle = new MockElement('status-ch-title', 'span');
const loader = new MockElement('reader-loader');

const elements = {
  'chapter-list': chapterList,
  'header-ch-select': headerSelect,
  'status-ch-title': statusTitle,
  'reader-loader': loader
};

const mockDoc = {
  getElementById: (id) => elements[id] || null,
  querySelectorAll: (sel) => {
    if (sel.startsWith('#chapter-list')) {
      return chapterList.querySelectorAll(sel);
    }
    return [];
  },
  createElement: (tag) => new MockElement('', tag),
  createDocumentFragment: () => new MockElement('', 'fragment')
};

const chapters = [
  { number: 1, title: 'Chapter 1: Sukuna', pages: ['1.jpg'] },
  { number: 2, title: 'Chapter 2: Execution', pages: ['2.jpg'] },
  { number: 3, title: 'Chapter 3: Girl of Steel', pages: ['3.jpg'] }
];

const sandbox = {
  document: mockDoc,
  allChapters: chapters,
  currentChapter: null,
  currentPageIndex: 0,
  currentPages: [],
  getSortedChapters: () => chapters,
  fetchChapterPages: async (ch) => ch.pages,
  renderPages: () => {},
  saveReadingProgress: () => {},
  console: console
};

vm.createContext(sandbox);

const appJs = fs.readFileSync('app.js', 'utf8');

// Extract renderChapterCatalog, updateCatalogSelection, selectChapter
const renderCatalogMatch = appJs.match(/function renderChapterCatalog[\s\S]*?\n}/);
const updateCatalogMatch = appJs.match(/function updateCatalogSelection[\s\S]*?\n}/);
const selectChapterMatch = appJs.match(/async function selectChapter[\s\S]*?\n}/);

assert.ok(renderCatalogMatch, 'renderChapterCatalog must exist');
assert.ok(updateCatalogMatch, 'updateCatalogSelection must exist');
assert.ok(selectChapterMatch, 'selectChapter must exist');

vm.runInContext(renderCatalogMatch[0], sandbox);
vm.runInContext(updateCatalogMatch[0], sandbox);
vm.runInContext(selectChapterMatch[0], sandbox);

// 1. Initial render without selection
sandbox.renderChapterCatalog();
assert.strictEqual(chapterList.children.length, 3, 'Must render 3 items');
assert.strictEqual(chapterList.children[0].classList.contains('selected'), false);

// 2. Select Chapter 1
sandbox.selectChapter(chapters[0], 0);
assert.strictEqual(chapterList.children[0].classList.contains('selected'), true, 'Chapter 1 must be selected');
assert.strictEqual(chapterList.children[1].classList.contains('selected'), false);
assert.strictEqual(chapterList.children[2].classList.contains('selected'), false);
console.log('[PASS] Chapter 1 marked selected on selectChapter()');

// 3. Select Chapter 2
sandbox.selectChapter(chapters[1], 0);
assert.strictEqual(chapterList.children[0].classList.contains('selected'), false, 'Chapter 1 must NOT be selected');
assert.strictEqual(chapterList.children[1].classList.contains('selected'), true, 'Chapter 2 must be selected');
assert.strictEqual(chapterList.children[2].classList.contains('selected'), false);
console.log('[PASS] Selection moved cleanly to Chapter 2');

// 4. Select Chapter 3
sandbox.selectChapter(chapters[2], 0);
assert.strictEqual(chapterList.children[1].classList.contains('selected'), false, 'Chapter 2 unselected');
assert.strictEqual(chapterList.children[2].classList.contains('selected'), true, 'Chapter 3 selected');
console.log('[PASS] Selection moved cleanly to Chapter 3');

// 5. Re-render catalog with active chapter
chapterList.children = [];
sandbox.renderChapterCatalog();
assert.strictEqual(chapterList.children[2].classList.contains('selected'), true, 'Chapter 3 maintains selected class across re-render');
console.log('[PASS] Active chapter highlighted upon catalog re-render');

console.log('\nAll catalog selection tests PASSED!\n');
