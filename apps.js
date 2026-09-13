// Modular Hub Apps Configuration
// To add a new card to the homepage, just add another object here!
const HUB_APPS = [
  {
    id: 'reader',
    title: 'Jujutsu Kaisen',
    tag: 'MANGA READER',
    subtitle: 'All 272 chapters · Single page & Webtoon modes · Offline download',
    themeClass: 'card-jjk',
    bgColor: '#161922',
    accentColor: '#DD53B4',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
    stickerGif: 'assets/cat_accordion.gif',
    stickerClass: 'sticker-accordion'
  },
  {
    id: 'chat',
    title: 'Live Chat Room',
    tag: 'INSTANT CHAT',
    subtitle: 'Browse & create custom rooms · Set passwords · Host kick/ban controls',
    themeClass: 'card-chat',
    bgColor: '#111E2E',
    accentColor: '#38BDF8',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
    stickerGif: 'assets/cat_tuba.gif',
    stickerClass: 'sticker-tuba'
  },
  {
    id: 'forum',
    title: 'The Board',
    tag: 'DISCUSSION BOARD',
    subtitle: 'Threaded discussions · Quotes & replies',
    themeClass: 'card-forum',
    bgColor: '#1E2419',
    accentColor: '#84CC16',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`,
    stickerGif: 'assets/cat_horse.gif',
    stickerClass: 'sticker-horse'
  },
  {
    id: 'notes',
    title: 'Quick Scratchpad',
    tag: 'MINI TOOL',
    subtitle: 'Quick notepad & scratchpad · Auto-saved',
    themeClass: 'card-notes',
    bgColor: '#281E2E',
    accentColor: '#F472B6',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`,
    stickerGif: 'assets/cat_peeking.gif',
    stickerClass: 'sticker-peeking'
  }
];

if (typeof window !== 'undefined') window.HUB_APPS = HUB_APPS;
if (typeof module !== 'undefined' && module.exports) module.exports = HUB_APPS;
