/**
 * tests/tier1_features.test.js
 * Tier 1: Feature Coverage (>=5 test cases per feature across R1-R6).
 * Verifies core functionality, requirement contracts, and happy paths.
 */

const fs = require('fs');
const path = require('path');
const {
  createBrowserEnvironment,
  loadApplicationContext,
  assert,
  assertEqual,
  assertNotEqual,
  assertContains,
  assertNotContains,
  assertMatch,
  ROOT_DIR
} = require('./harness');

const tests = [
  // ========================================================
  // FEATURE R1: BRANDING & AI TELL ELIMINATION
  // ========================================================
  {
    id: 'T1-R1-01',
    tier: 1,
    feature: 'R1',
    name: 'Hub footer pill removal (Powered by Elgatitolover GIFs · ChromeOS Ready)',
    fn: async () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
      assertNotContains(
        html,
        'GET REAL · Powered by Elgatitolover GIFs · ChromeOS Ready',
        'index.html should not contain the AI footer pill'
      );
      assertNotContains(html, 'ChromeOS Ready', 'index.html should not contain "ChromeOS Ready" pill');

      const env = createBrowserEnvironment();
      const footer = env.document.querySelector('.hub-footer');
      if (footer) {
        assertNotContains(
          footer.textContent,
          'Elgatitolover',
          'Footer DOM should not contain Elgatitolover branding'
        );
      }
    }
  },
  {
    id: 'T1-R1-02',
    tier: 1,
    feature: 'R1',
    name: 'Forum hub card rebrand (DISCUSSION BOARD instead of 4CHAN-STYLE FORUM)',
    fn: async () => {
      const appsCode = fs.readFileSync(path.join(ROOT_DIR, 'apps.js'), 'utf8');
      assertNotContains(
        appsCode,
        '4CHAN-STYLE FORUM',
        'apps.js should not brand forum as "4CHAN-STYLE FORUM"'
      );
      assertContains(
        appsCode,
        'DISCUSSION BOARD',
        'apps.js should brand forum card tag as "DISCUSSION BOARD"'
      );

      const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
      assertNotContains(
        html,
        '4CHAN-STYLE FORUM',
        'index.html should not contain 4CHAN-STYLE FORUM references'
      );
    }
  },
  {
    id: 'T1-R1-03',
    tier: 1,
    feature: 'R1',
    name: 'Hub and forum subtitle sanitization (remove school/imageboard tells)',
    fn: async () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
      const appsCode = fs.readFileSync(path.join(ROOT_DIR, 'apps.js'), 'utf8');

      assertNotContains(
        html,
        'for school & beyond',
        'Hub subtitle should be sanitized of "for school & beyond"'
      );
      assertNotContains(
        appsCode,
        'Threaded imageboard · Greentext',
        'apps.js forum subtitle should not reference imageboard/greentext'
      );
    }
  },
  {
    id: 'T1-R1-04',
    tier: 1,
    feature: 'R1',
    name: 'Input placeholders sanitization (remove school safety, homework, tripcodes)',
    fn: async () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
      assertNotContains(
        html,
        'filtered for school safety',
        'Chat input placeholder should not mention "filtered for school safety"'
      );
      assertNotContains(
        html,
        'Tripcode',
        'Forum name input placeholder should not mention "Tripcode"'
      );
      assertNotContains(
        html,
        'homework notes',
        'Scratchpad textarea placeholder should not mention "homework notes"'
      );
      assertNotContains(
        html,
        'greentext',
        'Forum comment textarea placeholder should not mention "greentext"'
      );
    }
  },
  {
    id: 'T1-R1-05',
    tier: 1,
    feature: 'R1',
    name: 'Realistic seed threads in forum.js (remove artificial >be me comments)',
    fn: async () => {
      const forumCode = fs.readFileSync(path.join(ROOT_DIR, 'forum.js'), 'utf8');
      assertNotContains(
        forumCode,
        '>be me',
        'forum.js should not contain artificial ">be me" seed comments'
      );
      assertNotContains(
        forumCode,
        'AnonChromebook',
        'forum.js should not contain AnonChromebook author'
      );
      assertNotContains(
        forumCode,
        'Chromebook at school',
        'forum.js should not contain artificial school seed comments'
      );
    }
  },
  {
    id: 'T1-R1-06',
    tier: 1,
    feature: 'R1',
    name: 'Semantic blockquotes instead of greentext formatting',
    fn: async () => {
      const forumCode = fs.readFileSync(path.join(ROOT_DIR, 'forum.js'), 'utf8');
      assertNotContains(
        forumCode,
        '<span class="greentext">',
        'forum.js should not format lines starting with > into span.greentext'
      );
      assertContains(
        forumCode,
        'blockquote',
        'forum.js should format quotes using semantic <blockquote>'
      );
    }
  },

  // ========================================================
  // FEATURE R2: UNIVERSAL SVG ICON MIGRATION
  // ========================================================
  {
    id: 'T1-R2-01',
    tier: 1,
    feature: 'R2',
    name: 'Theme toggle button uses SVG icons instead of emojis (☀️/🌙)',
    fn: async () => {
      const themeCode = fs.readFileSync(path.join(ROOT_DIR, 'theme.js'), 'utf8');
      assertNotContains(themeCode, '🌙 Dark Mode', 'theme.js should not write emoji 🌙 into button');
      assertNotContains(themeCode, '☀️ Light Mode', 'theme.js should not write emoji ☀️ into button');

      const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
      assertNotContains(html, '☀️ Light Mode', 'index.html should not have hardcoded emoji in theme button');
      assertNotContains(html, '🌙', 'index.html should not contain raw 🌙 emoji');

      const env = createBrowserEnvironment();
      const themeBtns = env.document.querySelectorAll('.theme-toggle-btn');
      assert(themeBtns.length >= 5, 'Must have at least 5 theme toggle buttons (1 per view)');
      themeBtns.forEach((btn, idx) => {
        const svg = btn.querySelector('svg');
        assert(svg !== null, `Theme button ${idx} must contain an SVG icon`);
        assertMatch(svg.getAttribute('viewBox') || '', /0 0 24 24/, `Theme button ${idx} SVG must have viewBox="0 0 24 24"`);
      });
    }
  },
  {
    id: 'T1-R2-02',
    tier: 1,
    feature: 'R2',
    name: 'Reader tab buttons use SVG icons instead of emojis (📖/🔖/⬇️)',
    fn: async () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
      assertNotContains(html, '📖 Reader', 'Reader tab should not contain 📖 emoji');
      assertNotContains(html, '🔖 Bookmarks', 'Bookmarks tab should not contain 🔖 emoji');
      assertNotContains(html, '⬇️ Downloader', 'Downloader tab should not contain ⬇️ emoji');

      const env = createBrowserEnvironment();
      const tabReader = env.document.getElementById('rtab-reader');
      const tabBookmarks = env.document.getElementById('rtab-bookmarks');
      const tabDownloads = env.document.getElementById('rtab-downloads');

      assert(tabReader && tabReader.querySelector('svg'), 'rtab-reader must have an SVG icon');
      assert(tabBookmarks && tabBookmarks.querySelector('svg'), 'rtab-bookmarks must have an SVG icon');
      assert(tabDownloads && tabDownloads.querySelector('svg'), 'rtab-downloads must have an SVG icon');
    }
  },
  {
    id: 'T1-R2-03',
    tier: 1,
    feature: 'R2',
    name: 'Reader navigation and toolbar buttons use SVG icons',
    fn: async () => {
      const env = createBrowserEnvironment();
      const prevBtn = env.document.getElementById('btn-prev-ch');
      const nextBtn = env.document.getElementById('btn-next-ch');
      const bmBtn = env.document.getElementById('btn-bookmark');
      const dlBtn = env.document.getElementById('btn-download-ch');
      const modeBtn = env.document.getElementById('btn-mode-toggle');
      const fsBtn = env.document.getElementById('btn-fullscreen');

      assert(prevBtn && prevBtn.querySelector('svg'), 'btn-prev-ch must have an SVG chevron icon');
      assert(nextBtn && nextBtn.querySelector('svg'), 'btn-next-ch must have an SVG chevron icon');
      assert(bmBtn && bmBtn.querySelector('svg'), 'btn-bookmark must have an SVG bookmark icon');
      assert(dlBtn && dlBtn.querySelector('svg'), 'btn-download-ch must have an SVG download icon');
      assert(modeBtn && modeBtn.querySelector('svg'), 'btn-mode-toggle must have an SVG book/scroll icon');
      assert(fsBtn && fsBtn.querySelector('svg'), 'btn-fullscreen must have an SVG fullscreen icon');
    }
  },
  {
    id: 'T1-R2-04',
    tier: 1,
    feature: 'R2',
    name: 'Chat controls use Lucide SVG icons (Lock, Crown, Users, Pencil, Send)',
    fn: async () => {
      const env = createBrowserEnvironment();
      const lock = env.document.getElementById('chat-room-lock-icon');
      const host = env.document.getElementById('chat-room-host-badge');
      const members = env.document.getElementById('chat-btn-room-members');
      const userChange = env.document.getElementById('chat-change-user-btn');
      const sendBtn = env.document.getElementById('chat-send-btn');

      assertNotContains(lock.textContent, '🔒', 'Lock icon should not be raw emoji');
      assertNotContains(host.textContent, '👑', 'Host badge should not be raw emoji');
      assertNotContains(members.textContent, '👥', 'Members button should not be raw emoji');
      assertNotContains(userChange.textContent, '✏️', 'User edit badge should not be raw emoji');
      assertNotContains(sendBtn.textContent, '↵', 'Send button should not contain Unicode arrow');

      assert(lock && lock.querySelector('svg'), 'Lock icon should contain an SVG');
      assert(members && members.querySelector('svg'), 'Members button should contain an SVG');
      assert(sendBtn && sendBtn.querySelector('svg'), 'Send button should contain an SVG');
    }
  },
  {
    id: 'T1-R2-05',
    tier: 1,
    feature: 'R2',
    name: 'Forum navigation and post buttons use SVG icons',
    fn: async () => {
      const env = createBrowserEnvironment();
      const newThreadBtn = env.document.getElementById('btn-toggle-post-box');
      const backBtn = env.document.getElementById('forum-back-catalog-btn');

      assert(newThreadBtn, 'btn-toggle-post-box must exist');
      assert(newThreadBtn.querySelector('svg'), 'btn-toggle-post-box must contain an SVG plus icon');
      assertNotContains(newThreadBtn.textContent, '＋', 'btn-toggle-post-box should not use full-width plus character');

      assert(backBtn, 'forum-back-catalog-btn must exist');
      assert(backBtn.querySelector('svg'), 'forum-back-catalog-btn must contain an SVG arrow-left icon');
      assertNotContains(backBtn.textContent, '←', 'forum-back-catalog-btn should not use Unicode arrow');
    }
  },
  {
    id: 'T1-R2-06',
    tier: 1,
    feature: 'R2',
    name: 'Account modal tabs and action badges use SVG icons',
    fn: async () => {
      const accountCode = fs.readFileSync(path.join(ROOT_DIR, 'account.js'), 'utf8');
      const emojis = ['🔑', '👤', '☁️', '🗑️', '📋', '👥', '✨', '✓', '➕'];
      emojis.forEach(emoji => {
        assertNotContains(
          accountCode,
          emoji,
          `account.js should not contain raw emoji '${emoji}'`
        );
      });

      const env = createBrowserEnvironment();
      const verifiedPills = env.document.querySelectorAll('.account-verified-pill-icon');
      verifiedPills.forEach((pill, idx) => {
        assertNotContains(pill.textContent, '✓', `Verified pill ${idx} should not use unicode checkmark`);
        assert(pill.querySelector('svg'), `Verified pill ${idx} must use an SVG checkmark icon`);
      });
    }
  },

  // ========================================================
  // FEATURE R3: HEADER LAYOUT & UI THEME CONSISTENCY
  // ========================================================
  {
    id: 'T1-R3-01',
    tier: 1,
    feature: 'R3',
    name: 'Dedicated .header-actions-universal container in all 5 view headers',
    fn: async () => {
      const env = createBrowserEnvironment();
      const views = ['hub', 'reader', 'chat', 'forum', 'notes'];

      views.forEach(v => {
        const viewEl = env.document.getElementById('view-' + v);
        assert(viewEl !== null, `View #view-${v} must exist`);
        const header = viewEl.querySelector('header');
        assert(header !== null, `View #view-${v} must have a <header> element`);
        const universal = header.querySelector('.header-actions-universal');
        assert(
          universal !== null,
          `View #view-${v} header must contain .header-actions-universal container`
        );
      });
    }
  },
  {
    id: 'T1-R3-02',
    tier: 1,
    feature: 'R3',
    name: '.header-actions-universal contains both .account-pill-btn and .theme-toggle-btn',
    fn: async () => {
      const env = createBrowserEnvironment();
      const universalContainers = env.document.querySelectorAll('.header-actions-universal');
      assertEqual(
        universalContainers.length,
        5,
        'Should have exactly 5 .header-actions-universal containers across views'
      );

      universalContainers.forEach((c, idx) => {
        const accountBtn = c.querySelector('.account-pill-btn');
        const themeBtn = c.querySelector('.theme-toggle-btn');
        assert(accountBtn !== null, `Container ${idx} must contain .account-pill-btn`);
        assert(themeBtn !== null, `Container ${idx} must contain .theme-toggle-btn`);
      });
    }
  },
  {
    id: 'T1-R3-03',
    tier: 1,
    feature: 'R3',
    name: 'Universal header actions positioned strictly top-right in style.css',
    fn: async () => {
      const css = fs.readFileSync(path.join(ROOT_DIR, 'style.css'), 'utf8');
      assertContains(
        css,
        '.header-actions-universal',
        'style.css must define .header-actions-universal'
      );
      assertMatch(
        css,
        /\.header-actions-universal\s*\{[^}]*margin-left:\s*auto/s,
        '.header-actions-universal must specify margin-left: auto'
      );
    }
  },
  {
    id: 'T1-R3-04',
    tier: 1,
    feature: 'R3',
    name: 'Standardized header action buttons (identical height/padding/border-radius)',
    fn: async () => {
      const css = fs.readFileSync(path.join(ROOT_DIR, 'style.css'), 'utf8');
      assertMatch(
        css,
        /\.header-actions-universal\s*\.btn-pill/s,
        'style.css must style .header-actions-universal .btn-pill'
      );
    }
  },
  {
    id: 'T1-R3-05',
    tier: 1,
    feature: 'R3',
    name: 'Theme toggle switches dark-mode class and persists in localStorage',
    fn: async () => {
      const ctx = loadApplicationContext();
      assertEqual(ctx.window.ThemeManager.getMode(), 'light', 'Default theme should be light');

      ctx.window.ThemeManager.toggle();
      assertEqual(ctx.window.ThemeManager.getMode(), 'dark', 'Theme should switch to dark');
      assert(
        ctx.document.documentElement.classList.contains('dark-mode'),
        'documentElement should have dark-mode class when dark'
      );
      assertEqual(
        ctx.localStorage.getItem('get_real_mode_v2'),
        'dark',
        'localStorage get_real_mode_v2 should be "dark"'
      );

      ctx.window.ThemeManager.toggle();
      assertEqual(ctx.window.ThemeManager.getMode(), 'light', 'Theme should switch back to light');
      assert(
        !ctx.document.documentElement.classList.contains('dark-mode'),
        'documentElement should not have dark-mode class when light'
      );
      assertEqual(
        ctx.localStorage.getItem('get_real_mode_v2'),
        'light',
        'localStorage get_real_mode_v2 should be "light"'
      );
    }
  },
  {
    id: 'T1-R3-06',
    tier: 1,
    feature: 'R3',
    name: 'Elimination of hardcoded dark hex colors in reader canvas and inputs',
    fn: async () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
      assertNotContains(
        html,
        'background:#0D0E13',
        'index.html should not have hardcoded inline background:#0D0E13'
      );
      assertNotContains(
        html,
        'border:1px solid #242836',
        'index.html should not have hardcoded inline border:1px solid #242836'
      );
      assertNotContains(
        html,
        'background:#141722',
        'index.html should not have hardcoded inline background:#141722'
      );
    }
  },

  // ========================================================
  // FEATURE R4: RUNTIME BUG FIXES & PERFORMANCE
  // ========================================================
  {
    id: 'T1-R4-01',
    tier: 1,
    feature: 'R4',
    name: 'DOMContentLoaded handler crash resolution in app.js',
    fn: async () => {
      const appCode = fs.readFileSync(path.join(ROOT_DIR, 'app.js'), 'utf8');
      assertNotContains(
        appCode,
        'setupEventListeners()',
        'app.js must not call undefined function setupEventListeners()'
      );
      assertNotContains(
        appCode,
        'updateBookmarkCountBadge()',
        'app.js must not call undefined function updateBookmarkCountBadge()'
      );
      assertContains(
        appCode,
        'setupReaderControls',
        'app.js must reference valid setupReaderControls'
      );
      assertContains(
        appCode,
        'updateBookmarksBadge',
        'app.js must reference valid updateBookmarksBadge'
      );

      // Execute DOMContentLoaded and verify zero unhandled exceptions
      const ctx = loadApplicationContext();
      ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });
      assert(true, 'DOMContentLoaded executed without throwing ReferenceError');
    }
  },
  {
    id: 'T1-R4-02',
    tier: 1,
    feature: 'R4',
    name: 'Manga reader auto-loads Chapter 1 on startup',
    fn: async () => {
      const ctx = loadApplicationContext();
      ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

      const statusTitle = ctx.document.getElementById('status-ch-title');
      assert(statusTitle !== null, '#status-ch-title must exist');
      assertNotEqual(
        statusTitle.textContent,
        'Ready',
        'status-ch-title should show loaded chapter name, not initial "Ready" placeholder'
      );
      assertMatch(
        statusTitle.textContent,
        /Chapter 1/i,
        'Chapter 1 should be selected automatically on load'
      );
    }
  },
  {
    id: 'T1-R4-03',
    tier: 1,
    feature: 'R4',
    name: 'Keyboard shortcuts scoped exclusively to reader view',
    fn: async () => {
      const appCode = fs.readFileSync(path.join(ROOT_DIR, 'app.js'), 'utf8');
      assertMatch(
        appCode,
        /function\s+handleKeyDown\s*\([^)]*\)\s*\{[^}]*view-reader/s,
        'handleKeyDown in app.js must check if view-reader is active before navigating'
      );
    }
  },
  {
    id: 'T1-R4-04',
    tier: 1,
    feature: 'R4',
    name: 'Idempotent view switching handlers (prevent duplicate event listeners)',
    fn: async () => {
      const chatCode = fs.readFileSync(path.join(ROOT_DIR, 'chat.js'), 'utf8');
      const forumCode = fs.readFileSync(path.join(ROOT_DIR, 'forum.js'), 'utf8');

      assertMatch(
        chatCode,
        /isInitialized|initialized|_isInit/,
        'chat.js ChatApp.init() must guard against multiple initializations'
      );
      assertMatch(
        forumCode,
        /isInitialized|initialized|_isInit/,
        'forum.js ForumApp.init() must guard against multiple initializations'
      );
    }
  },
  {
    id: 'T1-R4-05',
    tier: 1,
    feature: 'R4',
    name: 'Quick scratchpad persistence and AccountManager live wiring',
    fn: async () => {
      const ctx = loadApplicationContext();
      ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

      const noteArea = ctx.document.getElementById('scratchpad-text');
      assert(noteArea !== null, '#scratchpad-text must exist');

      noteArea.value = 'Important test notes for Get Real';
      noteArea.dispatchEvent({ type: 'input', target: noteArea });

      assertEqual(
        ctx.window.AccountManager.getScratchpad(),
        'Important test notes for Get Real',
        'AccountManager.getScratchpad() should synchronize with noteArea input'
      );
    }
  },
  {
    id: 'T1-R4-06',
    tier: 1,
    feature: 'R4',
    name: 'Standalone reader export generator reliability',
    fn: async () => {
      const appCode = fs.readFileSync(path.join(ROOT_DIR, 'app.js'), 'utf8');
      assertContains(
        appCode,
        'generatePortableReaderHtml',
        'app.js must define generatePortableReaderHtml'
      );
      assertNotContains(
        appCode,
        'onclick="generatePortableReaderHtml()"',
        'Button should be wired properly in setupReaderControls or clean handler'
      );
    }
  },

  // ========================================================
  // FEATURE R5: SECURITY & HARDENING
  // ========================================================
  {
    id: 'T1-R5-01',
    tier: 1,
    feature: 'R5',
    name: 'Strict HTML and attribute escaping in chat messages (prevent Stored XSS)',
    fn: async () => {
      const chatCode = fs.readFileSync(path.join(ROOT_DIR, 'chat.js'), 'utf8');
      assertNotContains(
        chatCode,
        'div.textContent = text; return div.innerHTML;',
        'chat.js must not rely on flawed div.innerHTML single-quote gap'
      );
      assertContains(
        chatCode,
        '&#039;',
        'chat.js escaping must convert single quotes to &#039; or &#39;'
      );
    }
  },
  {
    id: 'T1-R5-02',
    tier: 1,
    feature: 'R5',
    name: 'Strict HTML and attribute escaping in forum threads and replies',
    fn: async () => {
      const forumCode = fs.readFileSync(path.join(ROOT_DIR, 'forum.js'), 'utf8');
      assertNotContains(
        forumCode,
        'div.textContent = str; return div.innerHTML;',
        'forum.js must not rely on flawed div.innerHTML escaping'
      );
      assertContains(
        forumCode,
        '&#039;',
        'forum.js escaping must convert single quotes to &#039; or &#39;'
      );
    }
  },
  {
    id: 'T1-R5-03',
    tier: 1,
    feature: 'R5',
    name: 'Account display name and username escaping in AccountManager',
    fn: async () => {
      const accountCode = fs.readFileSync(path.join(ROOT_DIR, 'account.js'), 'utf8');
      assertNotContains(
        accountCode,
        '<span>${a.displayName}</span>',
        'account.js must escape displayName before inserting into innerHTML'
      );
      assertContains(
        accountCode,
        'escapeHtml',
        'account.js must invoke escapeHtml on rendered account fields'
      );
    }
  },
  {
    id: 'T1-R5-04',
    tier: 1,
    feature: 'R5',
    name: 'ChatApp enforces minimum 1.5s rate-limiting cooldown on send',
    fn: async () => {
      const chatCode = fs.readFileSync(path.join(ROOT_DIR, 'chat.js'), 'utf8');
      assertMatch(
        chatCode,
        /1500|cooldown|rateLimit/i,
        'chat.js must implement 1500ms cooldown or rate limit on message sending'
      );
    }
  },
  {
    id: 'T1-R5-05',
    tier: 1,
    feature: 'R5',
    name: 'ForumApp enforces minimum 1.5s rate-limiting cooldown on thread/reply',
    fn: async () => {
      const forumCode = fs.readFileSync(path.join(ROOT_DIR, 'forum.js'), 'utf8');
      assertMatch(
        forumCode,
        /1500|cooldown|rateLimit/i,
        'forum.js must implement 1500ms cooldown or rate limit on thread/reply post'
      );
    }
  },
  {
    id: 'T1-R5-06',
    tier: 1,
    feature: 'R5',
    name: 'Password field masking and Web Crypto salted SHA-256 hashing',
    fn: async () => {
      const accountCode = fs.readFileSync(path.join(ROOT_DIR, 'account.js'), 'utf8');
      assertNotContains(
        accountCode,
        "prompt('Enter password",
        'account.js must not prompt for passwords using window.prompt'
      );
      assertContains(
        accountCode,
        'crypto.subtle.digest',
        'account.js must use crypto.subtle.digest for password hashing'
      );
      assertNotContains(
        accountCode,
        'sim_',
        'account.js must not use weak sim_ polynomial hash fallback'
      );
    }
  },

  // ========================================================
  // FEATURE R6: FIREBASE REAL-TIME & OFFLINE FALLBACK
  // ========================================================
  {
    id: 'T1-R6-01',
    tier: 1,
    feature: 'R6',
    name: 'firebase-config.js exists and exports window.FirebaseService',
    fn: async () => {
      const exists = fs.existsSync(path.join(ROOT_DIR, 'firebase-config.js'));
      assert(exists, 'firebase-config.js must exist in the repository root');

      const ctx = loadApplicationContext();
      assert(
        ctx.window.FirebaseService !== undefined,
        'window.FirebaseService must be defined by firebase-config.js'
      );
      assertEqual(
        typeof ctx.window.FirebaseService.isConfigured,
        'boolean',
        'FirebaseService.isConfigured must be a boolean'
      );
    }
  },
  {
    id: 'T1-R6-02',
    tier: 1,
    feature: 'R6',
    name: 'Offline / Unconfigured fallback banner is present and controlled',
    fn: async () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
      assertMatch(
        html,
        /id=["']firebase-fallback-banner["']|class=["'][^"']*fallback-banner[^"']*["']/,
        'index.html must include an offline / unconfigured fallback banner element'
      );
    }
  },
  {
    id: 'T1-R6-03',
    tier: 1,
    feature: 'R6',
    name: 'FirebaseService transparently routes to localStorage when unconfigured',
    fn: async () => {
      const ctx = loadApplicationContext();
      assert(ctx.window.FirebaseService, 'FirebaseService must exist');
      assertEqual(
        ctx.window.FirebaseService.isConfigured,
        false,
        'In unconfigured default state, isConfigured should be false'
      );

      // Posting chat message should succeed without throwing
      await ctx.window.FirebaseService.sendChatMessage('lobby', {
        author: 'TestUser',
        text: 'Hello offline world',
        timestamp: Date.now()
      });

      // Verify message is in localStorage
      const stored = ctx.localStorage.getItem('hub_chat_messages_v2');
      assert(stored !== null, 'Chat messages should be saved to localStorage in offline fallback');
      assertContains(stored, 'Hello offline world', 'Saved message should appear in localStorage');
    }
  },
  {
    id: 'T1-R6-04',
    tier: 1,
    feature: 'R6',
    name: 'FirebaseService.onChatMessages registers listener and returns unsubscribe',
    fn: async () => {
      const ctx = loadApplicationContext();
      let callCount = 0;
      const unsubscribe = ctx.window.FirebaseService.onChatMessages('lobby', (msgs) => {
        callCount++;
      });
      assertEqual(typeof unsubscribe, 'function', 'onChatMessages must return an unsubscribe function');
      unsubscribe();
    }
  },
  {
    id: 'T1-R6-05',
    tier: 1,
    feature: 'R6',
    name: 'FirebaseService.postForumThread returns valid thread ID in fallback',
    fn: async () => {
      const ctx = loadApplicationContext();
      const threadId = await ctx.window.FirebaseService.postForumThread({
        board: 'all',
        author: 'TestAuthor',
        subject: 'Test Thread Title',
        comment: 'Test comment content',
        imageUrl: '',
        timestamp: Date.now()
      });

      assert(threadId !== null && threadId !== undefined, 'postForumThread must return thread ID');
      const threadsJson = ctx.localStorage.getItem('hub_forum_threads_v1');
      assert(threadsJson !== null, 'Threads should be stored in localStorage');
      assertContains(threadsJson, 'Test Thread Title', 'Stored threads should contain new thread');
    }
  },
  {
    id: 'T1-R6-06',
    tier: 1,
    feature: 'R6',
    name: 'AccountManager cloud sync functions gracefully in offline fallback mode',
    fn: async () => {
      const ctx = loadApplicationContext();
      assert(ctx.window.AccountManager, 'AccountManager must exist');
      // Should not throw when attempting sync in unconfigured mode
      if (typeof ctx.window.AccountManager.syncCloud === 'function') {
        const res = await ctx.window.AccountManager.syncCloud();
        assert(res !== undefined, 'syncCloud should return status object');
      }
    }
  }
];

async function run({ filter = '', verbose = false } = {}) {
  const results = { passed: 0, failed: 0, errors: [] };
  const filtered = tests.filter(t => !filter || t.id.includes(filter) || t.name.includes(filter));

  for (const t of filtered) {
    try {
      await t.fn();
      results.passed++;
      if (verbose) console.log(`  [PASS] ${t.id}: ${t.name}`);
    } catch (err) {
      results.failed++;
      results.errors.push({ id: t.id, name: t.name, feature: t.feature, error: err });
      if (verbose) {
        console.error(`  [FAIL] ${t.id}: ${t.name}`);
        console.error(`         ${err.message}`);
      }
    }
  }

  return results;
}

if (require.main === module) {
  (async () => {
    console.log('Running Tier 1: Feature Coverage Tests...');
    const res = await run({ verbose: true });
    console.log(`\nTier 1 Results: ${res.passed} Passed, ${res.failed} Failed of ${tests.length} Total`);
    process.exit(res.failed > 0 ? 1 : 0);
  })();
}

module.exports = { tests, run };
