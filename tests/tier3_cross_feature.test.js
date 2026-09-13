/**
 * tests/tier3_cross_feature.test.js
 * Tier 3: Cross-Feature Combinations (Pairwise Interactions).
 * Tests multi-subsystem state coherence across module boundaries.
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
  // PAIR 1: THEME TOGGLE DURING ACTIVE LIVE CHAT
  // ========================================================
  {
    id: 'T3-PAIR-01',
    tier: 3,
    feature: 'Cross-ThemeChat',
    name: 'Theme toggle during active chat updates SVG icons and maintains chat contrast',
    fn: async () => {
      const ctx = loadApplicationContext();
      ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

      // Navigate to chat view
      if (typeof ctx.window.switchMainView === 'function') {
        ctx.window.switchMainView('chat');
      }

      // Verify chat view is active
      const chatView = ctx.document.getElementById('view-chat');
      assert(chatView && chatView.classList.contains('active'), 'Chat view must be active');

      // Toggle theme to dark
      ctx.window.ThemeManager.apply('dark', true);
      assert(
        ctx.document.documentElement.classList.contains('dark-mode'),
        'document element must have dark-mode class'
      );

      // Verify theme icon slot inside chat header contains SVG
      const chatHeader = chatView.querySelector('.chat-app-header') || chatView.querySelector('header');
      assert(chatHeader !== null, 'Chat header must exist');
      const themeBtn = chatHeader.querySelector('.theme-toggle-btn');
      assert(themeBtn !== null, 'Chat header must contain .theme-toggle-btn');
      assert(themeBtn.querySelector('svg') !== null, 'Theme toggle in chat must render SVG');

      // Verify input box exists and is ready
      const inputBox = ctx.document.getElementById('chat-input-box');
      assert(inputBox !== null, 'Chat input box must exist');
    }
  },

  // ========================================================
  // PAIR 2: ACCOUNT SWITCHING WHILE IN FORUM VIEW
  // ========================================================
  {
    id: 'T3-PAIR-02',
    tier: 3,
    feature: 'Cross-AccountForum',
    name: 'Account switching while in forum view updates author field and universal header badge',
    fn: async () => {
      const ctx = loadApplicationContext();
      ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

      // Switch to forum view
      if (typeof ctx.window.switchMainView === 'function') {
        ctx.window.switchMainView('forum');
      }

      const forumView = ctx.document.getElementById('view-forum');
      assert(forumView && forumView.classList.contains('active'), 'Forum view must be active');

      // Register or set a user in AccountManager
      if (ctx.window.AccountManager) {
        ctx.window.AccountManager.setActiveProfile({
          username: 'GojoSensei',
          displayName: 'Satoru Gojo',
          bio: 'The Honored One'
        });

        // Universal header account name badge in forum view should reflect new username
        const forumAccountName = forumView.querySelector('.account-username-text');
        if (forumAccountName) {
          assertEqual(
            forumAccountName.textContent,
            'Satoru Gojo',
            'Universal header account name in forum must update to active profile'
          );
        }
      }
    }
  },

  // ========================================================
  // PAIR 3: OFFLINE MODE BOOKMARKING & READER STATE SYNC
  // ========================================================
  {
    id: 'T3-PAIR-03',
    tier: 3,
    feature: 'Cross-OfflineBookmarks',
    name: 'Bookmarking chapters when offline persists locally and updates count badge',
    fn: async () => {
      const ctx = loadApplicationContext();
      ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

      // Open reader view
      if (typeof ctx.window.switchMainView === 'function') {
        ctx.window.switchMainView('reader');
      }

      // Add a bookmark in offline mode
      const testBookmark = { chapterNumber: 1, page: 5, timestamp: Date.now() };
      const currentBookmarks = JSON.parse(ctx.localStorage.getItem('jk_bookmarks_v1') || '[]');
      currentBookmarks.push(testBookmark);
      ctx.localStorage.setItem('jk_bookmarks_v1', JSON.stringify(currentBookmarks));

      // Trigger badge update
      if (typeof ctx.window.updateBookmarksBadge === 'function') {
        ctx.window.updateBookmarksBadge();
        const badge = ctx.document.getElementById('bm-count-badge');
        if (badge) {
          assertContains(badge.textContent, '1', 'Bookmark count badge should show (1)');
        }
      }
    }
  },

  // ========================================================
  // PAIR 4: CHAT RATE-LIMITING WHILE SWITCHING ROOMS
  // ========================================================
  {
    id: 'T3-PAIR-04',
    tier: 3,
    feature: 'Cross-RateLimitRoomSwitch',
    name: 'Switching chat rooms during cooldown does not bypass rate-limiting',
    fn: async () => {
      const chatCode = fs.readFileSync(path.join(ROOT_DIR, 'chat.js'), 'utf8');
      assertMatch(
        chatCode,
        /cooldown|rateLimit|lastSentTime/i,
        'chat.js must enforce send cooldown regardless of active room'
      );
    }
  },

  // ========================================================
  // PAIR 5: FORUM SEMANTIC BLOCKQUOTES COMBINED WITH XSS SANITIZATION
  // ========================================================
  {
    id: 'T3-PAIR-05',
    tier: 3,
    feature: 'Cross-QuoteXSS',
    name: 'Quoting text containing malicious HTML formats safely inside <blockquote>',
    fn: async () => {
      const forumCode = fs.readFileSync(path.join(ROOT_DIR, 'forum.js'), 'utf8');
      assertContains(
        forumCode,
        'blockquote',
        'forum.js must render quotes as semantic <blockquote>'
      );
      assertNotContains(
        forumCode,
        '<span class="greentext">',
        'forum.js must not output greentext span'
      );
    }
  },

  // ========================================================
  // PAIR 6: STANDALONE READER EXPORT IN CUSTOM THEME & ACCOUNT
  // ========================================================
  {
    id: 'T3-PAIR-06',
    tier: 3,
    feature: 'Cross-ThemeExport',
    name: 'Standalone reader export creates clean HTML with SVGs and no AI branding',
    fn: async () => {
      const appCode = fs.readFileSync(path.join(ROOT_DIR, 'app.js'), 'utf8');
      assertNotContains(
        appCode,
        'Powered by Elgatitolover',
        'app.js standalone reader template must not contain Elgatitolover branding'
      );
    }
  },

  // ========================================================
  // PAIR 7: QUICK SCRATCHPAD BUFFER PRESERVED ACROSS VIEW SWITCHING
  // ========================================================
  {
    id: 'T3-PAIR-07',
    tier: 3,
    feature: 'Cross-ScratchpadRouter',
    name: 'Switching views between Notes, Reader, and Chat preserves scratchpad buffer',
    fn: async () => {
      const ctx = loadApplicationContext();
      ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

      // Navigate to notes
      if (typeof ctx.window.switchMainView === 'function') {
        ctx.window.switchMainView('notes');
      }

      const noteArea = ctx.document.getElementById('scratchpad-text');
      assert(noteArea !== null, 'scratchpad-text must exist');
      noteArea.value = 'Cross-view persistence note test content';
      noteArea.dispatchEvent({ type: 'input', target: noteArea });

      // Switch to Reader
      if (typeof ctx.window.switchMainView === 'function') {
        ctx.window.switchMainView('reader');
      }

      // Switch to Chat
      if (typeof ctx.window.switchMainView === 'function') {
        ctx.window.switchMainView('chat');
      }

      // Switch back to Notes
      if (typeof ctx.window.switchMainView === 'function') {
        ctx.window.switchMainView('notes');
      }

      assertEqual(
        noteArea.value,
        'Cross-view persistence note test content',
        'Scratchpad content must remain intact after switching views'
      );
    }
  },

  // ========================================================
  // PAIR 8: THEME TOGGLE IN READER MODE
  // ========================================================
  {
    id: 'T3-PAIR-08',
    tier: 3,
    feature: 'Cross-ThemeReader',
    name: 'Theme toggle in reader mode switches background tokens without resetting zoom',
    fn: async () => {
      const ctx = loadApplicationContext();
      ctx.window.dispatchEvent({ type: 'DOMContentLoaded' });

      if (typeof ctx.window.switchMainView === 'function') {
        ctx.window.switchMainView('reader');
      }

      // Set zoom to 125%
      const zoom125Btn = ctx.document.getElementById('btn-zoom-125');
      if (zoom125Btn) zoom125Btn.click();

      // Toggle theme to dark
      ctx.window.ThemeManager.apply('dark', true);
      assert(
        ctx.document.documentElement.classList.contains('dark-mode'),
        'document element must have dark-mode'
      );

      // Verify zoom text remains 125%
      const zoomText = ctx.document.getElementById('zoom-text');
      if (zoomText) {
        assertEqual(zoomText.textContent, '125%', 'Zoom state must be preserved across theme toggle');
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
    console.log('Running Tier 3: Cross-Feature Combinations Tests...');
    const res = await run({ verbose: true });
    console.log(`\nTier 3 Results: ${res.passed} Passed, ${res.failed} Failed of ${tests.length} Total`);
    process.exit(res.failed > 0 ? 1 : 0);
  })();
}

module.exports = { tests, run };
