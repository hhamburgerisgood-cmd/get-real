## 2026-09-13T07:52:31Z
You are worker_m4_1.
Your Working Directory is: C:\Users\User\Desktop\Get Real\.agents\worker_m4_1
Workspace Root: C:\Users\User\Desktop\Get Real

MANDATORY: Read C:\Users\User\Desktop\Get Real\ORIGINAL_REQUEST.md and C:\Users\User\Desktop\Get Real\PROJECT.md before doing any work.
Read the detailed exploration report at C:\Users\User\Desktop\Get Real\.agents\explorer_survey_1\handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Milestone M4 Scope: Runtime Bug Fixes & Performance Optimization (Features F14 to F22).
Files you own exclusively:
- C:\Users\User\Desktop\Get Real\app.js
- (and helper optimization in chat.js for layout thrashing)

Tasks to implement:
1. Fix fatal DOMContentLoaded ReferenceErrors in app.js:
   - Line 66: replace `setupEventListeners();` with `setupReaderControls();`
   - Line 67: replace `updateBookmarkCountBadge();` with `updateBookmarksBadge();`
2. Ensure full initialization executes reliably on load:
   - Chapter 1 auto-loads on startup (`selectChapter(allChapters[0], 0)`).
   - Scratchpad text area initializes from AccountManager/localStorage and attaches debounced auto-save listener.
   - Account change listener attaches.
3. Scope keyboard shortcuts in `handleKeyDown` (app.js:398):
   - Only handle shortcuts if reader view (`#view-reader`) and reader subview (`#rsub-reader`) are active.
   - Prevent default behavior appropriately (e.g. Spacebar scroll).
4. Update `selectChapter` in app.js so the sidebar catalog updates the `.chapter-item.selected` class on the active chapter.
5. Implement debounce utility in app.js for `#search-input`, scratchpad saves, and resize.
6. Optimize reader image loading:
   - Add `decoding="async"` to images.
   - In single-page mode, preload adjacent images (next page and previous page).
   - In continuous mode, assemble pages via `DocumentFragment` before appending.
7. Optimize chat message DOM appending in chat.js to eliminate layout thrashing:
   - Provide incremental message append function and use `requestAnimationFrame` for scrolling.
8. Fix standalone reader export (`generatePortableReaderHtml`):
   - Escape JSON (`.replace(/</g, '\\u003c')`) so embedded script tags cannot break the document.
   - Wire up click listener for `#btn-generate-standalone-reader` in `setupReaderControls()`.
   - In the standalone reader template, ensure chapter click preserves the active search filter, and spacebar prevents page scroll.
9. Verify your changes:
   - Run syntax checks: `node -c app.js` and `node -c chat.js`.
   - Run verification scripts testing that `setupEventListeners` and `updateBookmarkCountBadge` are no longer called, and that all functions exist.
   - Document verification commands and outputs in your report.

Write your handoff report to C:\Users\User\Desktop\Get Real\.agents\worker_m4_1\handoff.md and update progress.md. When complete, notify parent via send_message.
