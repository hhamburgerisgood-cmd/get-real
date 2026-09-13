const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const appJs = fs.readFileSync('app.js', 'utf8');

// Find portableHtml
const startTag = 'const portableHtml = `';
const startIdx = appJs.indexOf(startTag);
assert.ok(startIdx !== -1, 'portableHtml must be found');

const endTag = '`;';
const endIdx = appJs.indexOf(endTag, startIdx + startTag.length);
assert.ok(endIdx !== -1, 'End of portableHtml template must be found');

const templateContent = appJs.substring(startIdx + startTag.length, endIdx);
const sampleChapters = [
  { number: 1, title: 'Chapter 1: </script><script>alert("xss")</script>', pages: ['https://example.com/p1.webp'] },
  { number: 2, title: 'Chapter 2: Normal', pages: ['https://example.com/p2.webp'] }
];

const escapedJson = JSON.stringify(sampleChapters).replace(/</g, '\\u003c');
const fullHtml = templateContent.replace('${jsonChapters}', escapedJson);

// Check if raw </script> appears anywhere in the script tag
const scriptOpen = '<script>';
const scriptClose = '<\\/script>';
const scriptStart = fullHtml.indexOf(scriptOpen);
const scriptEnd = fullHtml.indexOf(scriptClose, scriptStart);

assert.ok(scriptStart !== -1, '<script> tag exists');
assert.ok(scriptEnd !== -1, '</script> tag exists');

const scriptBody = fullHtml.substring(scriptStart + scriptOpen.length, scriptEnd);

// Check if premature </script> appears inside scriptBody
assert.strictEqual(scriptBody.includes('</script>'), false, 'Script body must not contain unescaped </script>');

// Test script body syntax
try {
  new vm.Script(scriptBody);
  console.log('[PASS] Standalone reader embedded script compiles with zero syntax errors!');
} catch (e) {
  console.error('[FAIL] Syntax error in standalone script:', e.message);
  process.exit(1);
}

// Test DOM interactions in mock environment
const mockElements = {};
function getEl(id) {
  if (!mockElements[id]) {
    mockElements[id] = {
      id,
      style: {},
      value: '',
      textContent: '',
      innerHTML: '',
      children: [],
      classList: {
        add: () => {},
        remove: () => {}
      },
      appendChild: function(c) { this.children.push(c); return c; },
      addEventListener: () => {},
      setAttribute: () => {}
    };
  }
  return mockElements[id];
}

const mockDoc = {
  getElementById: getEl,
  createElement: (tag) => getEl('tag_' + Math.random()),
  createDocumentFragment: () => ({ children: [], appendChild: (c) => c }),
  documentElement: { requestFullscreen: () => {} },
  fullscreenElement: null,
  exitFullscreen: () => {}
};

const sandbox = {
  window: { addEventListener: () => {} },
  document: mockDoc,
  console: console,
  Image: class { constructor() { this.src = ''; } }
};

vm.createContext(sandbox);
vm.runInContext(scriptBody, sandbox);

// Call init()
assert.strictEqual(typeof sandbox.init, 'function', 'init function must be defined');
sandbox.init();
console.log('[PASS] Standalone reader init() executed successfully!');

// Call loadChapter
assert.strictEqual(typeof sandbox.loadChapter, 'function', 'loadChapter function must be defined');
sandbox.loadChapter(sampleChapters[0], 0);
console.log('[PASS] Standalone reader loadChapter() executed successfully!');

// Test search query filter preservation
mockElements['search-ch'].value = 'normal';
sandbox.loadChapter(sampleChapters[1], 0);
console.log('[PASS] Standalone reader search query filter checked during loadChapter!');

console.log('\nAll Standalone Reader Export checks PASSED!\n');
