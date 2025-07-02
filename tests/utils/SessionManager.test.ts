import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager } from '../../src/renderer/utils/SessionManager';

// Mock browser localStorage for the test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

/** Helper to create multiple sessions quickly */
const createMany = (mgr: SessionManager, count: number) => {
  for (let i = 0; i < count; i++) {
    mgr.createSession({ title: `chat ${i}` });
  }
};

describe('SessionManager basics', () => {
  let manager: SessionManager;

  beforeEach(() => {
    localStorage.clear();
    // SessionManager is a singleton; reset its internal state by accessing private field via any
    manager = SessionManager.getInstance();
    // @ts-ignore accessing private field for test reset
    manager.clearAllSessions();
  });

  it('creates a new session and sets it as current', () => {
    const session = manager.createSession({ title: 'Test Chat' });
    expect(session.title).toBe('Test Chat');
    expect(manager.getCurrentSessionId()).toBe(session.id);
    expect(manager.getSessions().length).toBe(1);
  });

  it('renames an existing session', () => {
    const session = manager.createSession();
    const ok = manager.renameSession(session.id, 'Renamed');
    expect(ok).toBe(true);
    const stored = manager.getSession(session.id);
    expect(stored?.title).toBe('Renamed');
  });

  it('prunes old sessions beyond max cap', () => {
    createMany(manager, 10);
    manager.pruneOldSessions(5);
    expect(manager.getSessions().length).toBe(5);
  });

  it('clears all sessions', () => {
    createMany(manager, 3);
    manager.clearAllSessions();
    expect(manager.getSessions().length).toBe(0);
    expect(manager.getCurrentSessionId()).toBeUndefined();
  });
}); 