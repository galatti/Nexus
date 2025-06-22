import React from 'react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  if (!isOpen) return null;

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white">MCP Servers</h2>
      </div>
      <div className="flex-1 p-4">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          No servers configured yet
        </div>
      </div>
    </aside>
  );
}; 