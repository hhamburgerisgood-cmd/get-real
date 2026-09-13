/**
 * tests/harness.js
 * Lightweight, zero-dependency browser and DOM simulation harness for Node.js.
 * Provides complete window, document, DOM elements, querySelector, events,
 * localStorage, Web Crypto, and script execution sandbox for Get Real E2E testing.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'index.html');

// Simple set of void/self-closing HTML tags
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

// Escape/Unescape utilities
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function unescapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'");
}

class DOMNode {
  constructor(nodeType, nodeName) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.parentNode = null;
    this.parentElement = null;
    this.childNodes = [];
  }

  get children() {
    return this.childNodes.filter(n => n.nodeType === 1);
  }

  get firstElementChild() {
    const ch = this.children;
    return ch.length > 0 ? ch[0] : null;
  }

  get lastElementChild() {
    const ch = this.children;
    return ch.length > 0 ? ch[ch.length - 1] : null;
  }

  get nextElementSibling() {
    if (!this.parentNode) return null;
    const siblings = this.parentNode.children;
    const idx = siblings.indexOf(this);
    return idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  }

  get previousElementSibling() {
    if (!this.parentNode) return null;
    const siblings = this.parentNode.children;
    const idx = siblings.indexOf(this);
    return idx > 0 ? siblings[idx - 1] : null;
  }

  appendChild(child) {
    if (!child) return null;
    if (child.nodeType === 11) {
      while (child.childNodes.length > 0) {
        this.appendChild(child.childNodes[0]);
      }
      return child;
    }
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    child.parentElement = this.nodeType === 1 ? this : null;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
      child.parentElement = null;
    }
    return child;
  }

  insertBefore(newChild, refChild) {
    if (!refChild) return this.appendChild(newChild);
    if (newChild.parentNode) newChild.parentNode.removeChild(newChild);
    const idx = this.childNodes.indexOf(refChild);
    if (idx === -1) return this.appendChild(newChild);
    newChild.parentNode = this;
    newChild.parentElement = this.nodeType === 1 ? this : null;
    this.childNodes.splice(idx, 0, newChild);
    return newChild;
  }

  replaceChild(newChild, oldChild) {
    this.insertBefore(newChild, oldChild);
    return this.removeChild(oldChild);
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  contains(node) {
    let curr = node;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentNode;
    }
    return false;
  }
}

class DOMTextNode extends DOMNode {
  constructor(text) {
    super(3, '#text');
    this._text = text;
  }

  get textContent() {
    return this._text;
  }

  set textContent(val) {
    this._text = String(val);
  }

  get nodeValue() {
    return this._text;
  }

  set nodeValue(val) {
    this._text = String(val);
  }

  cloneNode() {
    return new DOMTextNode(this._text);
  }
}

class DOMCommentNode extends DOMNode {
  constructor(data) {
    super(8, '#comment');
    this.data = data;
  }

  cloneNode() {
    return new DOMCommentNode(this.data);
  }
}

class DOMDocumentFragment extends DOMNode {
  constructor() {
    super(11, '#document-fragment');
  }

  querySelector(sel) {
    for (const child of this.childNodes) {
      if (child.nodeType === 1) {
        if (matchesSelector(child, sel)) return child;
        const sub = child.querySelector(sel);
        if (sub) return sub;
      }
    }
    return null;
  }

  querySelectorAll(sel) {
    const results = [];
    for (const child of this.childNodes) {
      if (child.nodeType === 1) {
        if (matchesSelector(child, sel)) results.push(child);
        results.push(...child.querySelectorAll(sel));
      }
    }
    return results;
  }
}

class ClassList {
  constructor(element) {
    this.element = element;
  }

  _getTokens() {
    const cls = this.element.getAttribute('class') || '';
    return cls.trim().split(/\s+/).filter(Boolean);
  }

  _setTokens(tokens) {
    this.element.setAttribute('class', tokens.join(' '));
  }

  add(...tokens) {
    const list = this._getTokens();
    tokens.forEach(t => {
      if (!list.includes(t)) list.push(t);
    });
    this._setTokens(list);
  }

  remove(...tokens) {
    let list = this._getTokens();
    list = list.filter(t => !tokens.includes(t));
    this._setTokens(list);
  }

  toggle(token, force) {
    const list = this._getTokens();
    const has = list.includes(token);
    const shouldAdd = force !== undefined ? Boolean(force) : !has;
    if (shouldAdd && !has) {
      list.push(token);
      this._setTokens(list);
      return true;
    } else if (!shouldAdd && has) {
      this._setTokens(list.filter(t => t !== token));
      return false;
    }
    return shouldAdd;
  }

  contains(token) {
    return this._getTokens().includes(token);
  }

  toString() {
    return this.element.getAttribute('class') || '';
  }
}

class DOMElement extends DOMNode {
  constructor(tagName) {
    super(1, tagName.toUpperCase());
    this.tagName = tagName.toUpperCase();
    this.attributes = Object.create(null);
    this._eventListeners = Object.create(null);
    this.classList = new ClassList(this);
    this._styleProxy = this._createStyleProxy();
    this._value = '';
    this._disabled = false;
    this._checked = false;
    this.dataset = {};
  }

  _createStyleProxy() {
    const self = this;
    const styleObj = {};
    return new Proxy(styleObj, {
      get(target, prop) {
        if (prop === 'cssText') {
          return self.getAttribute('style') || '';
        }
        return target[prop] || '';
      },
      set(target, prop, val) {
        if (prop === 'cssText') {
          self.setAttribute('style', val);
          target[prop] = val;
          return true;
        }
        target[prop] = val;
        // Update inline style attribute
        const css = Object.entries(target)
          .filter(([k, v]) => v && k !== 'cssText')
          .map(([k, v]) => {
            const cssKey = k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
            return `${cssKey}:${v}`;
          }).join(';');
        self.setAttribute('style', css);
        return true;
      }
    });
  }

  get style() {
    return this._styleProxy;
  }

  get id() {
    return this.getAttribute('id') || '';
  }

  set id(val) {
    this.setAttribute('id', val);
  }

  get className() {
    return this.getAttribute('class') || '';
  }

  set className(val) {
    this.setAttribute('class', val);
  }

  get src() {
    return this.getAttribute('src') || '';
  }

  set src(val) {
    this.setAttribute('src', val);
  }

  get href() {
    return this.getAttribute('href') || '';
  }

  set href(val) {
    this.setAttribute('href', val);
  }

  get title() {
    return this.getAttribute('title') || '';
  }

  set title(val) {
    this.setAttribute('title', val);
  }

  get placeholder() {
    return this.getAttribute('placeholder') || '';
  }

  set placeholder(val) {
    this.setAttribute('placeholder', val);
  }

  get type() {
    return this.getAttribute('type') || 'text';
  }

  set type(val) {
    this.setAttribute('type', val);
  }

  get value() {
    return this._value;
  }

  set value(val) {
    this._value = String(val);
  }

  get disabled() {
    return this.hasAttribute('disabled') || this._disabled;
  }

  set disabled(val) {
    this._disabled = Boolean(val);
    if (val) this.setAttribute('disabled', '');
    else this.removeAttribute('disabled');
  }

  get checked() {
    return this.hasAttribute('checked') || this._checked;
  }

  set checked(val) {
    this._checked = Boolean(val);
    if (val) this.setAttribute('checked', '');
    else this.removeAttribute('checked');
  }

  getAttribute(name) {
    const key = name.toLowerCase();
    return key in this.attributes ? this.attributes[key] : null;
  }

  setAttribute(name, value) {
    const key = name.toLowerCase();
    const strVal = String(value);
    this.attributes[key] = strVal;
    if (key.startsWith('data-')) {
      const dataKey = key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[dataKey] = strVal;
    }
    if (key === 'value') this._value = strVal;
    if (key === 'disabled') this._disabled = true;
  }

  removeAttribute(name) {
    const key = name.toLowerCase();
    delete this.attributes[key];
    if (key.startsWith('data-')) {
      const dataKey = key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      delete this.dataset[dataKey];
    }
    if (key === 'disabled') this._disabled = false;
  }

  hasAttribute(name) {
    return name.toLowerCase() in this.attributes;
  }

  // TextContent returns concatenated text nodes
  get textContent() {
    let out = '';
    for (const child of this.childNodes) {
      if (child.nodeType === 3) {
        out += child.textContent;
      } else if (child.nodeType === 1) {
        out += child.textContent;
      }
    }
    return out;
  }

  set textContent(val) {
    this.childNodes = [];
    if (val !== null && val !== undefined && val !== '') {
      this.appendChild(new DOMTextNode(String(val)));
    }
  }

  // innerHTML parses and formats
  get innerHTML() {
    return this.childNodes.map(child => serializeNode(child)).join('');
  }

  set innerHTML(htmlStr) {
    this.childNodes = [];
    if (!htmlStr) return;
    const parsedNodes = parseHTML(String(htmlStr));
    for (const n of parsedNodes) {
      this.appendChild(n);
    }
  }

  get outerHTML() {
    return serializeNode(this);
  }

  addEventListener(type, handler) {
    if (!this._eventListeners[type]) {
      this._eventListeners[type] = [];
    }
    this._eventListeners[type].push(handler);
  }

  removeEventListener(type, handler) {
    if (!this._eventListeners[type]) return;
    this._eventListeners[type] = this._eventListeners[type].filter(h => h !== handler);
  }

  dispatchEvent(event) {
    const type = typeof event === 'string' ? event : event.type;
    const evtObj = typeof event === 'string' ? { type, target: this, currentTarget: this, defaultPrevented: false, preventDefault: () => { evtObj.defaultPrevented = true; } } : event;
    if (!evtObj.target) evtObj.target = this;
    evtObj.currentTarget = this;

    // Inline handler (e.g. onclick="...")
    const inlineAttr = 'on' + type;
    const inlineCode = this.getAttribute(inlineAttr);
    if (inlineCode && typeof inlineCode === 'string') {
      try {
        // Execute inline attribute in global sandbox if available
        if (typeof globalThis !== 'undefined') {
          const fn = new Function('event', inlineCode);
          fn.call(this, evtObj);
        }
      } catch (err) {
        console.error(`Error executing inline ${inlineAttr} on <${this.tagName}>:`, err);
      }
    }

    // Registered listeners
    const handlers = this._eventListeners[type] || [];
    for (const handler of handlers) {
      try {
        if (typeof handler === 'function') {
          handler.call(this, evtObj);
        } else if (handler && typeof handler.handleEvent === 'function') {
          handler.handleEvent(evtObj);
        }
      } catch (err) {
        console.error(`Error executing ${type} event listener:`, err);
      }
    }

    // Bubble up to parent if not stopped
    if (this.parentNode && this.parentNode.dispatchEvent && !evtObj._stopProp) {
      this.parentNode.dispatchEvent(evtObj);
    }

    return !evtObj.defaultPrevented;
  }

  click() {
    this.dispatchEvent({
      type: 'click',
      target: this,
      currentTarget: this,
      bubbles: true,
      cancelable: true,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }
    });
  }

  focus() {
    this.dispatchEvent({ type: 'focus', target: this });
  }

  blur() {
    this.dispatchEvent({ type: 'blur', target: this });
  }

  scrollIntoView() {}

  getBoundingClientRect() {
    return { top: 0, left: 0, bottom: 100, right: 100, width: 100, height: 100 };
  }

  // Query selectors
  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }

  querySelectorAll(selector) {
    return querySelectorAll(this, selector);
  }

  getElementsByClassName(className) {
    return this.querySelectorAll('.' + className.trim().split(/\s+/).join('.'));
  }

  getElementsByTagName(tagName) {
    return this.querySelectorAll(tagName);
  }

  cloneNode(deep = false) {
    const clone = new DOMElement(this.tagName);
    for (const [k, v] of Object.entries(this.attributes)) {
      clone.setAttribute(k, v);
    }
    clone._value = this._value;
    clone._disabled = this._disabled;
    clone._checked = this._checked;
    if (deep) {
      for (const child of this.childNodes) {
        clone.appendChild(child.cloneNode(true));
      }
    }
    return clone;
  }
}

// Node serialization
function serializeNode(node) {
  if (node.nodeType === 3) {
    return escapeHtml(node.textContent);
  }
  if (node.nodeType === 8) {
    return `<!--${node.data}-->`;
  }
  if (node.nodeType === 1) {
    const tag = node.tagName.toLowerCase();
    const attrs = Object.entries(node.attributes).map(([k, v]) => {
      if (v === '') return k;
      return `${k}="${escapeHtml(v)}"`;
    }).join(' ');
    const attrStr = attrs.length > 0 ? ' ' + attrs : '';
    if (VOID_TAGS.has(tag)) {
      return `<${tag}${attrStr}>`;
    }
    const inner = node.childNodes.map(c => serializeNode(c)).join('');
    return `<${tag}${attrStr}>${inner}</${tag}>`;
  }
  return '';
}

// Selector matching engine
function matchesSelector(element, selector) {
  if (element.nodeType !== 1) return false;
  const sel = selector.trim();
  if (!sel) return false;

  // Multiple selectors (comma separated)
  if (sel.includes(',')) {
    return sel.split(',').some(s => matchesSelector(element, s.trim()));
  }

  // Compound selector (e.g. "button.btn.btn-pill#submit-btn[data-action='ok']")
  // Split into components: tag, #id, .class, [attr]
  const regex = /(^[a-zA-Z0-9\-*]+)|(#([a-zA-Z0-9\-_]+))|(\.([a-zA-Z0-9\-_]+))|(\[([a-zA-Z0-9\-_]+)(?:([*^$|~]?=)(['"]?)(.*?)\9)?\])/g;
  let match;
  let matchesAll = true;
  let hasRule = false;

  while ((match = regex.exec(sel)) !== null) {
    hasRule = true;
    const [full, tag, idFull, idVal, clsFull, clsVal, attrFull, attrName, attrOp, quote, attrVal] = match;

    if (tag) {
      if (tag !== '*' && element.tagName.toLowerCase() !== tag.toLowerCase()) {
        matchesAll = false;
        break;
      }
    } else if (idVal) {
      if (element.id !== idVal) {
        matchesAll = false;
        break;
      }
    } else if (clsVal) {
      if (!element.classList.contains(clsVal)) {
        matchesAll = false;
        break;
      }
    } else if (attrName) {
      if (!element.hasAttribute(attrName)) {
        matchesAll = false;
        break;
      }
      if (attrOp) {
        const val = element.getAttribute(attrName);
        if (attrOp === '=' && val !== attrVal) { matchesAll = false; break; }
        if (attrOp === '*=' && !val.includes(attrVal)) { matchesAll = false; break; }
        if (attrOp === '^=' && !val.startsWith(attrVal)) { matchesAll = false; break; }
        if (attrOp === '$=' && !val.endsWith(attrVal)) { matchesAll = false; break; }
      }
    }
  }

  return hasRule && matchesAll;
}

function querySelectorAll(root, selector) {
  const parts = selector.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [];

  // If single selector token
  if (parts.length === 1) {
    const results = [];
    function walk(node) {
      for (const child of node.childNodes) {
        if (child.nodeType === 1) {
          if (matchesSelector(child, parts[0])) {
            results.push(child);
          }
          walk(child);
        }
      }
    }
    walk(root);
    return results;
  }

  // Descendant selector (e.g. "#view-reader .reader-canvas div")
  let currentMatched = [root];
  for (const part of parts) {
    const nextMatched = [];
    for (const parent of currentMatched) {
      function findDescendants(node) {
        for (const child of node.childNodes) {
          if (child.nodeType === 1) {
            if (matchesSelector(child, part)) {
              if (!nextMatched.includes(child)) nextMatched.push(child);
            }
            findDescendants(child);
          }
        }
      }
      findDescendants(parent);
    }
    currentMatched = nextMatched;
    if (currentMatched.length === 0) break;
  }
  return currentMatched;
}

// Tokenizing HTML Parser
function parseHTML(html) {
  const results = [];
  const stack = [];

  // Tag matcher: captures tags, comments, text
  const tokenRegex = /<!--([\s\S]*?)-->|<(\/)?([a-zA-Z0-9\-:]+)((?:\s+[a-zA-Z0-9\-:_]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/)?>|([^<]+)/g;
  let match;

  while ((match = tokenRegex.exec(html)) !== null) {
    const [full, commentText, isClosing, tagName, attrString, isSelfClosing, textContent] = match;

    // 1. Comment
    if (commentText !== undefined) {
      const commentNode = new DOMCommentNode(commentText);
      if (stack.length > 0) stack[stack.length - 1].appendChild(commentNode);
      else results.push(commentNode);
      continue;
    }

    // 2. Text node
    if (textContent !== undefined) {
      const textNode = new DOMTextNode(unescapeHtml(textContent));
      if (stack.length > 0) stack[stack.length - 1].appendChild(textNode);
      else results.push(textNode);
      continue;
    }

    // 3. Closing tag
    if (isClosing) {
      const tag = tagName.toUpperCase();
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tagName === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    // 4. Opening tag
    const el = new DOMElement(tagName);
    if (attrString) {
      const attrRegex = /([a-zA-Z0-9\-:_]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let aMatch;
      while ((aMatch = attrRegex.exec(attrString)) !== null) {
        const key = aMatch[1];
        const val = aMatch[2] !== undefined ? aMatch[2] : (aMatch[3] !== undefined ? aMatch[3] : (aMatch[4] !== undefined ? aMatch[4] : ''));
        el.setAttribute(key, unescapeHtml(val));
      }
    }

    if (stack.length > 0) {
      stack[stack.length - 1].appendChild(el);
    } else {
      results.push(el);
    }

    const isVoid = VOID_TAGS.has(tagName.toLowerCase()) || isSelfClosing === '/';
    if (!isVoid) {
      stack.push(el);
    }
  }

  return results;
}

// In-Memory LocalStorage implementation
class LocalStorageMock {
  constructor() {
    this._store = new Map();
  }

  getItem(key) {
    const k = String(key);
    return this._store.has(k) ? this._store.get(k) : null;
  }

  setItem(key, val) {
    this._store.set(String(key), String(val));
  }

  removeItem(key) {
    this._store.delete(String(key));
  }

  clear() {
    this._store.clear();
  }

  get length() {
    return this._store.size;
  }

  key(index) {
    const keys = Array.from(this._store.keys());
    return index >= 0 && index < keys.length ? keys[index] : null;
  }
}

// Build standard browser environment
function createBrowserEnvironment(options = {}) {
  const htmlContent = options.html !== undefined ? options.html : fs.readFileSync(INDEX_HTML_PATH, 'utf8');
  const nodes = parseHTML(htmlContent);

  // Find documentElement (html)
  let docElement = nodes.find(n => n.nodeType === 1 && n.tagName === 'HTML');
  if (!docElement) {
    docElement = new DOMElement('html');
    for (const n of nodes) docElement.appendChild(n);
  }

  let head = docElement.querySelector('head');
  if (!head) {
    head = new DOMElement('head');
    docElement.insertBefore(head, docElement.firstElementChild);
  }

  let body = docElement.querySelector('body');
  if (!body) {
    body = new DOMElement('body');
    docElement.appendChild(body);
  }

  const localStorage = new LocalStorageMock();
  const sessionStorage = new LocalStorageMock();
  const eventListeners = Object.create(null);

  const document = {
    nodeType: 9,
    nodeName: '#document',
    documentElement: docElement,
    head,
    body,
    title: 'Get Real - Manga, Chat, Board & Stuff',
    readyState: 'complete',
    createElement(tag) {
      const el = new DOMElement(tag);
      if (tag.toLowerCase() === 'select') {
        el.options = [];
        el.selectedIndex = -1;
        el.add = function(opt) {
          el.options.push(opt);
          el.appendChild(opt);
        };
      }
      return el;
    },
    createElementNS(ns, tag) {
      return this.createElement(tag);
    },
    createDocumentFragment() {
      return new DOMDocumentFragment();
    },
    createTextNode(text) {
      return new DOMTextNode(text);
    },
    createComment(data) {
      return new DOMCommentNode(data);
    },
    getElementById(id) {
      return docElement.querySelector('#' + id);
    },
    querySelector(sel) {
      return docElement.querySelector(sel);
    },
    querySelectorAll(sel) {
      return docElement.querySelectorAll(sel);
    },
    getElementsByClassName(cls) {
      return docElement.getElementsByClassName(cls);
    },
    getElementsByTagName(tag) {
      return docElement.getElementsByTagName(tag);
    },
    addEventListener(type, handler) {
      if (!eventListeners[type]) eventListeners[type] = [];
      eventListeners[type].push(handler);
    },
    removeEventListener(type, handler) {
      if (!eventListeners[type]) return;
      eventListeners[type] = eventListeners[type].filter(h => h !== handler);
    },
    dispatchEvent(event) {
      const type = typeof event === 'string' ? event : event.type;
      const handlers = eventListeners[type] || [];
      for (const h of handlers) {
        h(event);
      }
    }
  };

  const window = {
    document,
    localStorage,
    sessionStorage,
    location: {
      href: 'http://localhost/',
      origin: 'http://localhost',
      protocol: 'http:',
      host: 'localhost',
      pathname: '/',
      search: '',
      hash: '',
      reload() {}
    },
    navigator: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
      onLine: true
    },
    crypto: globalThis.crypto,
    TextEncoder: globalThis.TextEncoder,
    TextDecoder: globalThis.TextDecoder,
    btoa: str => Buffer.from(str, 'binary').toString('base64'),
    atob: b64 => Buffer.from(b64, 'base64').toString('binary'),
    matchMedia(query) {
      return {
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {}
      };
    },
    getComputedStyle() {
      return {
        getPropertyValue: () => ''
      };
    },
    requestAnimationFrame(cb) {
      return setTimeout(cb, 0);
    },
    cancelAnimationFrame(id) {
      clearTimeout(id);
    },
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    alert: () => {},
    prompt: () => '',
    confirm: () => true,
    addEventListener(type, handler) {
      document.addEventListener(type, handler);
    },
    removeEventListener(type, handler) {
      document.removeEventListener(type, handler);
    },
    dispatchEvent(event) {
      document.dispatchEvent(event);
    }
  };

  window.window = window;
  window.self = window;
  window.top = window;
  window.parent = window;

  return { window, document, localStorage, sessionStorage };
}

// Load application scripts into sandboxed VM context
function loadApplicationContext(options = {}) {
  const env = createBrowserEnvironment(options);
  const sandbox = env.window;
  sandbox.console = console;
  sandbox.Buffer = Buffer;
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.top = sandbox;
  sandbox.parent = sandbox;

  const context = vm.createContext(sandbox);

  // Helper to execute script file from repo
  function runScript(filename) {
    const fullPath = path.join(ROOT_DIR, filename);
    if (!fs.existsSync(fullPath)) return null;
    const code = fs.readFileSync(fullPath, 'utf8');
    const bridge = `
      if (typeof ChatApp !== 'undefined' && typeof window !== 'undefined') window.ChatApp = ChatApp;
      if (typeof ForumApp !== 'undefined' && typeof window !== 'undefined') window.ForumApp = ForumApp;
      if (typeof ProfanityFilter !== 'undefined' && typeof window !== 'undefined') window.ProfanityFilter = ProfanityFilter;
      if (typeof HUB_APPS !== 'undefined' && typeof window !== 'undefined') window.HUB_APPS = HUB_APPS;
      if (typeof CHAPTER_DATA !== 'undefined' && typeof window !== 'undefined') window.CHAPTER_DATA = CHAPTER_DATA;
      if (typeof FirebaseService !== 'undefined' && typeof window !== 'undefined') window.FirebaseService = FirebaseService;
    `;
    return vm.runInContext(code + '\n' + bridge, context, { filename });
  }

  // Load scripts in dependency order
  runScript('jszip.min.js');
  runScript('profanity.js');
  runScript('theme.js');
  runScript('account.js');
  runScript('apps.js');
  runScript('chapters.js');
  runScript('chat.js');
  runScript('forum.js');
  runScript('firebase-config.js');
  runScript('app.js');

  return {
    window: context,
    document: context.document,
    localStorage: context.localStorage,
    runScript
  };
}

// Assertion library
class AssertionError extends Error {
  constructor(message, actual, expected) {
    super(message);
    this.name = 'AssertionError';
    this.actual = actual;
    this.expected = expected;
  }
}

function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new AssertionError(message, condition, true);
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    const msg = message ? `${message} (Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})` : `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
    throw new AssertionError(msg, actual, expected);
  }
}

function assertNotEqual(actual, expected, message = '') {
  if (actual === expected) {
    const msg = message ? `${message} (Expected value not to equal ${JSON.stringify(expected)})` : `Expected value not to equal ${JSON.stringify(expected)}`;
    throw new AssertionError(msg, actual, expected);
  }
}

function assertContains(haystack, needle, message = '') {
  const str = String(haystack);
  if (!str.includes(needle)) {
    const msg = message ? `${message} (Expected string to contain ${JSON.stringify(needle)})` : `Expected string to contain ${JSON.stringify(needle)}`;
    throw new AssertionError(msg, str, needle);
  }
}

function assertNotContains(haystack, needle, message = '') {
  const str = String(haystack);
  if (str.includes(needle)) {
    const msg = message ? `${message} (Expected string NOT to contain ${JSON.stringify(needle)})` : `Expected string NOT to contain ${JSON.stringify(needle)}`;
    throw new AssertionError(msg, str, needle);
  }
}

function assertMatch(str, regex, message = '') {
  if (!regex.test(str)) {
    const msg = message ? `${message} (Expected ${JSON.stringify(str)} to match ${regex})` : `Expected ${JSON.stringify(str)} to match ${regex}`;
    throw new AssertionError(msg, str, regex);
  }
}

module.exports = {
  createBrowserEnvironment,
  loadApplicationContext,
  parseHTML,
  serializeNode,
  matchesSelector,
  querySelectorAll,
  DOMElement,
  DOMNode,
  DOMTextNode,
  LocalStorageMock,
  assert,
  assertEqual,
  assertNotEqual,
  assertContains,
  assertNotContains,
  assertMatch,
  AssertionError,
  ROOT_DIR,
  INDEX_HTML_PATH
};
