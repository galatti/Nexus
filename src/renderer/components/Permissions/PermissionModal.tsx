import React, { useState, useEffect, useRef } from 'react';

interface PendingApproval {
  id: string;
  serverId: string;
  serverName: string;
  toolName: string;
  toolDescription: string;
  args: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high';
  riskReasons: string[];
  requestedAt: Date;
}

interface ApprovalResult {
  approved: boolean;
  scope?: 'once' | 'session' | 'always';
  reason?: string;
}

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PermissionModal: React.FC<PermissionModalProps> = ({ isOpen, onClose }) => {
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const modalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadPendingApprovals();
      
      // Set up polling for new approvals
      const interval = setInterval(loadPendingApprovals, 1000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Auto-scroll to bottom when modal opens or pending approvals change
  useEffect(() => {
    if (isOpen && pendingApprovals.length > 0 && modalContentRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        modalContentRef.current?.scrollTo({
          top: modalContentRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [isOpen, pendingApprovals]);

  const loadPendingApprovals = async () => {
    try {
      const result = await (window as any).electronAPI.getPendingApprovals();
      if (result.success) {
        setPendingApprovals(result.pending || []);
        
        // If no pending approvals, close the modal
        if (!result.pending || result.pending.length === 0) {
          onClose();
        }
      }
    } catch (error) {
      console.error('Failed to load pending approvals:', error);
    }
  };

  const handleApprovalResponse = async (approvalId: string, result: ApprovalResult) => {
    setIsLoading(true);
    
    try {
      await (window as any).electronAPI.respondToApproval(approvalId, result);
      
      // Remove the approval from the list
      setPendingApprovals(prev => prev.filter(approval => approval.id !== approvalId));
      
      // Close modal if no more approvals
      if (pendingApprovals.length <= 1) {
        onClose();
      }
    } catch (error) {
      console.error('Failed to respond to approval:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900';
      case 'high': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
    }
  };

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return '🟢';
      case 'medium': return '🟡';
      case 'high': return '🔴';
      default: return '⚪';
    }
  };

  const formatArgs = (args: Record<string, unknown>): string => {
    const formatted = Object.entries(args)
      .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
      .join(', ');
    return formatted.length > 100 ? formatted.substring(0, 100) + '...' : formatted;
  };

  if (!isOpen || pendingApprovals.length === 0) {
    return null;
  }

  const currentApproval = pendingApprovals[0];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div 
        ref={modalContentRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">🔐</div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Permission Required
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {pendingApprovals.length} pending request{pendingApprovals.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Server Info */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Server Request
            </h3>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-2">
                <span className="text-xl">🔧</span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {currentApproval.serverName}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Server ID: {currentApproval.serverId}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tool Info */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Tool Execution Request
            </h3>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {currentApproval.toolName}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(currentApproval.riskLevel)}`}>
                    {getRiskIcon(currentApproval.riskLevel)} {currentApproval.riskLevel.toUpperCase()} RISK
                  </span>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {currentApproval.toolDescription}
              </p>

              {Object.keys(currentApproval.args).length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Arguments:
                  </p>
                  <code className="text-xs bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded text-gray-800 dark:text-gray-200 block">
                    {formatArgs(currentApproval.args)}
                  </code>
                </div>
              )}
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Risk Assessment
            </h3>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="space-y-2">
                {currentApproval.riskReasons.map((reason, index) => (
                  <div key={index} className="flex items-center space-x-2 text-sm">
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600 dark:text-gray-400">{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col space-y-4">
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Choose an action:
            </div>
            
            {/* Allow Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => handleApprovalResponse(currentApproval.id, { approved: true, scope: 'once' })}
                disabled={isLoading}
                className="px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                ✅ Allow Once
                <div className="text-xs opacity-75 mt-1">This request only</div>
              </button>
              
              <button
                onClick={() => handleApprovalResponse(currentApproval.id, { approved: true, scope: 'session' })}
                disabled={isLoading}
                className="px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                🔄 Allow Session
                <div className="text-xs opacity-75 mt-1">Until app restart</div>
              </button>
              
              <button
                onClick={() => handleApprovalResponse(currentApproval.id, { approved: true, scope: 'always' })}
                disabled={isLoading}
                className="px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                ♾️ Always Allow
                <div className="text-xs opacity-75 mt-1">Remember forever</div>
              </button>
            </div>

            {/* Deny Button */}
            <button
              onClick={() => handleApprovalResponse(currentApproval.id, { approved: false })}
              disabled={isLoading}
              className="w-full px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              ❌ Deny Request
            </button>
          </div>

          {/* Loading Indicator */}
          {isLoading && (
            <div className="mt-4 flex items-center justify-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>Processing...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 