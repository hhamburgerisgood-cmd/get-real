// 4chan-Style Imageboard Forum Engine (Threads, Greentext, Quoting, Profanity Filter)
const ForumApp = (() => {
  const STORAGE_THREADS = 'hub_forum_threads_v1';
  const STORAGE_HANDLE = 'hub_forum_handle_v1';

  let currentBoard = 'all'; // all, gen, manga, school
  let viewingThreadId = null;

  // Sample pre-seeded threads so the board is lively out of the box
  const SEED_THREADS = [
    {
      id: 1001,
      board: 'manga',
      author: 'GojoFan',
      subject: 'Jujutsu Kaisen Chapter 272 Finale Thoughts?',
      comment: '>be me\n>read all 272 chapters on Chromebook at school\n>absolute cinema\nWhat did you guys think of the ending? Best fight in the series?',
      imageUrl: '',
      timestamp: Date.now() - 3600000 * 5,
      replies: [
        {
          id: 1002,
          author: 'SukunaStan',
          comment: '>>1001\n>absolute cinema\nReal and true. Shinjuku Showdown was insane pacing.',
          timestamp: Date.now() - 3600000 * 3
        },
        {
          id: 1003,
          author: 'MegumiEnjoyer',
          comment: '>>1001\nMahoraga adaptation was peak fiction.',
          timestamp: Date.now() - 3600000 * 1
        }
      ]
    },
    {
      id: 1010,
      board: 'school',
      author: 'AnonChromebook',
      subject: 'Get Real works on school wifi!',
      comment: '>teacher thinks I am studying biology\n>actually browsing the board\nMake sure to keep the volume down boys.',
      imageUrl: '',
      timestamp: Date.now() - 3600000 * 2,
      replies: [
        {
          id: 1011,
          author: 'StudyMaster',
          comment: '>>1010\nThe profanity filter keeps us from getting blocked lol',
          timestamp: Date.now() - 3600000 * 1
        }
      ]
    }
  ];

  function init() {
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
      return JSON.parse(localStorage.getItem(STORAGE_THREADS)) || SEED_THREADS;
    } catch (e) {
      return SEED_THREADS;
    }
  }

  function saveThreads(threads) {
    localStorage.setItem(STORAGE_THREADS, JSON.stringify(threads));
  }

  function setupForumEvents() {
    // Board selectors
    document.querySelectorAll('.board-nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.board-nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        currentBoard = link.getAttribute('data-board');
        viewingThreadId = null;
        renderForum();
      });
    });

    // Toggle Post Box
    document.getElementById('btn-toggle-post-box')?.addEventListener('click', () => {
      const box = document.getElementById('forum-post-box');
      if (box) {
        const isOpening = box.style.display === 'none';
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
    document.getElementById('forum-submit-thread-btn')?.addEventListener('click', submitNewThread);

    // Back to catalog button
    document.getElementById('forum-back-catalog-btn')?.addEventListener('click', () => {
      viewingThreadId = null;
      renderForum();
    });
  }

  function submitNewThread() {
    const subjectInput = document.getElementById('post-subject-input');
    const nameInput = document.getElementById('post-name-input');
    const commentInput = document.getElementById('post-comment-input');
    const imageInput = document.getElementById('post-image-input');

    const userHandle = (typeof AccountManager !== 'undefined') ? AccountManager.getUsername() : 'Anonymous';
    const subject = (subjectInput?.value || '').trim();
    const name = (nameInput?.value || '').trim() || userHandle;
    const comment = (commentInput?.value || '').trim();
    const image = (imageInput?.value || '').trim();

    if (!comment) {
      alert('Please enter a comment for your thread.');
      return;
    }

    // Check author uniqueness or handle
    if (!ProfanityFilter.isClean(name)) {
      alert('⚠️ Author name contains disallowed words. Please choose a clean name.');
      return;
    }

    // Apply profanity filter
    const cleanSubject = ProfanityFilter.clean(subject || 'Untitled');
    const cleanComment = ProfanityFilter.clean(comment);

    const threads = getThreads();
    const newId = (threads.length > 0 ? Math.max(...threads.map(t => t.id)) : 1000) + 1;

    const newThread = {
      id: newId,
      board: currentBoard === 'all' ? 'gen' : currentBoard,
      author: name,
      avatar: (typeof AccountManager !== 'undefined') ? AccountManager.getAvatarKey() : 'logo_avatar',
      subject: cleanSubject,
      comment: cleanComment,
      imageUrl: image,
      timestamp: Date.now(),
      replies: []
    };

    threads.unshift(newThread);
    saveThreads(threads);

    if (typeof AccountManager !== 'undefined') {
      AccountManager.trackForumPost(newId);
    }

    // Clear inputs
    if (subjectInput) subjectInput.value = '';
    if (commentInput) commentInput.value = '';
    if (imageInput) imageInput.value = '';
    document.getElementById('forum-post-box').style.display = 'none';

    renderForum();
  }

  function submitReply(threadId) {
    const nameInput = document.getElementById(`reply-name-${threadId}`);
    const commentInput = document.getElementById(`reply-comment-${threadId}`);

    const userHandle = (typeof AccountManager !== 'undefined') ? AccountManager.getUsername() : 'Anonymous';
    const name = (nameInput?.value || '').trim() || userHandle;
    const comment = (commentInput?.value || '').trim();

    if (!comment) {
      alert('Please write a reply.');
      return;
    }

    if (!ProfanityFilter.isClean(name)) {
      alert('⚠️ Name contains disallowed words.');
      return;
    }

    const cleanComment = ProfanityFilter.clean(comment);
    const threads = getThreads();
    const thread = threads.find(t => t.id === threadId);
    if (!thread) return;

    if (!thread.replies) thread.replies = [];
    const replyId = (thread.replies.length > 0 ? Math.max(...thread.replies.map(r => r.id)) : threadId) + 1;

    thread.replies.push({
      id: replyId,
      author: name,
      avatar: (typeof AccountManager !== 'undefined') ? AccountManager.getAvatarKey() : 'logo_avatar',
      comment: cleanComment,
      timestamp: Date.now()
    });

    saveThreads(threads);

    if (typeof AccountManager !== 'undefined') {
      AccountManager.trackForumPost(replyId);
    }

    renderThreadView(thread);
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
        catalogView.style.display = 'none';
        threadView.style.display = 'block';
        renderThreadView(thread);
        return;
      }
    }

    catalogView.style.display = 'block';
    threadView.style.display = 'none';
    renderCatalog();
  }

  function getBoardName(b) {
    switch (b) {
      case 'all': return 'All Boards';
      case 'gen': return 'General Discussion';
      case 'manga': return 'Jujutsu Kaisen & Manga';
      case 'school': return 'School & Tech';
      default: return 'Board';
    }
  }

  function renderCatalog() {
    const list = document.getElementById('forum-threads-list');
    if (!list) return;

    const threads = getThreads().filter(t => currentBoard === 'all' || t.board === currentBoard);
    if (threads.length === 0) {
      list.innerHTML = `<div style="text-align:center;padding:40px;color:#888;">No threads yet on /${currentBoard}/. Click "Start New Thread" above!</div>`;
      return;
    }

    list.innerHTML = threads.map(t => {
      const dateStr = new Date(t.timestamp).toLocaleString();
      const replyCount = (t.replies || []).length;
      const avatarSrc = (t.avatar && typeof AccountManager !== 'undefined') ? AccountManager.getAvatarSrc(t.avatar) : null;
      return `
        <div class="board-thread-card" onclick="ForumApp.openThread(${t.id})">
          <div class="thread-header">
            <span class="thread-subject">${escapeHtml(t.subject)}</span>
            <span class="thread-author" style="display:inline-flex;align-items:center;gap:4px;">
              ${avatarSrc ? `<img src="${avatarSrc}" class="account-avatar-mini" style="width:15px;height:15px;" alt="Avatar">` : ''}
              ${escapeHtml(t.author)}
            </span>
            <span class="thread-date">${dateStr}</span>
            <span class="thread-id">No.${t.id}</span>
            <span class="thread-replies-badge">${replyCount} replies</span>
          </div>
          <div class="thread-body">
            ${formatGreentext(escapeHtml(t.comment))}
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
        <div class="board-reply-box" id="p${r.id}">
          <div class="thread-header">
            <span class="thread-author" style="display:inline-flex;align-items:center;gap:4px;">
              ${rAvatar ? `<img src="${rAvatar}" class="account-avatar-mini" style="width:15px;height:15px;" alt="Avatar">` : ''}
              ${escapeHtml(r.author)}
            </span>
            <span class="thread-date">${rDate}</span>
            <span class="thread-id" onclick="ForumApp.quotePost(${r.id}, ${thread.id})">No.${r.id}</span>
          </div>
          <div class="thread-body">
            ${formatGreentext(formatQuotes(escapeHtml(r.comment)))}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="board-op-box" id="p${thread.id}">
        <div class="thread-header">
          <span class="thread-subject">${escapeHtml(thread.subject)}</span>
          <span class="thread-author" style="display:inline-flex;align-items:center;gap:4px;">
            ${opAvatar ? `<img src="${opAvatar}" class="account-avatar-mini" style="width:16px;height:16px;" alt="Avatar">` : ''}
            ${escapeHtml(thread.author)}
          </span>
          <span class="thread-date">${opDate}</span>
          <span class="thread-id" onclick="ForumApp.quotePost(${thread.id}, ${thread.id})">No.${thread.id}</span>
          <span class="board-badge">/${thread.board}/</span>
        </div>
        <div class="thread-body">
          ${formatGreentext(escapeHtml(thread.comment))}
        </div>
      </div>

      <div class="board-replies-container">
        ${repliesHtml}
      </div>

      <!-- Quick Reply Form -->
      <div class="board-quick-reply-box">
        <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:#800000;">Post a Reply</div>
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <input type="text" id="reply-name-${thread.id}" value="${defaultReplyUser}" placeholder="Name (optional)" style="flex:1;padding:6px;border:1px solid #AAA;font-size:12px;" />
        </div>
        <textarea id="reply-comment-${thread.id}" placeholder="Comment (start with > for greentext)" rows="3" style="width:100%;padding:6px;border:1px solid #AAA;font-size:12px;box-sizing:border-box;"></textarea>
        <div style="margin-top:8px;text-align:right;">
          <button class="btn btn-accent" onclick="ForumApp.submitReply(${thread.id})">Post Reply</button>
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

  function formatGreentext(text) {
    return text.split('\n').map(line => {
      if (line.trim().startsWith('&gt;') || line.trim().startsWith('>')) {
        return `<span class="greentext">${line}</span>`;
      }
      return line;
    }).join('<br/>');
  }

  function formatQuotes(text) {
    return text.replace(/&gt;&gt;(\d+)|>>(\d+)/g, (match, p1, p2) => {
      const num = p1 || p2;
      return `<a href="#p${num}" class="quote-link">&gt;&gt;${num}</a>`;
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init, openThread, submitReply, quotePost };
})();
