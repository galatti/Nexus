# Simplified Multi-Chat Sessions Plan

> This document replaces the previous, overly-complex roadmap.  It captures the **minimum viable** feature set required to let users create, resume and manage multiple chat sessions with as little new code and UI as possible.

---

## ✨ Goals

1. Allow any number of concurrent chat sessions ("conversations").
2. Persist all sessions locally so they survive app restarts.
3. Provide a clean UI to create, switch, rename and delete sessions.
4. Keep the codebase lean and maintainable; postpone advanced features (projects, search, ML tagging, etc.).

---

## 🏗️ Core Architecture

### 1. Data Structures

```ts
interface ChatSession {
  id: string;
  title: string;          // "New Chat" until first user message
  created: Date;
  lastActive: Date;       // updated on every user / assistant message
  messageCount: number;
  tokenCount: number;
  isPinned: boolean;      // optional pin to top
}

interface SessionStorage {
  session: ChatSession;
  messages: ChatMessage[];
}

interface AppStorage {
  sessions: Record<string, SessionStorage>;
  userPreferences: {
    sidebarState: 'collapsed' | 'expanded';
  };
  currentSessionId?: string;
}
```

The types above **already exist** in `src/shared/types.ts` and are used by `SessionManager`.

### 2. SessionManager (already implemented)

Responsibilities:
* CRUD for sessions & messages.
* Local-storage persistence (`localStorage` key: `nexus-app-storage`).
* Cap total stored sessions (default **100**).  Oldest are pruned automatically.
* Helper utilities: `renameSession`, `pinSession`, `clearAllSessions`.

No extra back-end / main-process work is required — all logic lives in the renderer.

---

## 🎨 UI/UX

### 1. Sidebar

```
┌───────────────────────────┐
│   ＋  New Chat            │
├───────────────────────────┤
│ • Chat about APIs   2 m │
│ • Docs feedback     1 h │
│ • …                       │
└───────────────────────────┘
```

* Width ≈ 220 px, collapsible to icons only.
* Each item shows the session title and `lastActive` time.
* Hover → 3-dot menu: **Rename**, **Delete**, **Pin**.
* Pinned sessions stay on top.

### 2. Main Pane

* Re-uses existing `ChatWindow` (already session-aware through `useSession`).

### 3. Settings → General

* Button: **Clear chat history** (calls `SessionManager.clearAllSessions()` and reloads the renderer).

---

## 🔧 Implementation Checklist

### Backend / Logic (renderer)
- [ ] `SessionManager.pruneOldSessions(max = 100)`
- [ ] `SessionManager.renameSession(id, title)` wrapper
- [ ] `SessionManager.clearAllSessions()`

### Front-end Components
- [ ] `Sidebar.tsx`
  * Render session list from `useSession().sessions`.
  * Handle click → `switchSession`.
  * 3-dot menu with rename / delete / pin.
- [ ] "＋ New Chat" button → `createSession()`.
- [ ] Auto-rename in `ChatWindow`: after first user message, if title is still "New Chat" rename to first 40 characters.
- [ ] Collapsible sidebar toggle (icon top-left).
- [ ] Settings → **Clear chat history** button.

---

## 📦 Deferred Features (for future iterations)

* Projects & workspaces
* Categories / tags / search
* Multi-tab bar
* Conversation branching / threading
* Cloud sync & collaboration

These can be layered onto the foundation above without architectural changes. 