import { 
  ChatSession, 
  ChatMessage, 
  SessionStorage, 
  AppStorage, 
  UserPreferences, 
  SessionIndex,
  SessionFilters,
  SessionMetadata,
  SessionContext
} from '../../shared/types';

/**
 * SessionManager - Core class for managing chat sessions in Phase 1.1
 * 
 * Handles:
 * - Session CRUD operations
 * - localStorage persistence with migration from single chat
 * - Session indexing and search
 * - Basic session organization
 */
export class SessionManager {
  private static instance: SessionManager;
  private storage: AppStorage;
  private readonly STORAGE_KEY = 'nexus-app-storage';
  private readonly LEGACY_CHAT_KEY = 'nexus-chat-history';
  private readonly MAX_STORED_SESSIONS = 500;

  private constructor() {
    this.storage = this.loadStorageFromLocalStorage();
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  // =================== CORE CRUD OPERATIONS ===================

  /**
   * Create a new chat session
   */
  public createSession(options: Partial<ChatSession> = {}): ChatSession {
    const now = new Date();
    const sessionId = this.generateSessionId();
    
    const newSession: ChatSession = {
      id: sessionId,
      title: options.title || 'New Chat',
      created: now,
      lastActive: now,
      messageCount: 0,
      tokenCount: 0,
      model: options.model,
      provider: options.provider,
      category: options.category || 'general',
      tags: options.tags || [],
      isPinned: options.isPinned || false,
      isArchived: options.isArchived || false,
      projectId: options.projectId,
      metadata: {
        topics: [],
        hasAttachments: false,
        hasToolCalls: false,
        ...options.metadata
      }
    };

    // Create session storage
    const sessionStorage: SessionStorage = {
      session: newSession,
      messages: [],
      context: {
        modelHistory: [],
        toolsUsed: [],
        attachments: [],
        branchPoints: []
      }
    };

    // Add to storage
    this.storage.sessions[sessionId] = sessionStorage;
    
    // Update indices
    this.updateSessionIndex(newSession);
    
    // Set as current session
    this.storage.currentSessionId = sessionId;
    
    // Persist to localStorage
    this.saveStorageToLocalStorage();
    
    console.log('SessionManager: Created new session:', sessionId);
    return newSession;
  }

  /**
   * Get a session by ID
   */
  public getSession(sessionId: string): ChatSession | null {
    const sessionStorage = this.storage.sessions[sessionId];
    return sessionStorage?.session || null;
  }

  /**
   * Get all sessions (optionally filtered)
   */
  public getSessions(filters?: SessionFilters): ChatSession[] {
    const sessions = Object.values(this.storage.sessions)
      .map(storage => storage.session)
      .filter(session => !session.isArchived); // Hide archived by default

    if (!filters) {
      return this.sortSessionsByLastActive(sessions);
    }

    return this.filterSessions(sessions, filters);
  }

  /**
   * Update an existing session
   */
  public updateSession(sessionId: string, updates: Partial<ChatSession>): boolean {
    const sessionStorage = this.storage.sessions[sessionId];
    if (!sessionStorage) {
      console.warn('SessionManager: Session not found for update:', sessionId);
      return false;
    }

    // Update session properties
    Object.assign(sessionStorage.session, updates);
    sessionStorage.session.lastActive = new Date();

    // Update indices
    this.updateSessionIndex(sessionStorage.session);
    
    // Persist to localStorage
    this.saveStorageToLocalStorage();
    
    console.log('SessionManager: Updated session:', sessionId);
    return true;
  }

  /**
   * Delete a session
   */
  public deleteSession(sessionId: string): boolean {
    if (!this.storage.sessions[sessionId]) {
      console.warn('SessionManager: Session not found for deletion:', sessionId);
      return false;
    }

    // Remove from storage
    delete this.storage.sessions[sessionId];
    
    // Remove from indices
    this.removeFromSessionIndex(sessionId);
    
    // If this was the current session, clear it
    if (this.storage.currentSessionId === sessionId) {
      this.storage.currentSessionId = undefined;
    }
    
    // Persist to localStorage
    this.saveStorageToLocalStorage();
    
    console.log('SessionManager: Deleted session:', sessionId);
    return true;
  }

  // =================== SESSION MESSAGES ===================

  /**
   * Get messages for a session
   */
  public getSessionMessages(sessionId: string): ChatMessage[] {
    const sessionStorage = this.storage.sessions[sessionId];
    return sessionStorage?.messages || [];
  }

  /**
   * Add a message to a session
   */
  public addMessage(sessionId: string, message: ChatMessage): boolean {
    const sessionStorage = this.storage.sessions[sessionId];
    if (!sessionStorage) {
      console.warn('SessionManager: Session not found for message:', sessionId);
      return false;
    }

    // Add message
    sessionStorage.messages.push(message);
    
    // Update session metadata
    const session = sessionStorage.session;
    session.messageCount = sessionStorage.messages.length;
    session.lastActive = new Date();
    
    // Update metadata
    this.updateSessionMetadata(sessionStorage);
    
    // Update indices
    this.updateSessionIndex(session);
    
    // Persist to localStorage
    this.saveStorageToLocalStorage();
    
    return true;
  }

  /**
   * Set all messages for a session (replaces existing)
   */
  public setSessionMessages(sessionId: string, messages: ChatMessage[]): boolean {
    const sessionStorage = this.storage.sessions[sessionId];
    if (!sessionStorage) {
      console.warn('SessionManager: Session not found for setting messages:', sessionId);
      return false;
    }

    // Set messages
    sessionStorage.messages = messages;
    
    // Update session metadata
    const session = sessionStorage.session;
    session.messageCount = messages.length;
    session.lastActive = new Date();
    
    // Update metadata
    this.updateSessionMetadata(sessionStorage);
    
    // Update indices
    this.updateSessionIndex(session);
    
    // Persist to localStorage
    this.saveStorageToLocalStorage();
    
    return true;
  }

  // =================== SESSION MANAGEMENT ===================

  /**
   * Get the current active session ID
   */
  public getCurrentSessionId(): string | undefined {
    return this.storage.currentSessionId;
  }

  /**
   * Set the current active session
   */
  public setCurrentSession(sessionId: string): boolean {
    if (!this.storage.sessions[sessionId]) {
      console.warn('SessionManager: Cannot set non-existent session as current:', sessionId);
      return false;
    }

    this.storage.currentSessionId = sessionId;
    
    // Update last active time
    this.storage.sessions[sessionId].session.lastActive = new Date();
    
    // Persist to localStorage
    this.saveStorageToLocalStorage();
    
    return true;
  }

  /**
   * Archive a session
   */
  public archiveSession(sessionId: string): boolean {
    return this.updateSession(sessionId, { isArchived: true });
  }

  /**
   * Pin/unpin a session
   */
  public pinSession(sessionId: string, pinned: boolean = true): boolean {
    return this.updateSession(sessionId, { isPinned: pinned });
  }

  // =================== STORAGE & PERSISTENCE ===================

  /**
   * Load storage from localStorage with legacy migration
   */
  private loadStorageFromLocalStorage(): AppStorage {
    try {
      // Try to load new storage format
      const storedData = localStorage.getItem(this.STORAGE_KEY);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        
        // Deserialize dates
        Object.values(parsed.sessions || {}).forEach((sessionStorage: any) => {
          sessionStorage.session.created = new Date(sessionStorage.session.created);
          sessionStorage.session.lastActive = new Date(sessionStorage.session.lastActive);
          sessionStorage.messages.forEach((msg: any) => {
            msg.timestamp = new Date(msg.timestamp);
          });
        });
        
        console.log('SessionManager: Loaded existing storage with', Object.keys(parsed.sessions || {}).length, 'sessions');
        return parsed;
      }

      // Migration from legacy single chat format
      console.log('SessionManager: No app storage found, checking for legacy chat history...');
      return this.migrateLegacyChatHistory();
      
    } catch (error) {
      console.error('SessionManager: Failed to load storage:', error);
      return this.createDefaultStorage();
    }
  }

