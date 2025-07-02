import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ChatSession, ChatMessage, SessionFilters } from '../../shared/types';
import { SessionManager } from '../utils/SessionManager';

interface SessionContextValue {
  // Current state
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  currentSessionId: string | null;
  isLoading: boolean;
  
  // Session operations
  createSession: (options?: Partial<ChatSession>) => ChatSession;
  switchSession: (sessionId: string) => boolean;
  updateSession: (sessionId: string, updates: Partial<ChatSession>) => boolean;
  deleteSession: (sessionId: string) => boolean;
  
  // Session management
  pinSession: (sessionId: string, pinned?: boolean) => boolean;
  archiveSession: (sessionId: string) => boolean;
  
  // Message operations
  getSessionMessages: (sessionId: string) => ChatMessage[];
  addMessage: (sessionId: string, message: ChatMessage) => boolean;
  setSessionMessages: (sessionId: string, messages: ChatMessage[]) => boolean;
  
  // Organization
  getSessions: (filters?: SessionFilters) => ChatSession[];
  
  // Utilities
  refreshSessions: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export const useSession = (): SessionContextValue => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

interface SessionProviderProps {
  children: React.ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const sessionManager = SessionManager.getInstance();

  // Load initial data
  useEffect(() => {
    const loadInitialData = () => {
      try {
        console.log('SessionContext: Loading initial session data...');
        
        // Load all sessions
        const allSessions = sessionManager.getSessions();
        setSessions(allSessions);
        
        // Load current session
        const activeSessionId = sessionManager.getCurrentSessionId();
        if (activeSessionId) {
          const activeSession = sessionManager.getSession(activeSessionId);
          setCurrentSession(activeSession);
          setCurrentSessionId(activeSessionId);
        } else if (allSessions.length > 0) {
          // If no current session but sessions exist, use the most recent one
          const mostRecent = allSessions[0];
          sessionManager.setCurrentSession(mostRecent.id);
          setCurrentSession(mostRecent);
          setCurrentSessionId(mostRecent.id);
        }
        
        console.log('SessionContext: Loaded', allSessions.length, 'sessions, current:', activeSessionId);
      } catch (error) {
        console.error('SessionContext: Failed to load initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [sessionManager]);

  // Refresh sessions from storage
  const refreshSessions = useCallback(() => {
    const allSessions = sessionManager.getSessions();
    setSessions(allSessions);
    
    // Update current session if it exists
    if (currentSessionId) {
      const updatedCurrentSession = sessionManager.getSession(currentSessionId);
      setCurrentSession(updatedCurrentSession);
    }
  }, [sessionManager, currentSessionId]);

  // Create a new session
  const createSession = useCallback((options: Partial<ChatSession> = {}): ChatSession => {
    console.log('SessionContext: Creating new session with options:', options);
    
    const newSession = sessionManager.createSession(options);
    
    // Update local state
    const allSessions = sessionManager.getSessions();
    setSessions(allSessions);
    setCurrentSession(newSession);
    setCurrentSessionId(newSession.id);
    
    console.log('SessionContext: Created and switched to new session:', newSession.id);
    return newSession;
  }, [sessionManager]);

  // Switch to an existing session
  const switchSession = useCallback((sessionId: string): boolean => {
    console.log('SessionContext: Switching to session:', sessionId);
    
    const success = sessionManager.setCurrentSession(sessionId);
    if (success) {
      const session = sessionManager.getSession(sessionId);
      setCurrentSession(session);
      setCurrentSessionId(sessionId);
      
      // Refresh sessions to update lastActive times
      refreshSessions();
      
      console.log('SessionContext: Successfully switched to session:', sessionId);
      return true;
    }
    
    console.warn('SessionContext: Failed to switch to session:', sessionId);
    return false;
  }, [sessionManager, refreshSessions]);

  // Update a session
  const updateSession = useCallback((sessionId: string, updates: Partial<ChatSession>): boolean => {
    console.log('SessionContext: Updating session:', sessionId, updates);
    
    const success = sessionManager.updateSession(sessionId, updates);
    if (success) {
      // Update local state
      refreshSessions();
      
      // If updating current session, refresh current session state
      if (sessionId === currentSessionId) {
        const updatedSession = sessionManager.getSession(sessionId);
        setCurrentSession(updatedSession);
      }
      
      console.log('SessionContext: Successfully updated session:', sessionId);
      return true;
    }
    
    console.warn('SessionContext: Failed to update session:', sessionId);
    return false;
  }, [sessionManager, refreshSessions, currentSessionId]);

  // Delete a session
  const deleteSession = useCallback((sessionId: string): boolean => {
    console.log('SessionContext: Deleting session:', sessionId);
    
    const success = sessionManager.deleteSession(sessionId);
    if (success) {
      // Update local state
      const allSessions = sessionManager.getSessions();
      setSessions(allSessions);
      
      // If deleting current session, switch to another one or clear
      if (sessionId === currentSessionId) {
        if (allSessions.length > 0) {
          // Switch to the most recent session
          const mostRecent = allSessions[0];
          sessionManager.setCurrentSession(mostRecent.id);
          setCurrentSession(mostRecent);
          setCurrentSessionId(mostRecent.id);
        } else {
          // No sessions left
          setCurrentSession(null);
          setCurrentSessionId(null);
        }
      }
      
      console.log('SessionContext: Successfully deleted session:', sessionId);
      return true;
    }
    
    console.warn('SessionContext: Failed to delete session:', sessionId);
    return false;
  }, [sessionManager, currentSessionId]);

  // Pin/unpin a session
  const pinSession = useCallback((sessionId: string, pinned: boolean = true): boolean => {
    console.log('SessionContext: Pinning session:', sessionId, pinned);
    
    const success = sessionManager.pinSession(sessionId, pinned);
    if (success) {
      refreshSessions();
      
      // If updating current session, refresh current session state
      if (sessionId === currentSessionId) {
        const updatedSession = sessionManager.getSession(sessionId);
        setCurrentSession(updatedSession);
      }
      
      return true;
    }
    
    return false;
  }, [sessionManager, refreshSessions, currentSessionId]);

  // Archive a session
  const archiveSession = useCallback((sessionId: string): boolean => {
    console.log('SessionContext: Archiving session:', sessionId);
    
    const success = sessionManager.archiveSession(sessionId);
    if (success) {
      // Update local state (archived sessions are filtered out by default)
      const allSessions = sessionManager.getSessions();
      setSessions(allSessions);
      
      // If archiving current session, switch to another one
      if (sessionId === currentSessionId) {
        if (allSessions.length > 0) {
          const mostRecent = allSessions[0];
          sessionManager.setCurrentSession(mostRecent.id);
          setCurrentSession(mostRecent);
          setCurrentSessionId(mostRecent.id);
        } else {
          setCurrentSession(null);
          setCurrentSessionId(null);
        }
      }
      
      return true;
    }
    
    return false;
  }, [sessionManager, currentSessionId]);

  // Get messages for a session
  const getSessionMessages = useCallback((sessionId: string): ChatMessage[] => {
    return sessionManager.getSessionMessages(sessionId);
  }, [sessionManager]);

  // Add a message to a session
  const addMessage = useCallback((sessionId: string, message: ChatMessage): boolean => {
    const success = sessionManager.addMessage(sessionId, message);
    if (success) {
      // Update local state
      refreshSessions();
      
      // If adding to current session, refresh current session state
      if (sessionId === currentSessionId) {
        const updatedSession = sessionManager.getSession(sessionId);
        setCurrentSession(updatedSession);
      }
    }
    
    return success;
  }, [sessionManager, refreshSessions, currentSessionId]);

  // Set all messages for a session
  const setSessionMessages = useCallback((sessionId: string, messages: ChatMessage[]): boolean => {
    const success = sessionManager.setSessionMessages(sessionId, messages);
    if (success) {
      // Update local state
      refreshSessions();
      
      // If updating current session, refresh current session state
      if (sessionId === currentSessionId) {
        const updatedSession = sessionManager.getSession(sessionId);
        setCurrentSession(updatedSession);
      }
    }
    
    return success;
  }, [sessionManager, refreshSessions, currentSessionId]);

  // Get sessions with optional filtering
  const getSessions = useCallback((filters?: SessionFilters): ChatSession[] => {
    return sessionManager.getSessions(filters);
  }, [sessionManager]);

  const contextValue: SessionContextValue = {
    // Current state
    sessions,
    currentSession,
    currentSessionId,
    isLoading,
    
    // Session operations
    createSession,
    switchSession,
    updateSession,
    deleteSession,
    
    // Session management
    pinSession,
    archiveSession,
    
    // Message operations
    getSessionMessages,
    addMessage,
    setSessionMessages,
    
    // Organization
    getSessions,
    
    // Utilities
    refreshSessions
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}; 