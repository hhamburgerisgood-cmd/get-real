// Live Chat Room Engine with Custom Rooms, Passwords & Moderation
const ChatApp = (() => {
  function debounce(fn, delay = 200) {
    let timer = null;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  const STORAGE_USER = 'hub_chat_user_handle';
  const STORAGE_MSGS = 'hub_chat_messages_v2';
  const STORAGE_ROOMS = 'hub_chat_rooms_v2';
  const CHAT_CHANNEL_NAME = 'get_real_chat_broadcast_v2';
  const RATE_LIMIT_COOLDOWN_MS = 1500;
  let lastSentTime = 0;
  let chatUnsubscribe = null;

  const DEFAULT_ROOMS = [
    {
      id: 'lobby',
      name: 'Lobby',
      description: 'Main public chat lobby for everyone',
      creator: 'System',
      isProtected: false,
      password: '',
      bannedUsers: [],
      createdAt: 1700000000000
    },
    {
      id: 'manga-lounge',
      name: 'Manga-Lounge',
      description: 'Jujutsu Kaisen and anime discussion',
      creator: 'System',
      isProtected: false,
      password: '',
      bannedUsers: [],
      createdAt: 1700000000000
    },
    {
      id: 'gaming',
      name: 'Gaming',
      description: 'Talk games, clips, and strats',
      creator: 'System',
      isProtected: false,
      password: '',
      bannedUsers: [],
      createdAt: 1700000000000
    }
  ];

  const ICONS = {
    lock: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
    crown: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="2 4 7 14 12 4 17 14 22 4 20 20 4 20 2 4"></polygon></svg>',
    users: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    pencil: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>',
    trash: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
    check: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    message: '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>'
  };

  let currentRoomId = 'lobby';
  let currentUser = (typeof AccountManager !== 'undefined') ? AccountManager.getUsername() : (localStorage.getItem(STORAGE_USER) || 'Guest');
  let broadcast = null;
  let roomMembers = {};
  let unlockedRooms = new Set(['lobby', 'manga-lounge', 'gaming']);
  let pendingJoinRoomId = null;
  let isInitialized = false;

  function init() {
    initRooms();

    if (isInitialized) {
      renderUserHeader();
      updateRoomHeader();
      renderMessages();
      updateRoomsBadge();
      if (currentUser) {
        announcePresence();
      }
      return;
    }
    isInitialized = true;

    if (typeof AccountManager !== 'undefined') {
      currentUser = AccountManager.getUsername();
      AccountManager.onAccountChange((acc) => {
        currentUser = (acc && acc.username) ? acc.username : (AccountManager.getUsername() || 'Guest');
        renderUserHeader();
        updateRoomHeader();
        announcePresence();
      });
    }

    try {
      broadcast = new BroadcastChannel(CHAT_CHANNEL_NAME);
      broadcast.onmessage = handleIncomingSignal;
    } catch (e) {
      console.log('BroadcastChannel fallback enabled');
    }

    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_MSGS) {
        renderMessages();
      } else if (e.key === STORAGE_ROOMS) {
        updateRoomsBadge();
        if (document.getElementById('chat-modal-browse')?.style.display === 'flex') {
          renderRoomsList();
        }
      }
    });

    renderUserHeader();
    updateRoomHeader();
    renderMessages();
    setupInputs();
    updateRoomsBadge();

    if (typeof FirebaseService !== 'undefined') {
      chatUnsubscribe = FirebaseService.onChatMessages(currentRoomId, () => {
        renderMessages();
      });
    }

    if (currentUser) {
      announcePresence();
    }
  }

  // ROOMS STORAGE & HELPERS
  function initRooms() {
    const existing = localStorage.getItem(STORAGE_ROOMS);
    if (!existing) {
      localStorage.setItem(STORAGE_ROOMS, JSON.stringify(DEFAULT_ROOMS));
    }
  }

  function getRooms() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_ROOMS));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
    return [...DEFAULT_ROOMS];
  }

  function saveRooms(rooms) {
    localStorage.setItem(STORAGE_ROOMS, JSON.stringify(rooms));
    updateRoomsBadge();
    sendSignal({ type: 'rooms_updated' });
  }

  function getCurrentRoom() {
    const rooms = getRooms();
    return rooms.find(r => r.id === currentRoomId) || rooms[0] || DEFAULT_ROOMS[0];
  }

  function isHostOfCurrentRoom() {
    if (!currentUser) return false;
    const room = getCurrentRoom();
    return room.creator.toLowerCase() === currentUser.toLowerCase();
  }

  function isUserBannedFromRoom(room, username) {
    if (!room.bannedUsers || !Array.isArray(room.bannedUsers)) return false;
    return room.bannedUsers.some(u => u.toLowerCase() === username.toLowerCase());
  }

  // SIGNALS & BROADCAST
  function sendSignal(data) {
    if (broadcast) {
      try { broadcast.postMessage(data); } catch (e) {}
    }
  }

  function announcePresence() {
    if (!currentUser) return;
    trackRoomMember(currentRoomId, currentUser);
    sendSignal({ type: 'presence', user: currentUser, room: currentRoomId });
  }

  function trackRoomMember(roomId, username) {
    if (!roomId || !username) return;
    if (!roomMembers[roomId]) roomMembers[roomId] = new Set();
    roomMembers[roomId].add(username);
    updateMembersBadge();
  }

  function handleIncomingSignal(e) {
    const data = e.data;
    if (!data) return;

    if (data.type === 'msg') {
      if (data.roomId === currentRoomId) {
        const msgs = getMessages();
        const msg = msgs.find(m => m.id === data.id);
        if (msg) {
          appendSingleMessage(msg);
        } else {
          renderMessages();
        }
        playNotificationSound();
      }
    } else if (data.type === 'presence') {
      trackRoomMember(data.room, data.user);
      if (currentUser && data.user !== currentUser && data.room === currentRoomId) {
        sendSignal({ type: 'presence_ack', user: currentUser, room: currentRoomId });
      }
    } else if (data.type === 'presence_ack') {
      trackRoomMember(data.room, data.user);
    } else if (data.type === 'kick') {
      if (data.roomId === currentRoomId && currentUser && data.targetUser.toLowerCase() === currentUser.toLowerCase()) {
        alert(`You were removed from #${data.roomName} by the host.`);
        joinRoom('lobby');
      }
    } else if (data.type === 'ban') {
      if (data.roomId === currentRoomId && currentUser && data.targetUser.toLowerCase() === currentUser.toLowerCase()) {
        alert(`You have been banned from #${data.roomName} by the host.`);
        joinRoom('lobby');
      }
    } else if (data.type === 'room_deleted') {
      if (data.roomId === currentRoomId) {
        alert(`The room #${data.roomName} was closed by the host. Returning to Lobby.`);
        joinRoom('lobby');
      }
      updateRoomsBadge();
      if (document.getElementById('chat-modal-browse')?.style.display === 'flex') {
        renderRoomsList();
      }
    } else if (data.type === 'rooms_updated') {
      updateRoomsBadge();
      if (document.getElementById('chat-modal-browse')?.style.display === 'flex') {
        renderRoomsList();
      }
    }
  }

  // MESSAGES STORAGE
  function getMessages() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_MSGS)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveMessage(msg) {
    let msgs = getMessages();
    msgs.push(msg);
    if (msgs.length > 250) msgs = msgs.slice(-250);
    localStorage.setItem(STORAGE_MSGS, JSON.stringify(msgs));
    sendSignal({ type: 'msg', roomId: msg.channel, id: msg.id });
    appendSingleMessage(msg);
  }

  // USER MANAGEMENT
  function renderUserHeader() {
    const userBadge = document.getElementById('chat-current-user-badge');
    if (userBadge) {
      userBadge.textContent = currentUser ? `@${currentUser}` : 'Set Username';
    }
    const userAvatar = document.querySelector('#chat-change-user-btn .account-avatar-mini');
    if (userAvatar && typeof AccountManager !== 'undefined') {
      userAvatar.src = AccountManager.getAvatarSrc();
    }
  }

  function promptForUsername() {
    if (typeof AccountManager !== 'undefined') {
      AccountManager.openModal('profile');
      return;
    }

    const name = prompt('Choose a unique username handle:', currentUser || '');
    if (!name) return;

    const trimmed = name.trim().replace(/^@/, '');
    if (!trimmed) return;

    if (typeof ProfanityFilter !== 'undefined' && !ProfanityFilter.isClean(trimmed)) {
      alert('Username contains disallowed language. Please choose a clean username.');
      return;
    }

    currentUser = trimmed;
    localStorage.setItem(STORAGE_USER, currentUser);
    renderUserHeader();
    updateRoomHeader();
    announcePresence();
  }

  // ROOM NAVIGATION & HEADER UI
  function updateRoomHeader() {
    const room = getCurrentRoom();
    const nameText = document.getElementById('chat-room-name-text');
    const lockIcon = document.getElementById('chat-room-lock-icon');
    const hostBadge = document.getElementById('chat-room-host-badge');
    const bannerTitle = document.getElementById('chat-banner-room-title');
    const bannerDesc = document.getElementById('chat-banner-room-desc');
    const bannerHost = document.getElementById('chat-banner-room-host');

    if (nameText) nameText.textContent = room.name;
    if (lockIcon) lockIcon.style.display = room.isProtected ? 'inline-flex' : 'none';
    if (hostBadge) hostBadge.style.display = isHostOfCurrentRoom() ? 'inline-flex' : 'none';

    if (bannerTitle) bannerTitle.textContent = `#${room.name}`;
    if (bannerDesc) bannerDesc.textContent = room.description || (room.isProtected ? 'Private password-protected room' : 'Public chat room');
    if (bannerHost) {
      const isYou = currentUser && room.creator.toLowerCase() === currentUser.toLowerCase();
      bannerHost.textContent = `Host: @${room.creator} ${isYou ? '(You)' : ''}`;
    }

    updateMembersBadge();
  }

  function updateRoomsBadge() {
    const badge = document.getElementById('chat-rooms-badge');
    if (badge) {
      badge.textContent = getRooms().length;
    }
  }

  function updateMembersBadge() {
    const badge = document.getElementById('chat-members-badge');
    if (badge) {
      const set = roomMembers[currentRoomId] || new Set();
      const count = Math.max(1, set.size + (currentUser ? 1 : 0));
      badge.textContent = count;
    }
  }

  // ROOM SWITCHING
  function joinRoom(roomId) {
    const rooms = getRooms();
    const targetRoom = rooms.find(r => r.id === roomId);
    if (!targetRoom) return;

    if (currentUser && isUserBannedFromRoom(targetRoom, currentUser)) {
      alert(`You are banned from #${targetRoom.name} by the host.`);
      return;
    }

    const isHost = currentUser && targetRoom.creator.toLowerCase() === currentUser.toLowerCase();
    if (targetRoom.isProtected && !isHost && !unlockedRooms.has(roomId)) {
      openPasswordModal(roomId);
      return;
    }

    if (typeof chatUnsubscribe === 'function') {
      chatUnsubscribe();
      chatUnsubscribe = null;
    }

    currentRoomId = roomId;

    if (typeof FirebaseService !== 'undefined') {
      chatUnsubscribe = FirebaseService.onChatMessages(currentRoomId, () => {
        renderMessages();
      });
    }

    closeModals();
    updateRoomHeader();
    renderMessages();
    announcePresence();
  }

  // MODALS: BROWSE ROOMS
  function openBrowseModal() {
    closeModals();
    const modal = document.getElementById('chat-modal-browse');
    if (modal) {
      modal.style.display = 'flex';
      renderRoomsList();
      const searchInput = document.getElementById('chat-room-search-input');
      if (searchInput) {
        searchInput.value = '';
        searchInput.oninput = debounce((e) => renderRoomsList(e.target.value), 150);
      }
    }
  }

  function renderRoomsList(filter = '') {
    const container = document.getElementById('chat-rooms-list');
    if (!container) return;

    const rooms = getRooms().filter(r => {
      const q = filter.toLowerCase().trim();
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q);
    });

    if (rooms.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:30px;color:var(--text-muted);">
          <div>No rooms match "${escapeHtml(filter)}"</div>
          <button class="btn btn-accent" onclick="ChatApp.openCreateRoomModal()" style="margin-top:10px;">Create Room</button>
        </div>
      `;
      return;
    }

    container.innerHTML = rooms.map(room => {
      const isCurrent = room.id === currentRoomId;
      const isCreator = currentUser && room.creator.toLowerCase() === currentUser.toLowerCase();
      const count = Math.max(1, (roomMembers[room.id]?.size || 0) + (isCurrent && currentUser ? 1 : 0));

      return `
        <div class="room-item-card ${isCurrent ? 'is-current' : ''}">
          <div class="room-item-left">
            <div class="room-item-name">
              <span>#${escapeHtml(room.name)}</span>
              ${room.isProtected ? `<span title="Password Protected" style="display:inline-flex;align-items:center;">${ICONS.lock}</span>` : ''}
              ${isCreator ? `<span style="background:#F59E0B;color:#000;font-size:10px;font-weight:900;padding:1px 5px;border-radius:6px;display:inline-flex;align-items:center;gap:3px;">${ICONS.crown} Host</span>` : ''}
            </div>
            <div class="room-item-desc">${escapeHtml(room.description || (room.isProtected ? 'Private Room' : 'Public Room'))}</div>
            <div class="room-item-meta">
              <span>Host: @${escapeHtml(room.creator)}</span>
              <span>-</span>
              <span style="display:inline-flex;align-items:center;gap:3px;">${ICONS.users} ${count} online</span>
              ${room.bannedUsers && room.bannedUsers.length > 0 && isCreator ? `<span>-</span><span style="color:#F87171;">${room.bannedUsers.length} banned</span>` : ''}
            </div>
          </div>
          <div class="room-item-actions">
            ${isCurrent ? `
              <span style="font-size:11px;font-weight:800;color:var(--accent);padding:5px 10px;">In Room</span>
            ` : `
              <button class="btn btn-pill" onclick="ChatApp.joinRoom(${JSON.stringify(room.id)})" style="font-size:11px;">
                ${room.isProtected && !isCreator && !unlockedRooms.has(room.id) ? 'Unlock' : 'Enter'}
              </button>
            `}
            ${isCreator && room.id !== 'lobby' ? `
              <button class="btn btn-pill" onclick="ChatApp.deleteRoom(${JSON.stringify(room.id)})" style="color:#EF4444;border-color:#7F1D1D;padding:4px 8px;" title="Delete this room">${ICONS.trash}</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // MODALS: CREATE ROOM
  function openCreateRoomModal() {
    closeModals();
    if (!currentUser) {
      promptForUsername();
      if (!currentUser) return;
    }

    const modal = document.getElementById('chat-modal-create');
    if (modal) {
      modal.style.display = 'flex';
      document.getElementById('new-room-name-input').value = '';
      document.getElementById('new-room-desc-input').value = '';
      document.getElementById('new-room-is-protected').checked = false;
      document.getElementById('new-room-password-input').value = '';
      document.getElementById('new-room-password-container').style.display = 'none';
      document.getElementById('new-room-name-input').focus();
    }
  }

  function togglePasswordFields() {
    const isChecked = document.getElementById('new-room-is-protected').checked;
    const container = document.getElementById('new-room-password-container');
    if (container) {
      container.style.display = isChecked ? 'block' : 'none';
      if (isChecked) {
        document.getElementById('new-room-password-input').focus();
      }
    }
  }

  function submitCreateRoom() {
    if (!currentUser) {
      promptForUsername();
      if (!currentUser) return;
    }

    const nameInput = document.getElementById('new-room-name-input');
    const descInput = document.getElementById('new-room-desc-input');
    const isProtected = document.getElementById('new-room-is-protected').checked;
    const passwordInput = document.getElementById('new-room-password-input');

    let roomName = nameInput.value.trim().replace(/^#+/, '').replace(/\s+/g, '-');
    if (!roomName) {
      alert('Please provide a room name.');
      return;
    }

    if (typeof ProfanityFilter !== 'undefined' && (!ProfanityFilter.isClean(roomName) || !ProfanityFilter.isClean(descInput.value))) {
      alert('Room name or description contains disallowed language.');
      return;
    }

    const rooms = getRooms();
    if (rooms.some(r => r.name.toLowerCase() === roomName.toLowerCase())) {
      alert(`A room named #${roomName} already exists. Please choose a different name!`);
      return;
    }

    let pass = '';
    if (isProtected) {
      pass = passwordInput.value.trim();
      if (!pass) {
        alert('Please enter a password for this protected room, or uncheck the password protection option.');
        return;
      }
    }

    const newRoom = {
      id: 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: roomName,
      description: descInput.value.trim(),
      creator: currentUser,
      isProtected: isProtected,
      password: pass,
      bannedUsers: [],
      createdAt: Date.now()
    };

    rooms.push(newRoom);
    saveRooms(rooms);
    unlockedRooms.add(newRoom.id);

    saveMessage({
      id: 'sys_' + Date.now(),
      channel: newRoom.id,
      user: 'SYSTEM',
      text: `Room #${newRoom.name} was created by @${currentUser}.${isProtected ? ' (Password Protected)' : ''}`,
      isSystem: true,
      timestamp: Date.now()
    });

    joinRoom(newRoom.id);
  }

  // MODALS: PASSWORD PROMPT
  function openPasswordModal(roomId) {
    const room = getRooms().find(r => r.id === roomId);
    if (!room) return;

    pendingJoinRoomId = roomId;
    closeModals();

    const modal = document.getElementById('chat-modal-password');
    const text = document.getElementById('chat-pwd-modal-text');
    const input = document.getElementById('chat-join-password-input');
    const err = document.getElementById('chat-password-error');

    if (modal) {
      modal.style.display = 'flex';
      if (text) text.textContent = `Enter password to join #${room.name}:`;
      if (input) {
        input.value = '';
        input.focus();
      }
      if (err) err.style.display = 'none';
    }
  }

  function submitPasswordAttempt() {
    const room = getRooms().find(r => r.id === pendingJoinRoomId);
    if (!room) return;

    const input = document.getElementById('chat-join-password-input');
    const err = document.getElementById('chat-password-error');
    const entered = (input.value || '').trim();

    if (entered === room.password) {
      unlockedRooms.add(room.id);
      joinRoom(room.id);
    } else {
      if (err) err.style.display = 'block';
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  }

  // MODALS: MEMBERS & HOST CONTROLS
  function openMembersModal() {
    closeModals();
    const modal = document.getElementById('chat-modal-members');
    if (modal) {
      modal.style.display = 'flex';
      renderMembersModal();
    }
  }

  function renderMembersModal() {
    const room = getCurrentRoom();
    const title = document.getElementById('chat-members-modal-title');
    const subtitle = document.getElementById('chat-members-modal-subtitle');
    const activeList = document.getElementById('chat-members-list-active');
    const bannedSection = document.getElementById('chat-host-banned-section');
    const bannedList = document.getElementById('chat-members-list-banned');

    const isHost = isHostOfCurrentRoom();

    if (title) title.textContent = `#${room.name} Members`;
    if (subtitle) {
      subtitle.textContent = isHost ? 'You are the Host! You can kick or ban members from this room.' : `Hosted by @${room.creator}`;
    }

    const activeSet = new Set(roomMembers[currentRoomId] || []);
    if (currentUser) activeSet.add(currentUser);

    const membersArr = Array.from(activeSet);

    if (activeList) {
      if (membersArr.length === 0) {
        activeList.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:10px;">No other members online.</div>`;
      } else {
        activeList.innerHTML = membersArr.map(member => {
          const isMe = currentUser && member.toLowerCase() === currentUser.toLowerCase();
          const isCreator = room.creator.toLowerCase() === member.toLowerCase();

          return `
            <div class="member-item-row">
              <div class="member-item-user">
                <span>@${escapeHtml(member)}</span>
                ${isCreator ? `<span style="background:#F59E0B;color:#000;font-size:9px;font-weight:900;padding:1px 5px;border-radius:6px;display:inline-flex;align-items:center;gap:2px;">${ICONS.crown} HOST</span>` : ''}
                ${isMe ? '<span style="background:var(--border);color:var(--text-muted);font-size:9px;padding:1px 5px;border-radius:6px;">YOU</span>' : ''}
              </div>
              <div class="member-item-actions">
                ${isHost && !isMe ? `
                  <button class="btn-host-action" onclick="ChatApp.kickUser(${JSON.stringify(member)})">Kick</button>
                  <button class="btn-host-action" onclick="ChatApp.banUser(${JSON.stringify(member)})">Ban</button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Banned users section
    if (bannedSection && bannedList) {
      if (isHost && room.bannedUsers && room.bannedUsers.length > 0) {
        bannedSection.style.display = 'block';
        bannedList.innerHTML = room.bannedUsers.map(banned => `
          <div class="member-item-row" style="background:#261214;border-color:#7F1D1D;">
            <div class="member-item-user" style="color:#FCA5A5;">
              <span>@${escapeHtml(banned)}</span>
              <span style="font-size:9px;background:#7F1D1D;color:#FECDD3;padding:1px 5px;border-radius:6px;">BANNED</span>
            </div>
            <button class="btn btn-pill" onclick="ChatApp.unbanUser(${JSON.stringify(banned)})" style="font-size:10px;padding:2px 8px;border-color:#F87171;color:#F87171;">
              Unban
            </button>
          </div>
        `).join('');
      } else {
        bannedSection.style.display = 'none';
      }
    }
  }

  function closeModals() {
    ['chat-modal-browse', 'chat-modal-create', 'chat-modal-password', 'chat-modal-members'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  // HOST ACTIONS: KICK, BAN, UNBAN, DELETE
  function kickUser(targetUser) {
    if (!isHostOfCurrentRoom()) {
      alert('Only the room host can kick members.');
      return;
    }
    if (targetUser.toLowerCase() === currentUser.toLowerCase()) {
      alert('You cannot kick yourself!');
      return;
    }

    const room = getCurrentRoom();
    if (!confirm(`Kick @${targetUser} from #${room.name}?\n\nThey will be removed from this room and sent to the Lobby.`)) return;

    sendSignal({
      type: 'kick',
      roomId: currentRoomId,
      roomName: room.name,
      targetUser: targetUser,
      host: currentUser
    });

    saveMessage({
      id: 'sys_' + Date.now(),
      channel: currentRoomId,
      user: 'SYSTEM',
      text: `@${targetUser} was kicked from the room by the host.`,
      isSystem: true,
      timestamp: Date.now()
    });

    if (roomMembers[currentRoomId]) {
      roomMembers[currentRoomId].delete(targetUser);
    }

    renderMembersModal();
  }

  function banUser(targetUser) {
    if (!isHostOfCurrentRoom()) {
      alert('Only the room host can ban members.');
      return;
    }
    if (targetUser.toLowerCase() === currentUser.toLowerCase()) {
      alert('You cannot ban yourself!');
      return;
    }

    const rooms = getRooms();
    const room = rooms.find(r => r.id === currentRoomId);
    if (!room) return;

    if (!confirm(`Ban @${targetUser} from #${room.name}?\n\nThey will be removed immediately and blocked from re-entering.`)) return;

    if (!room.bannedUsers) room.bannedUsers = [];
    if (!room.bannedUsers.includes(targetUser)) {
      room.bannedUsers.push(targetUser);
    }
    saveRooms(rooms);

    sendSignal({
      type: 'ban',
      roomId: currentRoomId,
      roomName: room.name,
      targetUser: targetUser,
      host: currentUser
    });

    saveMessage({
      id: 'sys_' + Date.now(),
      channel: currentRoomId,
      user: 'SYSTEM',
      text: `@${targetUser} was permanently banned from the room by the host.`,
      isSystem: true,
      timestamp: Date.now()
    });

    if (roomMembers[currentRoomId]) {
      roomMembers[currentRoomId].delete(targetUser);
    }

    renderMembersModal();
  }

  function unbanUser(targetUser) {
    if (!isHostOfCurrentRoom()) return;

    const rooms = getRooms();
    const room = rooms.find(r => r.id === currentRoomId);
    if (!room) return;

    room.bannedUsers = (room.bannedUsers || []).filter(u => u.toLowerCase() !== targetUser.toLowerCase());
    saveRooms(rooms);

    saveMessage({
      id: 'sys_' + Date.now(),
      channel: currentRoomId,
      user: 'SYSTEM',
      text: `@${targetUser} was unbanned by the host.`,
      isSystem: true,
      timestamp: Date.now()
    });

    renderMembersModal();
  }

  function deleteRoom(roomId) {
    const rooms = getRooms();
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    if (room.id === 'lobby') {
      alert('The Lobby cannot be deleted.');
      return;
    }

    if (room.creator.toLowerCase() !== (currentUser || '').toLowerCase()) {
      alert('Only the room host can delete this room.');
      return;
    }

    if (!confirm(`Are you sure you want to delete #${room.name}?\nAll active members will be returned to the Lobby.`)) return;

    const updated = rooms.filter(r => r.id !== roomId);
    saveRooms(updated);

    sendSignal({
      type: 'room_deleted',
      roomId: roomId,
      roomName: room.name
    });

    if (currentRoomId === roomId) {
      joinRoom('lobby');
    } else {
      renderRoomsList();
    }
  }

  // MESSAGING & CHAT INPUTS
  function setupInputs() {
    const input = document.getElementById('chat-input-box');
    const sendBtn = document.getElementById('chat-send-btn');
    const changeUserBtn = document.getElementById('chat-change-user-btn');

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', sendMessage);
    }

    if (changeUserBtn) {
      changeUserBtn.addEventListener('click', promptForUsername);
    }
  }

  async function sendMessage() {
    const now = Date.now();
    if (now - lastSentTime < RATE_LIMIT_COOLDOWN_MS) {
      alert('Please wait a moment before sending another message (rate limit cooldown).');
      return;
    }

    if (!currentUser) {
      promptForUsername();
      if (!currentUser) return;
    }

    const room = getCurrentRoom();
    if (isUserBannedFromRoom(room, currentUser)) {
      alert(`You are banned from #${room.name} and cannot send messages.`);
      joinRoom('lobby');
      return;
    }

    const input = document.getElementById('chat-input-box');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    lastSentTime = now;

    const cleanedText = typeof ProfanityFilter !== 'undefined' ? ProfanityFilter.clean(text) : text;

    // Anti-impersonation check
    if (typeof AccountManager !== 'undefined') {
      const isAuth = AccountManager.isAuthenticated();
      if (!isAuth && AccountManager.isUsernameRegistered(currentUser)) {
        alert('The username "@' + currentUser + '" is registered and password-protected.\n\nPlease log in, or choose a different nickname.');
        AccountManager.openModal('login');
        return;
      }
    }

    const isVerified = (typeof AccountManager !== 'undefined') ? AccountManager.isAuthenticated() : false;

    const msg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      channel: currentRoomId,
      user: currentUser,
      verified: isVerified,
      avatar: (typeof AccountManager !== 'undefined') ? AccountManager.getAvatarKey() : 'logo_avatar',
      text: cleanedText,
      timestamp: Date.now()
    };

    if (typeof FirebaseService !== 'undefined') {
      await FirebaseService.sendChatMessage(currentRoomId, {
        author: currentUser,
        text: cleanedText,
        verified: isVerified,
        timestamp: Date.now()
      });
    }

    saveMessage(msg);
    if (input) input.value = '';
  }

  function createMessageElement(m) {
    const isHost = isHostOfCurrentRoom();
    const isMe = currentUser && m.user && m.user.toLowerCase() === currentUser.toLowerCase();
    const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const avatarSrc = (typeof AccountManager !== 'undefined') ? AccountManager.getAvatarSrc(m.avatar) : 'assets/logo_avatar.gif';

    const div = document.createElement('div');
    if (m.id) div.setAttribute('data-msg-id', m.id);

    if (m.isSystem) {
      div.className = 'chat-msg msg-system';
      div.textContent = m.text;
      return div;
    }

    div.className = `chat-msg ${isMe ? 'msg-own' : ''}`;
    div.innerHTML = `
      <div class="msg-header">
        <div style="display:flex;align-items:center;gap:6px;">
          <img src="${avatarSrc}" class="account-avatar-mini" style="width:18px;height:18px;" alt="Avatar">
          <span class="msg-user">@${escapeHtml(m.user)}</span>${m.verified ? `<span class="chat-verified-badge" title="Verified Account">${ICONS.check}</span>` : '<span class="guest-badge">Guest</span>'}
        </div>
        <span class="msg-time">${timeStr}</span>
        ${isHost && !isMe ? `
          <div class="msg-host-actions">
            <button class="btn-host-action" onclick="ChatApp.kickUser(${JSON.stringify(m.user)})">Kick</button>
            <button class="btn-host-action" onclick="ChatApp.banUser(${JSON.stringify(m.user)})">Ban</button>
          </div>
        ` : ''}
      </div>
      <div class="msg-body">${escapeHtml(m.text)}</div>
    `;
    return div;
  }

  function appendSingleMessage(m) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;
    if (m.channel !== currentRoomId) return;

    const emptyEl = container.querySelector('.chat-empty');
    if (emptyEl) emptyEl.remove();

    if (m.id && container.querySelector(`[data-msg-id="${m.id}"]`)) return;

    const el = createMessageElement(m);
    container.appendChild(el);

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }

  function renderMessages() {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    const room = getCurrentRoom();
    const msgs = getMessages().filter(m => m.channel === currentRoomId);

    if (msgs.length === 0) {
      container.innerHTML = `
        <div class="chat-empty" style="text-align:center;padding:40px 20px;color:var(--text-muted);">
          <div style="margin-bottom:8px;display:flex;justify-content:center;">${ICONS.message}</div>
          <div style="font-weight:800;font-size:16px;color:var(--text);">#${escapeHtml(room.name)} is quiet...</div>
          <div style="font-size:12px;margin-top:4px;">Be the first to say hi in this room!</div>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();
    msgs.forEach(m => {
      fragment.appendChild(createMessageElement(m));
    });

    container.innerHTML = '';
    container.appendChild(fragment);

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }

  function playNotificationSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  }

  // Sanitization prevents stored XSS such as &lt;script&gt; or &lt;img src=x onerror=...&gt;
  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    init,
    renderMessages,
    appendSingleMessage,
    createMessageElement,
    promptForUsername,
    openBrowseModal,
    openCreateRoomModal,
    togglePasswordFields,
    submitCreateRoom,
    openPasswordModal,
    submitPasswordAttempt,
    openMembersModal,
    closeModals,
    joinRoom,
    kickUser,
    banUser,
    unbanUser,
    deleteRoom,
    escapeHtml,
    sendMessage
  };
})();

if (typeof window !== 'undefined') {
  window.ChatApp = ChatApp;
}
if (typeof module !== 'undefined') {
  module.exports = ChatApp;
}