  /**
   * Migrate from legacy single chat format
   */
  private migrateLegacyChatHistory(): AppStorage {
    try {
      const legacyData = localStorage.getItem(this.LEGACY_CHAT_KEY);
      if (legacyData) {
        console.log('SessionManager: Found legacy chat history, migrating...');
        
        const messages: ChatMessage[] = JSON.parse(legacyData).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));

        if (messages.length > 0) {
          // Create a new session with the legacy messages
          const storage = this.createDefaultStorage();
          const sessionId = this.generateSessionId();
          
          const session: ChatSession = {
            id: sessionId,
            title: this.generateSessionTitle(messages),
            created: messages[0].timestamp,
            lastActive: messages[messages.length - 1].timestamp,
            messageCount: messages.length,
            tokenCount: messages.reduce((sum, msg) => sum + (msg.tokens || 0), 0),
            category: 'migrated',
            tags: ['migrated-from-legacy'],
            isPinned: false,
            isArchived: false,
            metadata: {
              topics: [],
              hasAttachments: false,
              hasToolCalls: messages.some(msg => msg.tools && msg.tools.length > 0)
            }
          };

          const sessionStorage: SessionStorage = {
            session,
            messages,
            context: {
              modelHistory: [],
              toolsUsed: [],
              attachments: [],
              branchPoints: []
            }
          };

          storage.sessions[sessionId] = sessionStorage;
          storage.currentSessionId = sessionId;
          
          // Update metadata and indices
          this.updateSessionMetadata(sessionStorage);
          this.updateSessionIndex(session);
          
          console.log('SessionManager: Successfully migrated legacy chat to session:', sessionId);
          
          // Remove legacy data
          localStorage.removeItem(this.LEGACY_CHAT_KEY);
          
          return storage;
        }
      }
    } catch (error) {
      console.error('SessionManager: Failed to migrate legacy chat history:', error);
    }

    console.log('SessionManager: No legacy data found, creating default storage');
    return this.createDefaultStorage();
  }

  /**
   * Create default empty storage
   */
  private createDefaultStorage(): AppStorage {
    return {
      sessions: {},
      projects: {},
      userPreferences: {
        sidebarState: 'condensed',
        sessionOrganization: 'chronological',
        autoArchive: false,
        searchHistory: [],
        maxStoredSessions: this.MAX_STORED_SESSIONS
      },
      sessionIndex: {
        byDate: [],
        byProject: {},
        byCategory: {},
        searchable: {
          sessions: {},
          invertedIndex: {}
        }
      }
    };
  }

  /**
   * Save storage to localStorage
   */
  private saveStorageToLocalStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.storage));
    } catch (error) {
      console.error('SessionManager: Failed to save storage:', error);
    }
  }

  // =================== UTILITY METHODS ===================

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a title from messages
   */
  private generateSessionTitle(messages: ChatMessage[]): string {
    const userMessages = messages.filter(msg => msg.role === 'user');
    if (userMessages.length === 0) return 'New Chat';
    
    const firstMessage = userMessages[0].content;
    const maxLength = 50;
    
    if (firstMessage.length <= maxLength) {
      return firstMessage;
    }
    
    return firstMessage.substring(0, maxLength - 3) + '...';
  }

  /**
   * Update session metadata based on messages
   */
  private updateSessionMetadata(sessionStorage: SessionStorage): void {
    const { session, messages } = sessionStorage;
    const userMessages = messages.filter(msg => msg.role === 'user');
    const hasTools = messages.some(msg => msg.tools && msg.tools.length > 0);
    
    session.metadata = {
      ...session.metadata,
      firstMessage: userMessages[0]?.content?.substring(0, 100),
      lastMessage: messages[messages.length - 1]?.content?.substring(0, 100),
      hasToolCalls: hasTools,
      hasAttachments: false // Will be updated in future phases
    };

    // Auto-generate title if it's still default
    if (session.title === 'New Chat' && userMessages.length > 0) {
      session.title = this.generateSessionTitle(messages);
    }
  }

  /**
   * Update session indices
   */
  private updateSessionIndex(session: ChatSession): void {
    const { sessionIndex } = this.storage;
    
    // Update by date
    const sessionIds = sessionIndex.byDate.filter(id => id !== session.id);
    sessionIds.push(session.id);
    sessionIndex.byDate = sessionIds.sort((a, b) => {
      const sessionA = this.storage.sessions[a]?.session;
      const sessionB = this.storage.sessions[b]?.session;
      if (!sessionA || !sessionB) return 0;
      return sessionB.lastActive.getTime() - sessionA.lastActive.getTime();
    });

    // Update by category
    if (session.category) {
      if (!sessionIndex.byCategory[session.category]) {
        sessionIndex.byCategory[session.category] = [];
      }
      if (!sessionIndex.byCategory[session.category].includes(session.id)) {
        sessionIndex.byCategory[session.category].push(session.id);
      }
    }
  }

  /**
   * Remove session from indices
   */
  private removeFromSessionIndex(sessionId: string): void {
    const { sessionIndex } = this.storage;
    
    // Remove from date index
    sessionIndex.byDate = sessionIndex.byDate.filter(id => id !== sessionId);
    
    // Remove from category indices
    Object.keys(sessionIndex.byCategory).forEach(category => {
      sessionIndex.byCategory[category] = sessionIndex.byCategory[category].filter(id => id !== sessionId);
    });
    
    // Remove from project indices
    Object.keys(sessionIndex.byProject).forEach(projectId => {
      sessionIndex.byProject[projectId] = sessionIndex.byProject[projectId].filter(id => id !== sessionId);
    });
  }

  /**
   * Filter sessions based on criteria
   */
  private filterSessions(sessions: ChatSession[], filters: SessionFilters): ChatSession[] {
    let filtered = sessions;

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(session => 
        session.title.toLowerCase().includes(query) ||
        session.metadata.firstMessage?.toLowerCase().includes(query) ||
        session.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (filters.categories && filters.categories.length > 0) {
      filtered = filtered.filter(session => 
        session.category && filters.categories!.includes(session.category)
      );
    }

    if (filters.models && filters.models.length > 0) {
      filtered = filtered.filter(session => 
        session.model && filters.models!.includes(session.model)
      );
    }

    if (filters.minMessages) {
      filtered = filtered.filter(session => session.messageCount >= filters.minMessages!);
    }

    if (filters.dateRange) {
      const [start, end] = filters.dateRange;
      filtered = filtered.filter(session => 
        session.lastActive >= start && session.lastActive <= end
      );
    }

    return this.sortSessionsByLastActive(filtered);
  }

  /**
   * Sort sessions by last active (most recent first)
   */
  private sortSessionsByLastActive(sessions: ChatSession[]): ChatSession[] {
    return sessions.sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());
  }
} 