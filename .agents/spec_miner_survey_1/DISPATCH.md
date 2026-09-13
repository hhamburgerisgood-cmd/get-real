## 2026-09-13T07:46:48Z

You are spec_miner_survey_1.
Your Working Directory is: C:\Users\User\Desktop\Get Real\.agents\spec_miner_survey_1
Workspace Root: C:\Users\User\Desktop\Get Real

MANDATORY: Read C:\Users\User\Desktop\Get Real\ORIGINAL_REQUEST.md first.
Your role: Security & Firebase Integration Spec Miner.
Objective:
Investigate C:\Users\User\Desktop\Get Real to map out:
1. R5: Security & Hardening:
   - Threat model and untrusted input points (chat messages, forum threads, replies, account bios).
   - Current escaping/rendering in chat.js, forum.js, account.js (vulnerabilities to Stored XSS).
   - Rate-limiting implementation plan (minimum 1.5s debounce/cooldown for chat send and thread post).
   - Password fields masking and secure auth hashing (e.g. SHA-256 via Web Crypto API).
2. R6: Firebase Real-Time Integration & Offline Fallback:
   - Architecture and design for irebase-config.js using official Firebase v10 CDN SDK (app, auth, firestore via modular or compat CDN).
   - User sign-up and login integration with Firebase Auth (Username + Password with optional email for recovery).
   - Real-time onSnapshot listeners for Chat rooms & messages.
   - Real-time Firestore sync for Discussion Board (orum_threads collection + eplies subcollection).
   - Offline/unconfigured fallback banner: graceful fallback to localStorage when keys are missing or invalid, with zero crashes.
Scope boundary: You are READ-ONLY. Do NOT modify source code files.
Write a detailed spec and integration plan to C:\Users\User\Desktop\Get Real\.agents\spec_miner_survey_1\handoff.md with exact data schemas, listener lifecycles, and code contracts. Update progress.md in your working directory.
When finished, send a message to parent reporting completion.
