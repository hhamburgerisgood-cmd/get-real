/**
 * firebase-config.js
 * Get Real - Firebase Integration & Offline Fallback Service
 * Supports Firebase v10 Auth and Cloud Firestore with transparent offline/localStorage fallback.
 */

const firebaseConfig = {
  apiKey: "AIzaSyB0iTRR8EVcXfykeFZ1E-D4GcWRHF95Q34",
  authDomain: "get-real-515ba.firebaseapp.com",
  projectId: "get-real-515ba",
  storageBucket: "get-real-515ba.firebasestorage.app",
  messagingSenderId: "313486045427",
  appId: "1:313486045427:web:8be419842a8be0d0b4c786"
};

(function() {
  const isPlaceholderKey = !firebaseConfig.apiKey || 
                           firebaseConfig.apiKey === "YOUR_API_KEY" || 
                           firebaseConfig.apiKey.includes("YOUR_");

  const isConfigured = !isPlaceholderKey;

  // Local fallback storage keys
  const CHAT_STORAGE_KEY = 'hub_chat_messages_v2';
  const FORUM_STORAGE_KEY = 'hub_forum_threads_v1';

  function getLocalChat() {
    try {
      return JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveLocalChat(data) {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function getLocalThreads() {
    try {
      return JSON.parse(localStorage.getItem(FORUM_STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveLocalThreads(data) {
    try {
      localStorage.setItem(FORUM_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  const FirebaseService = {
    isConfigured: isConfigured,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    auth: null,
    db: null,

    // Initialize Firebase if configured
    init: function() {
      if (this.isConfigured && typeof window !== 'undefined' && window.firebase) {
        try {
          if (!window.firebase.apps || !window.firebase.apps.length) {
            window.firebase.initializeApp(firebaseConfig);
          }
          this.auth = window.firebase.auth ? window.firebase.auth() : null;
          this.db = window.firebase.firestore ? window.firebase.firestore() : null;
        } catch (err) {
          console.warn('Firebase initialization failed, falling back to local storage:', err);
          this.isConfigured = false;
        }
      }
      this.updateBanner();
    },

    updateBanner: function() {
      if (typeof document === 'undefined') return;
      const banner = document.getElementById('firebase-fallback-banner');
      if (banner) {
        if (!this.isConfigured) {
          banner.style.display = 'flex';
        } else {
          banner.style.display = 'none';
        }
      }
    },

    // Chat Service Methods
    onChatMessages: function(roomId, callback) {
      if (this.isConfigured && this.db) {
        try {
          return this.db.collection('chat_rooms').doc(roomId).collection('messages')
            .orderBy('timestamp', 'asc')
            .limitToLast(100)
            .onSnapshot(snapshot => {
              const msgs = [];
              snapshot.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
              callback(msgs);
            }, err => {
              console.warn('Firestore chat listener error, using fallback:', err);
            });
        } catch (e) {}
      }

      // Offline / Local fallback
      const messagesMap = getLocalChat();
      const msgs = messagesMap[roomId] || [];
      callback(msgs);

      // Return no-op unsubscribe
      return function() {};
    },

    sendChatMessage: async function(roomId, messageData) {
      const msg = {
        author: messageData.author || 'Guest',
        text: messageData.text || '',
        timestamp: messageData.timestamp || Date.now(),
        verified: !!messageData.verified
      };

      if (this.isConfigured && this.db) {
        try {
          await this.db.collection('chat_rooms').doc(roomId).collection('messages').add(msg);
          return;
        } catch (e) {
          console.warn('Firestore sendChatMessage error, saving locally:', e);
        }
      }

      // Offline fallback
      const messagesMap = getLocalChat();
      if (!messagesMap[roomId]) messagesMap[roomId] = [];
      messagesMap[roomId].push(msg);
      if (messagesMap[roomId].length > 100) {
        messagesMap[roomId] = messagesMap[roomId].slice(-100);
      }
      saveLocalChat(messagesMap);
    },

    // Forum Service Methods
    onForumThreads: function(boardId, callback) {
      if (this.isConfigured && this.db) {
        try {
          let query = this.db.collection('forum_threads');
          if (boardId && boardId !== 'all') {
            query = query.where('board', '==', boardId);
          }
          return query.orderBy('timestamp', 'desc').onSnapshot(snapshot => {
            const threads = [];
            snapshot.forEach(doc => threads.push({ id: doc.id, ...doc.data() }));
            callback(threads);
          }, err => {
            console.warn('Firestore forum listener error:', err);
          });
        } catch (e) {}
      }

      // Offline fallback
      const threads = getLocalThreads();
      const filtered = (boardId && boardId !== 'all') 
        ? threads.filter(t => t.board === boardId) 
        : threads;
      callback(filtered);
      return function() {};
    },

    postForumThread: async function(threadData) {
      const threadId = 'th_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      const newThread = {
        id: threadId,
        board: threadData.board || 'all',
        author: threadData.author || 'Guest',
        subject: threadData.subject || '',
        comment: threadData.comment || '',
        imageUrl: threadData.imageUrl || '',
        timestamp: threadData.timestamp || Date.now(),
        verified: !!threadData.verified,
        replies: []
      };

      if (this.isConfigured && this.db) {
        try {
          const docRef = await this.db.collection('forum_threads').add(newThread);
          return docRef.id;
        } catch (e) {
          console.warn('Firestore postForumThread error, saving locally:', e);
        }
      }

      // Offline fallback
      const threads = getLocalThreads();
      threads.unshift(newThread);
      saveLocalThreads(threads);
      return threadId;
    },

    onThreadReplies: function(threadId, callback) {
      if (this.isConfigured && this.db) {
        try {
          return this.db.collection('forum_threads').doc(threadId).collection('replies')
            .orderBy('timestamp', 'asc').onSnapshot(snapshot => {
              const replies = [];
              snapshot.forEach(doc => replies.push({ id: doc.id, ...doc.data() }));
              callback(replies);
            });
        } catch (e) {}
      }

      const threads = getLocalThreads();
      const thread = threads.find(t => t.id === threadId);
      callback(thread && thread.replies ? thread.replies : []);
      return function() {};
    },

    postThreadReply: async function(threadId, replyData) {
      const reply = {
        id: 'rep_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        author: replyData.author || 'Guest',
        comment: replyData.comment || '',
        timestamp: replyData.timestamp || Date.now(),
        verified: !!replyData.verified
      };

      if (this.isConfigured && this.db) {
        try {
          await this.db.collection('forum_threads').doc(threadId).collection('replies').add(reply);
          return;
        } catch (e) {}
      }

      // Offline fallback
      const threads = getLocalThreads();
      const thread = threads.find(t => t.id === threadId);
      if (thread) {
        if (!thread.replies) thread.replies = [];
        thread.replies.push(reply);
        saveLocalThreads(threads);
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.FirebaseService = FirebaseService;
    window.addEventListener('DOMContentLoaded', () => FirebaseService.init());
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FirebaseService;
  }
})();
