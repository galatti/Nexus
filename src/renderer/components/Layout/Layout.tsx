import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Dashboard } from '../Dashboard/Dashboard';
import { PermissionModal } from '../Permissions/PermissionModal';

// Lazy load heavy components
const ChatWindow = lazy(() => 
  import('../Chat/ChatWindow').then(module => ({ default: module.ChatWindow }))
);

const Settings = lazy(() => 
  import('../Settings/Settings').then(module => ({ default: module.Settings }))
);

type ActiveView = 'dashboard' | 'chat';

// Loading component for Suspense
const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400">{message}</p>
    </div>
  </div>
);

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('chat');
  const [settingsTab, setSettingsTab] = useState<string>('general');
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);

  // Listen for custom events to open settings
  useEffect(() => {
    const handleOpenSettings = (event: any) => {
      if (event.detail?.tab) {
        setSettingsTab(event.detail.tab);
      }
      setSettingsOpen(true);
    };

    window.addEventListener('openSettings', handleOpenSettings);
    return () => window.removeEventListener('openSettings', handleOpenSettings);
  }, []);

  // Check for pending permission approvals
  useEffect(() => {
    const checkPendingApprovals = async () => {
      try {
        const result = await (window as any).electronAPI.getPendingApprovals();
        if (result.success && result.pending && result.pending.length > 0) {
          setPermissionModalOpen(true);
        }
      } catch (error) {
        console.error('Failed to check pending approvals:', error);
      }
    };

    // Check immediately and then every 2 seconds
    checkPendingApprovals();
    const interval = setInterval(checkPendingApprovals, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleSettingsClose = () => {
    setSettingsOpen(false);
    setSettingsTab('general'); // Reset to default tab
  };

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} />
      
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header 
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)} 
          onSettingsOpen={() => setSettingsOpen(true)}
          activeView={activeView}
          onViewChange={setActiveView}
        />
        
        {/* Main content */}
        <main className="flex-1 overflow-hidden">
          {activeView === 'dashboard' ? (
            <Dashboard />
          ) : (
            <Suspense fallback={<LoadingSpinner message="Loading Chat..." />}>
              <ChatWindow isActive={activeView === 'chat'} />
            </Suspense>
          )}
        </main>
      </div>

      {/* Settings Modal - Lazy loaded only when opened */}
      {settingsOpen && (
        <Suspense fallback={<LoadingSpinner message="Loading Settings..." />}>
          <Settings 
            isOpen={settingsOpen} 
            onClose={handleSettingsClose}
            initialTab={settingsTab}
          />
        </Suspense>
      )}

      {/* Permission Modal */}
      <PermissionModal
        isOpen={permissionModalOpen}
        onClose={() => setPermissionModalOpen(false)}
      />
    </div>
  );
}; 