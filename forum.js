// Modern Discussion Board Engine (Threads, Semantic Blockquotes, Quoting, Moderation, Firebase)
const ForumApp = (() => {
  const STORAGE_THREADS = 'hub_forum_threads_v1';

  let currentBoard = 'all'; // all, gen, manga, tech
  let viewingThreadId = null;
  let isInitialized = false;
  let lastPostTime = 0;
  const RATE_LIMIT_COOLDOWN_MS = 1500;

  // Realistic community seed threads (replacing artificial tells)
  const SEED_THREADS = [
    {
      id: 1001,
      board: 'manga',
      author: 'GojoFan',
      subject: 'Jujutsu Kaisen Chapter 272 Discussion & Finale Reflections',
      comment: '> What a journey it has been over the past 6 years.\n> The Shinjuku Showdown arc concluded with incredible intensity.\nWhat did everyone think of the final character moments and the pacing of the conclusion?',
      imageUrl: '',
      timestamp: Date.now() - 3600000 * 5,
      replies: [
        {
          id: 1002,
          author: 'SukunaStan',
          comment: '>>1001\n> The Shinjuku Showdown arc concluded with incredible intensity.\nAgreed, the domain expansion clashes and Sukuna vs Gojo sequence set a new benchmark for battle shonen.',
          timestamp: Date.now() - 3600000 * 3
        },
        {
          id: 1003,
          author: 'MegumiEnjoyer',
          comment: '>>1001\nLoved the closing themes about choice and moving forward. Curious what Akutami will write next.',
          timestamp: Date.now() - 3600000 * 1
        }
      ]
    },
    {
      id: 1010,
      board: 'gen',
      author: 'MangaReader99',
      subject: 'Favorite battle choreography in modern manga?',
      comment: '> Looking for series with creative panel flow and combat physics.\nJJK and Sakamoto Days have had standout fight layouts lately. What else do you recommend?',
      imageUrl: '',
      timestamp: Date.now() - 3600000 * 2,
      replies: [
        {
          id: 1011,
          author: 'PanelPurist',
          comment: '>>1010\nCheck out Dandadan and Chainsaw Man part 1. The perspective shifts are fantastic.',
          timestamp: Date.now() - 3600000 * 1
        }
      ]
    }
  ];

  const CHECK_SVG = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';

  function init() {
    if (isInitialized) {
      renderForum();
      return;
    }
    isInitialized = true;

    if (!localStorage.getItem(STORAGE_THREADS)) {
      localStorage.setItem(STORAGE_THREADS, JSON.stringify(SEED_THREADS));
    }

    if (typeof AccountManager !== 'undefined') {
      AccountManager.onAccountChange(() => {
        renderForum();
      });
    }

    setupForumEvents();
    renderForum();
  }

  function getThreads() {
    try {
      const stored = localStorage.getItem(STORAGE_THREADS);
      return stored ? JSON.parse(stored) : SEED_THREADS;
    } catch (e) {
      return SEED_THREADS;
    }
  }

  function saveThreads(threads) {
    try {
      localStorage.setItem(STORAGE_THREADS, JSON.stringify(threads));
    } catch (e) {}
  }

  function setupForumEvents() {
    // Board selectors
    document.querySelectorAll('.board-nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.board-nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        currentBoard = link.getAttribute('data-board') || 'all';
        viewingThreadId = null;
        renderForum();
      });
    });

    // Toggle Post Box
    document.getElementById('btn-toggle-post-box')?.addEventListener('click', () => {
      const box = document.getElementById('forum-post-box');
      if (box) {
        const isOpening = !box.style.display || box.style.display === 'none';
        box.style.display = isOpening ? 'block' : 'none';
        if (isOpening) {
          const nameInput = document.getElementById('post-name-input');
          if (nameInput && !nameInput.value.trim() && typeof AccountManager !== 'undefined') {
            nameInput.value = AccountManager.getUsername();
          }
        }
      }
    });

    // Submit new thread
    document.getElementById('forum-submit-thread-btn')?.addEventListener('click', () => submitNewThread());

    // Back to catalog button
    document.getElementById('forum-back-catalog-btn')?.addEventListener('click', () => {
      viewingThreadId = null;
      renderForum();
    });
  }

  async function submitNewThread(payload) {
    const now = Date.now();
    if (now - lastPostTime < RATE_LIMIT_COOLDOWN_MS) {
      alert('Please wait a moment before submitting again (rate limit cooldown).');
      return;
    }

    let subject = '';
    let name = '';
    let comment = '';
    let image = '';

    if (payload && typeof payload === 'object') {
      subject = (payload.subject || '').trim();
      name = (payload.name || payload.author || '').trim();
      comment = (payload.comment || '').trim();
      image = (payload.imageUrl || '').trim();
    } else {
      const subjectInput = document.getElementById('post-subject-input');
      const nameInput = document.getElementById('post-name-input');
      const commentInput = document.getElementById('post-comment-input');
      const imageInput = document.getElementById('post-image-input');

      subject = (subjectInput?.value || '').trim();
      name = (nameInput?.value || '').trim();
      comment = (commentInput?.value || '').trim();
      image = (imageInput?.value || '').trim();
    }

    const userHandle = (typeof AccountManager !== 'undefined') ? AccountManager.getUsername() : 'Guest';
    if (!name) name = userHandle;

    if (!comment) {
      return;
    }

    // Anti-impersonation check
    if (typeof AccountManager !== 'undefined') {
      const isAuth = AccountManager.isAuthenticated();
      if (!isAuth && AccountManager.isUsernameRegistered(name)) {
        alert('The username "' + name + '" is registered and protected by password.\n\nPlease log in to author posts under this name, or choose a different name.');
        AccountManager.openModal('login');
        return;
      }
    }

    if (typeof ProfanityFilter !== 'undefined' && !ProfanityFilter.isClean(name)) {
      alert('Author name contains disallowed language. Please choose a clean name.');
      return;
    }

    lastPostTime = now;

    const cleanSubject = typeof ProfanityFilter !== 'undefined' ? ProfanityFilter.clean(subject || 'Untitled') : (subject || 'Untitled');
    const cleanComment = typeof ProfanityFilter !== 'undefined' ? ProfanityFilter.clean(comment) : comment;

    const isVerifiedThread = (typeof AccountManager !== 'undefined') ? AccountManager.isAuthenticated() : false;

    const threadData = {
      board: currentBoard === 'all' ? 'gen' : currentBoard,
      author: name,
      verified: isVerifiedThread,
      avatar: (typeof AccountManager !== 'undefined') ? AccountManager.getAvatarKey() : 'logo_avatar',
      subject: cleanSubject,
      comment: cleanComment,
      imageUrl: image,
      timestamp: Date.now(),
      replies: []
    };

    if (typeof FirebaseService !== 'undefined') {
      await FirebaseService.postForumThread(threadData);
    } else {
      const threads = getThreads();
      const newId = (threads.length > 0 ? Math.max(...threads.map(t => t.id || 0)) : 1000) + 1;
      threadData.id = newId;
      threads.unshift(threadData);
      saveThreads(threads);
    }

    // Clear inputs
    const subjectInput = document.getElementById('post-subject-input');
    const commentInput = document.getElementById('post-comment-input');
    const imageInput = document.getElementById('post-image-input');
    if (subjectInput) subjectInput.value = '';
    if (commentInput) commentInput.value = '';
    if (imageInput) imageInput.value = '';
    const postBox = document.getElementById('forum-post-box');
    if (postBox) postBox.style.display = 'none';

    renderForum();
  }

  async function submitReply(threadId) {
    const now = Date.now();
    if (now - lastPostTime < RATE_LIMIT_COOLDOWN_MS) {
      alert('Please wait a moment before posting again (rate limit cooldown).');
      return;
    }

    const nameInput = document.getElementById(`reply-name-${threadId}`);
    const commentInput = document.getElementById(`reply-comment-${threadId}`);

    const userHandle = (typeof AccountManager !== 'undefined') ? AccountManager.getUsername() : 'Guest';
    const name = (nameInput?.value || '').trim() || userHandle;
    const comment = (commentInput?.value || '').trim();

    if (!comment) {
      alert('Please write a reply.');
      return;
    }

    if (typeof AccountManager !== 'undefined') {
      const isAuth = AccountManager.isAuthenticated();
      if (!isAuth && AccountManager.isUsernameRegistered(name)) {
        alert('The username "' + name + '" is registered and protected by password.\n\nPlease log in with your password to post replies under this name, or choose a different name.');
        AccountManager.openModal('login');
        return;
      }
    }

    if (typeof ProfanityFilter !== 'undefined' && !ProfanityFilter.isClean(name)) {
      alert('Name contains disallowed language.');
      return;
    }

    lastPostTime = now;
    const cleanComment = typeof ProfanityFilter !== 'undefined' ? ProfanityFilter.clean(comment) : comment;
    const isVerifiedReply = (typeof AccountManager !== 'undefined') ? AccountManager.isAuthenticated() : false;

    const replyData = {
      author: name,
      verified: isVerifiedReply,
      avatar: (typeof AccountManager !== 'undefined') ? AccountManager.getAvatarKey() : 'logo_avatar',
      comment: cleanComment,
      timestamp: Date.now()
    };

    if (typeof FirebaseService !== 'undefined') {
      await FirebaseService.postThreadReply(threadId, replyData);
    } else {
      const threads = getThreads();
      const thread = threads.find(t => t.id === threadId);
      if (thread) {
        if (!thread.replies) thread.replies = [];
        const replyId = (thread.replies.length > 0 ? Math.max(...thread.replies.map(r => r.id || 0)) : threadId) + 1;
        replyData.id = replyId;
        thread.replies.push(replyData);
        saveThreads(threads);
      }
    }

    const thread = getThreads().find(t => t.id === threadId);
    if (thread) renderThreadView(thread);
  }

  function renderForum() {
    const catalogView = document.getElementById('forum-catalog-view');
    const threadView = document.getElementById('forum-thread-view');
    const boardTitle = document.getElementById('forum-current-board-title');

    if (boardTitle) {
      boardTitle.textContent = `/${currentBoard}/ - ${getBoardName(currentBoard)}`;
    }

    if (viewingThreadId) {
      const thread = getThreads().find(t => t.id === viewingThreadId);
      if (thread) {
        if (catalogView) catalogView.style.display = 'none';
        if (threadView) threadView.style.display = 'block';
        renderThreadView(thread);
        return;
      }
    }

    if (catalogView) catalogView.style.display = 'block';
    if (threadView) threadView.style.display = 'none';
    renderCatalog();
  }

  function getBoardName(b) {
    switch (b) {
      case 'all': return 'All Boards';
      case 'gen': return 'General Discussion';
      case 'manga': return 'Jujutsu Kaisen & Manga';
      case 'school': return 'Community & Tech';
      default: return 'Discussion Board';
    }
  }

  function renderCatalog() {
    const list = document.getElementById('forum-threads-list');
    if (!list) return;

    const threads = getThreads().filter(t => currentBoard === 'all' || t.board === currentBoard);
    if (threads.length === 0) {
      list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">No threads yet on /${escapeHtml(currentBoard)}/. Click "New Thread" above to start the discussion!</div>`;
      return;
    }

    list.innerHTML = threads.map(t => {
      const dateStr = new Date(t.timestamp).toLocaleString();
      const replyCount = (t.replies || []).length;
      const avatarSrc = (t.avatar && typeof AccountManager !== 'undefined') ? AccountManager.getAvatarSrc(t.avatar) : null;
      return `
        <div class="board-thread-card" onclick="ForumApp.openThread(${JSON.stringify(t.id)})">
          <div class="thread-header">
            <span class="thread-subject">${escapeHtml(t.subject)}</span>
            <span class="thread-author" style="display:inline-flex;align-items:center;gap:4px;">
              ${avatarSrc ? `<img src="${avatarSrc}" class="account-avatar-mini" style="width:15px;height:15px;" alt="Avatar">` : ''}
              ${escapeHtml(t.author)}
              ${t.verified ? `<span class="forum-verified-badge" title="Verified Account">${CHECK_SVG}</span>` : '<span class="guest-badge">Guest</span>'}
            </span>
            <span class="thread-date">${dateStr}</span>
            <span class="thread-id">No.${escapeHtml(t.id)}</span>
            <span class="thread-replies-badge">${replyCount} replies</span>
          </div>
          <div class="thread-body">
            ${formatQuotesAndBlocks(escapeHtml(t.comment))}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderThreadView(thread) {
    const container = document.getElementById('forum-thread-detail');
    if (!container) return;

    const opDate = new Date(thread.timestamp).toLocaleString();
    const opAvatar = (thread.avatar && typeof AccountManager !== 'undefined') ? AccountManager.getAvatarSrc(thread.avatar) : null;
    const defaultReplyUser = (typeof AccountManager !== 'undefined') ? AccountManager.getUsername() : '';

    const repliesHtml = (thread.replies || []).map(r => {
      const rDate = new Date(r.timestamp).toLocaleString();
      const rAvatar = (r.avatar && typeof AccountManager !== 'undefined') ? AccountManager.getAvatarSrc(r.avatar) : null;
      return `
        <div class="board-reply-box" id="p${escapeHtml(r.id)}">
          <div class="thread-header">
            <span class="thread-author" style="display:inline-flex;align-items:center;gap:4px;">
              ${rAvatar ? `<img src="${rAvatar}" class="account-avatar-mini" style="width:15px;height:15px;" alt="Avatar">` : ''}
              ${escapeHtml(r.author)}
              ${r.verified ? `<span class="forum-verified-badge" title="Verified Account">${CHECK_SVG}</span>` : '<span class="guest-badge">Guest</span>'}
            </span>
            <span class="thread-date">${rDate}</span>
            <span class="thread-id" onclick="ForumApp.quotePost(${JSON.stringify(r.id)}, ${JSON.stringify(thread.id)})">No.${escapeHtml(r.id)}</span>
          </div>
          <div class="thread-body">
            ${formatQuotesAndBlocks(escapeHtml(r.comment))}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="board-op-box" id="p${escapeHtml(thread.id)}">
        <div class="thread-header">
          <span class="thread-subject">${escapeHtml(thread.subject)}</span>
          <span class="thread-author" style="display:inline-flex;align-items:center;gap:4px;">
            ${opAvatar ? `<img src="${opAvatar}" class="account-avatar-mini" style="width:16px;height:16px;" alt="Avatar">` : ''}
            ${escapeHtml(thread.author)}
            ${thread.verified ? `<span class="forum-verified-badge" title="Verified Account">${CHECK_SVG}</span>` : '<span class="guest-badge">Guest</span>'}
          </span>
          <span class="thread-date">${opDate}</span>
          <span class="thread-id" onclick="ForumApp.quotePost(${JSON.stringify(thread.id)}, ${JSON.stringify(thread.id)})">No.${escapeHtml(thread.id)}</span>
          <span class="board-badge">/${escapeHtml(thread.board)}/</span>
        </div>
        <div class="thread-body">
          ${formatQuotesAndBlocks(escapeHtml(thread.comment))}
        </div>
      </div>

      <div class="board-replies-container">
        ${repliesHtml}
      </div>

      <!-- Reply Box -->
      <div class="board-quick-reply-box">
        <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:var(--accent);">Post a Reply</div>
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <input type="text" id="reply-name-${thread.id}" value="${escapeHtml(defaultReplyUser)}" placeholder="Name (optional)" style="flex:1;padding:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:6px;font-size:12px;" />
        </div>
        <textarea id="reply-comment-${thread.id}" placeholder="Write your reply (use > to quote text)..." rows="3" style="width:100%;padding:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:6px;font-size:12px;box-sizing:border-box;"></textarea>
        <div style="margin-top:8px;text-align:right;">
          <button class="btn btn-accent" onclick="ForumApp.submitReply(${JSON.stringify(thread.id)})">Post Reply</button>
        </div>
      </div>
    `;
  }

  function openThread(id) {
    viewingThreadId = id;
    renderForum();
  }

  function quotePost(postId, threadId) {
    const area = document.getElementById(`reply-comment-${threadId}`);
    if (area) {
      area.value += `>>${postId}\n`;
      area.focus();
    }
  }

  // Format quotes using semantic blockquote elements
  function formatQuotesAndBlocks(text) {
    const lines = text.split('\n');
    const processed = [];
    let inQuote = false;
    let quoteLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('&gt;') || trimmed.startsWith('>')) {
        const content = trimmed.startsWith('&gt;') ? trimmed.substring(4) : trimmed.substring(1);
        quoteLines.push(content.trim());
        inQuote = true;
      } else {
        if (inQuote) {
          processed.push(`<blockquote>${quoteLines.join('<br/>')}</blockquote>`);
          quoteLines = [];
          inQuote = false;
        }
        processed.push(line);
      }
    }

    if (inQuote) {
      processed.push(`<blockquote>${quoteLines.join('<br/>')}</blockquote>`);
    }

    return formatQuotes(processed.join('<br/>'));
  }

  function formatQuotes(text) {
    return text.replace(/&gt;&gt;(\d+)|>>(\d+)/g, (match, p1, p2) => {
      const num = p1 || p2;
      return `<a href="#p${num}" class="quote-link">&gt;&gt;${num}</a>`;
    });
  }

  // Strict HTML and attribute escaping (prevent Stored XSS)
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    init,
    openThread,
    submitNewThread,
    submitReply,
    quotePost,
    escapeHtml,
    formatQuotesAndBlocks
  };
})();

if (typeof window !== 'undefined') {
  window.ForumApp = ForumApp;
}
if (typeof module !== 'undefined') {
  module.exports = ForumApp;
}
