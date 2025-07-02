import React, { useState } from 'react';
import { useSession } from '../../context/SessionContext';

interface SessionSidebarProps {
  isOpen: boolean;
}

export const SessionSidebar: React.FC<SessionSidebarProps> = ({ isOpen }) => {
  const {
    sessions,
    currentSessionId,
    createSession,
    switchSession,
    deleteSession,
    pinSession,
    updateSession
  } = useSession();

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  if (!isOpen) return null;

  const handleNewChat = () => {
    createSession();
  };

  const startRename = (id: string, currentTitle: string) => {
    setRenameId(id);
    setRenameValue(currentTitle);
  };

  const commitRename = (id: string) => {
    if (renameValue.trim()) {
      updateSession(id, { title: renameValue.trim() });
    }
    setRenameId(null);
  };

  const sorted = [...sessions].sort((a, b) => {
    // Pinned first, then lastActive desc
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.lastActive.getTime() - a.lastActive.getTime();
  });

  return (
    <div className="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col select-none">
      {/* New Chat */}
      <button
        onClick={handleNewChat}
        className="m-3 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center justify-center"
      >
        ＋ New Chat
      </button>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map(session => (
          <div
            key={session.id}
            className={`group px-3 py-2 cursor-pointer flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 ${
              currentSessionId === session.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
            onClick={() => switchSession(session.id)}
          >
            {/* Title or rename input */}
            {renameId === session.id ? (
              <input
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={() => commitRename(session.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitRename(session.id);
                  if (e.key === 'Escape') setRenameId(null);
                }}
                autoFocus
                className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-white"
              />
            ) : (
              <span className="truncate text-sm text-gray-900 dark:text-white pr-2">
                {session.title}
              </span>
            )}

            {/* Action buttons (visible on hover) */}
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                title={session.isPinned ? 'Unpin' : 'Pin'}
                onClick={e => {
                  e.stopPropagation();
                  pinSession(session.id, !session.isPinned);
                }}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
              >
                {session.isPinned ? '📌' : '📍'}
              </button>
              <button
                title="Rename"
                onClick={e => {
                  e.stopPropagation();
                  startRename(session.id, session.title);
                }}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
              >
                ✎
              </button>
              <button
                title="Delete"
                onClick={e => {
                  e.stopPropagation();
                  if (confirm('Delete this chat?')) deleteSession(session.id);
                }}
                className="text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 