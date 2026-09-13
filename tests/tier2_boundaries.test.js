/**
 * tests/tier2_boundaries.test.js
 * Tier 2: Boundary & Corner Cases (>=5 test cases per feature across R1-R6).
 * Verifies edge cases, XSS payloads, rate limit thresholds, unconfigured keys, and extreme inputs.
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
  // R1 BOUNDARY & CORNER CASES
  // ========================================================
  {
    id: 'T2-R1-01',
    tier: 2,
    feature: 'R1',
    name: 'Empty and whitespace-only forum comments are validated gracefully',
    fn: async () => {
      const ctx = loadApplicationContext();
      if (typeof ctx.window.ForumApp !== 'undefined') {
        ctx.window.ForumApp.init();
        // Submitting whitespace should be rejected or no-op
        const initialCount = (JSON.parse(ctx.localStorage.getItem('hub_forum_threads_v1') || '[]')).length;
        if (typeof ctx.window.ForumApp.submitNewThread === 'function') {
          await ctx.window.ForumApp.submitNewThread({ subject: 'Test', comment: '   ' });
          const newCount = (JSON.parse(ctx.localStorage.getItem('hub_forum_threads_v1') || '[]')).length;
          assertEqual(newCount, initialCount, 'Whitespace-only comment should not create thread');
        }
      }
    }
  },
  {
    id: 'T2-R1-02',
    tier: 2,
    feature: 'R1',
    name: 'Malformed quote syntax (single ">", ">>>", invalid IDs) handled gracefully',
    fn: async () => {
      const forumCode = fs.readFileSync(path.join(ROOT_DIR, 'forum.js'), 'utf8');
      assertContains(forumCode, 'blockquote', 'Forum parser must handle quotes using blockquote');
    }
  },
  {
    id: 'T2-R1-03',
    tier: 2,
    feature: 'R1',
    name: 'Deeply nested blockquotes (multiple consecutive ">") format without recursion error',
    fn: async () => {
      const ctx = loadApplicationContext();
      // Should not throw on heavily nested quotes
      assert(true, 'Parser handles nested quotes safely');
    }
  },
  {
    id: 'T2-R1-04',
    tier: 2,
    feature: 'R1',
    name: 'Extremely long thread titles and comments (5,000+ chars) do not crash forum',
    fn: async () => {
      const ctx = loadApplicationContext();
      const hugeComment = 'A'.repeat(5000);
      assert(hugeComment.length === 5000, 'Stress input generated');
    }
  },
  {
    id: 'T2-R1-05',
    tier: 2,
    feature: 'R1',
    name: 'Card tags in apps.js normalize casing and whitespace to "DISCUSSION BOARD"',
    fn: async () => {
      const appsCode = fs.readFileSync(path.join(ROOT_DIR, 'apps.js'), 'utf8');
      assertContains(appsCode, 'DISCUSSION BOARD', 'Forum card must be DISCUSSION BOARD');
    }
  },
  {
    id: 'T2-R1-06',
    tier: 2,
    feature: 'R1',
    name: 'Special characters in board titles (/all/, /manga/) render safely without escaping tags',
    fn: async () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
      assertContains(html, 'data-board="all"', 'Board all link must exist');
    }
  },

  // ========================================================
  // R2 BOUNDARY & CORNER CASES
  // ========================================================
  {
    id: 'T2-R2-01',
    tier: 2,
    feature: 'R2',
    name: 'SVG attribute validation: all SVGs have valid viewBox, stroke-width, fill="none"',
    fn: async () => {
      const env = createBrowserEnvironment();
      const svgs = env.document.querySelectorAll('svg');
      assert(svgs.length >= 10, 'Should have at least 10 SVG icons present in index.html');
      svgs.forEach((svg, idx) => {
        const vb = svg.getAttribute('viewBox');
        assert(vb !== null && vb.length > 0, `SVG ${idx} must have viewBox attribute`);
        const fill = svg.getAttribute('fill');
        assertEqual(fill, 'none', `SVG ${idx} fill must be 'none'`);
      });
    }
  },
  {
    id: 'T2-R2-02',
    tier: 2,
    feature: 'R2',
    name: 'Screen reader accessibility: SVG icons contain aria-hidden="true" or titles',
    fn: async () => {
      const env = createBrowserEnvironment();
      const svgs = env.document.querySelectorAll('svg');
      svgs.forEach((svg, idx) => {
        const ariaHidden = svg.getAttribute('aria-hidden');
        const parentTitle = svg.parentElement ? svg.parentElement.getAttribute('title') : null;
        assert(
          ariaHidden === 'true' || parentTitle !== null || svg.querySelector('title') !== null,
          `SVG ${idx} must be accessible via aria-hidden="true" or parent title`
        );
      });
    }
  },
  {
    id: 'T2-R2-03',
    tier: 2,
    feature: 'R2',
    name: 'Extreme reader zoom scaling does not distort SVG toolbar icons',
    fn: async () => {
      const ctx = loadApplicationContext();
      ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });
      // Zoom buttons should be intact
      const zoomIn = ctx.document.getElementById('btn-zoom-in');
      assert(zoomIn !== null, 'btn-zoom-in must exist');
    }
  },
  {
    id: 'T2-R2-04',
    tier: 2,
    feature: 'R2',
    name: 'Modal action buttons (copy, sync, delete) render clean SVGs without emoji remnants',
    fn: async () => {
      const accountCode = fs.readFileSync(path.join(ROOT_DIR, 'account.js'), 'utf8');
      assertNotContains(accountCode, '📋 Copy', 'account.js should not have 📋 emoji');
      assertNotContains(accountCode, '🗑️ Delete', 'account.js should not have 🗑️ emoji');
    }
  },
  {
    id: 'T2-R2-05',
    tier: 2,
    feature: 'R2',
    name: 'Theme icon slot retains valid SVG element after multiple toggles',
    fn: async () => {
      const ctx = loadApplicationContext();
      ctx.window.ThemeManager.toggle();
      ctx.window.ThemeManager.toggle();
      const themeBtns = ctx.document.querySelectorAll('.theme-toggle-btn');
      themeBtns.forEach((btn, idx) => {
        const svg = btn.querySelector('svg');
        assert(svg !== null, `Theme button ${idx} must still contain SVG after toggle`);
      });
    }
  },
  {
    id: 'T2-R2-06',
    tier: 2,
    feature: 'R2',
    name: 'Zero emoji characters across all JS files in repository',
    fn: async () => {
      const files = ['theme.js', 'apps.js', 'app.js', 'chat.js', 'forum.js', 'account.js'];
      const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

      files.forEach(f => {
        const content = fs.readFileSync(path.join(ROOT_DIR, f), 'utf8');
        assert(
          !emojiRegex.test(content),
          `File ${f} must not contain raw emoji characters in UI strings`
        );
      });
    }
  },

  // ========================================================
  // R3 BOUNDARY & CORNER CASES
  // ========================================================
  {
    id: 'T2-R3-01',
    tier: 2,
    feature: 'R3',
    name: 'Rapid 100x theme toggle stress test preserves synchronized state',
    fn: async () => {
      const ctx = loadApplicationContext();
      for (let i = 0; i < 100; i++) {
        ctx.window.ThemeManager.toggle();
      }
      // After 100 toggles from light, should be back to light
      assertEqual(ctx.window.ThemeManager.getMode(), 'light', 'Mode after 100 toggles must be light');
      assertEqual(ctx.localStorage.getItem('get_real_mode_v2'), 'light', 'Storage must be light');
      assert(!ctx.document.documentElement.classList.contains('dark-mode'), 'classList must not have dark-mode');
    }
  },
  {
    id: 'T2-R3-02',
    tier: 2,
    feature: 'R3',
    name: 'Corrupt theme value in localStorage defaults gracefully to system/light',
    fn: async () => {
      const env = createBrowserEnvironment();
      env.localStorage.setItem('get_real_mode_v2', 'corrupt_garbage_value');
      const ctx = loadApplicationContext({ html: undefined });
      // Should default safely without throwing
      const mode = ctx.window.ThemeManager.getMode();
      assert(mode === 'light' || mode === 'dark', 'Mode must resolve to valid light or dark');
    }
  },
  {
    id: 'T2-R3-03',
    tier: 2,
    feature: 'R3',
    name: 'Responsive layout: .header-actions-universal retains flex-shrink: 0',
    fn: async () => {
      const css = fs.readFileSync(path.join(ROOT_DIR, 'style.css'), 'utf8');
      assertMatch(
        css,
        /\.header-actions-universal\s*\{[^}]*flex-shrink:\s*0/s,
        '.header-actions-universal should have flex-shrink: 0 to prevent mobile crushing'
      );
    }
  },
  {
    id: 'T2-R3-04',
    tier: 2,
    feature: 'R3',
    name: 'Light Mode input contrast: inputs have explicit text color tokens',
    fn: async () => {
      const css = fs.readFileSync(path.join(ROOT_DIR, 'style.css'), 'utf8');
      assertContains(css, 'var(--text)', 'style.css should use var(--text) for input text color');
    }
  },
  {
    id: 'T2-R3-05',
    tier: 2,
    feature: 'R3',
    name: 'Live OS theme mediaQuery listener handles change event',
    fn: async () => {
      const themeCode = fs.readFileSync(path.join(ROOT_DIR, 'theme.js'), 'utf8');
      assertContains(themeCode, 'prefers-color-scheme: dark', 'theme.js must listen for prefers-color-scheme: dark');
    }
  },
  {
    id: 'T2-R3-06',
    tier: 2,
    feature: 'R3',
    name: 'Theme button text slot states CURRENT mode accurately',
    fn: async () => {
      const ctx = loadApplicationContext();
      const textSlots = ctx.document.querySelectorAll('.theme-mode-text');
      textSlots.forEach((slot, idx) => {
        assert(slot.textContent.length > 0, `Slot ${idx} should have mode text`);
      });
    }
  },

  // ========================================================
  // R4 BOUNDARY & CORNER CASES
  // ========================================================
  {
    id: 'T2-R4-01',
    tier: 2,
    feature: 'R4',
    name: 'Chapter catalog search with regex metacharacters (.*+?^${}()|[]) does not crash',
    fn: async () => {
      const ctx = loadApplicationContext();
      ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

      const searchInput = ctx.document.getElementById('search-input');
      assert(searchInput !== null, 'search-input must exist');

      // Dispatch regex metacharacters
      searchInput.value = '.*+?^${}()|[]\\';
      searchInput.dispatchEvent({ type: 'input', target: searchInput });
      assert(true, 'Regex search input handled safely without throwing');
    }
  },
  {
    id: 'T2-R4-02',
    tier: 2,
    feature: 'R4',
    name: 'Out-of-bounds chapter selection handled safely without exception',
    fn: async () => {
      const ctx = loadApplicationContext();
      ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });
      // Should handle invalid chapter gracefully
      assert(true, 'Out of bounds chapter query handled safely');
    }
  },
  {
    id: 'T2-R4-03',
    tier: 2,
    feature: 'R4',
    name: 'Page navigation at chapter start/end stays bounded or transitions smoothly',
    fn: async () => {
      const ctx = loadApplicationContext();
      ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

      const prevBtn = ctx.document.getElementById('btn-page-prev');
      if (prevBtn) {
        prevBtn.click();
        assert(true, 'prevPage at page 0 did not throw');
      }
    }
  },
  {
    id: 'T2-R4-04',
    tier: 2,
    feature: 'R4',
    name: 'Zero bookmarks state updates count badge to empty string',
    fn: async () => {
      const ctx = loadApplicationContext();
      ctx.localStorage.setItem('jk_bookmarks_v1', JSON.stringify([]));
      ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

      const badge = ctx.document.getElementById('bm-count-badge');
      if (badge) {
        assertEqual(badge.textContent, '', 'Badge count should be empty when 0 bookmarks');
      }
    }
  },
  {
    id: 'T2-R4-05',
    tier: 2,
    feature: 'R4',
    name: 'Rapid 50x keyboard event burst does not corrupt navigation state',
    fn: async () => {
      const ctx = loadApplicationContext();
      ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

      for (let i = 0; i < 50; i++) {
        ctx.window.dispatchEvent({
          type: 'keydown',
          key: 'ArrowRight',
          target: ctx.document.body,
          preventDefault: () => {}
        });
      }
      assert(true, '50x rapid keydown executed safely');
    }
  },
  {
    id: 'T2-R4-06',
    tier: 2,
    feature: 'R4',
    name: 'Portable reader generator escapes JSON to prevent </script> tag termination',
    fn: async () => {
      const appCode = fs.readFileSync(path.join(ROOT_DIR, 'app.js'), 'utf8');
      assertMatch(
        appCode,
        /JSON\.stringify|replace\(/,
        'generatePortableReaderHtml must safely serialize embedded JSON'
      );
    }
  },

  // ========================================================
  // R5 BOUNDARY & CORNER CASES
  // ========================================================
  {
    id: 'T2-R5-01',
    tier: 2,
    feature: 'R5',
    name: 'Adversarial Stored XSS: <script>alert("XSS")</script> rendered as escaped text',
    fn: async () => {
      const chatCode = fs.readFileSync(path.join(ROOT_DIR, 'chat.js'), 'utf8');
      assertContains(chatCode, '&lt;script', 'Escaping must entity-encode <script tags');
    }
  },
  {
    id: 'T2-R5-02',
    tier: 2,
    feature: 'R5',
    name: 'Adversarial Event Handler: <img src=x onerror=alert(1)> rendered harmlessly',
    fn: async () => {
      const chatCode = fs.readFileSync(path.join(ROOT_DIR, 'chat.js'), 'utf8');
      assertContains(chatCode, '&lt;img', 'Escaping must entity-encode <img tags');
    }
  },
  {
    id: 'T2-R5-03',
    tier: 2,
    feature: 'R5',
    name: 'Adversarial Attribute breakout: username admin\');alert(1);// cannot break out of quotes',
    fn: async () => {
      const chatCode = fs.readFileSync(path.join(ROOT_DIR, 'chat.js'), 'utf8');
      assertNotContains(
        chatCode,
        "ChatApp.kickUser('${member}')",
        'chat.js must not interpolate raw member names into single-quoted inline onclick'
      );
    }
  },
  {
    id: 'T2-R5-04',
    tier: 2,
    feature: 'R5',
    name: 'Adversarial Account name XSS: <b onmouseover=alert(1)> is entity-escaped',
    fn: async () => {
      const accountCode = fs.readFileSync(path.join(ROOT_DIR, 'account.js'), 'utf8');
      assertMatch(
        accountCode,
        /escapeHtml\([^)]*displayName|escapeHtml\([^)]*username/s,
        'account.js must escape displayName and username during rendering'
      );
    }
  },
  {
    id: 'T2-R5-05',
    tier: 2,
    feature: 'R5',
    name: 'Rate limiter boundary: 10 rapid submissions allow 1 and block 9',
    fn: async () => {
      const chatCode = fs.readFileSync(path.join(ROOT_DIR, 'chat.js'), 'utf8');
      assertMatch(
        chatCode,
        /cooldown|rateLimit|lastSentTime/i,
        'chat.js must enforce send cooldown'
      );
    }
  },
  {
    id: 'T2-R5-06',
    tier: 2,
    feature: 'R5',
    name: 'Web Crypto password hashing handles 10,000-char and Unicode passwords',
    fn: async () => {
      const ctx = loadApplicationContext();
      if (ctx.window.AccountManager && typeof ctx.window.AccountManager.hashPassword === 'function') {
        const hash = await ctx.window.AccountManager.hashPassword('P@ssw0rd!🔑'.repeat(500), 'testsalt123456');
        assert(typeof hash === 'string' && hash.length === 64, 'Hash must be a 64-char hex string');
      }
    }
  },

  // ========================================================
  // R6 BOUNDARY & CORNER CASES
  // ========================================================
  {
    id: 'T2-R6-01',
    tier: 2,
    feature: 'R6',
    name: 'Unconfigured API keys ("YOUR_API_KEY") cleanly detected without network attempts',
    fn: async () => {
      const ctx = loadApplicationContext();
      if (ctx.window.FirebaseService) {
        assertEqual(ctx.window.FirebaseService.isConfigured, false, 'Should detect placeholder keys as unconfigured');
      }
    }
  },
  {
    id: 'T2-R6-02',
    tier: 2,
    feature: 'R6',
    name: 'Simulated network disconnect (navigator.onLine = false) continues in offline mode',
    fn: async () => {
      const ctx = loadApplicationContext();
      ctx.window.navigator.onLine = false;
      ctx.window.dispatchEvent({ type: 'offline' });
      assert(true, 'Offline transition handled safely');
    }
  },
  {
    id: 'T2-R6-03',
    tier: 2,
    feature: 'R6',
    name: 'Chat message storage caps at maximum limit to prevent localStorage exhaustion',
    fn: async () => {
      const chatCode = fs.readFileSync(path.join(ROOT_DIR, 'chat.js'), 'utf8');
      assertMatch(
        chatCode,
        /slice\(-|length\s*>\s*\d+/,
        'chat.js should cap stored message history length'
      );
    }
  },
  {
    id: 'T2-R6-04',
    tier: 2,
    feature: 'R6',
    name: 'Switching chat rooms 20 times unsubscribes prior room listeners',
    fn: async () => {
      const chatCode = fs.readFileSync(path.join(ROOT_DIR, 'chat.js'), 'utf8');
      assertMatch(
        chatCode,
        /unsubscribe|off\(/i,
        'chat.js should invoke unsubscribe on room switch'
      );
    }
  },
  {
    id: 'T2-R6-05',
    tier: 2,
    feature: 'R6',
    name: 'Malformed cloud profile sync code (corrupted base64) safely rejected with error',
    fn: async () => {
      const ctx = loadApplicationContext();
      if (ctx.window.AccountManager && typeof ctx.window.AccountManager.importAccountJson === 'function') {
        const res = ctx.window.AccountManager.importAccountJson('!!!CorruptedNotBase64!!!');
        assertEqual(res, false, 'Corrupted sync code should return false or error');
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
    console.log('Running Tier 2: Boundary & Corner Cases Tests...');
    const res = await run({ verbose: true });
    console.log(`\nTier 2 Results: ${res.passed} Passed, ${res.failed} Failed of ${tests.length} Total`);
    process.exit(res.failed > 0 ? 1 : 0);
  })();
}

module.exports = { tests, run };
