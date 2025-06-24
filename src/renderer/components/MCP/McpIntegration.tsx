import React, { useState, useEffect } from 'react';
import { McpServerTemplateInfo, McpConfigField } from '../../../main/mcp/templates/McpServerTemplate';
import { AppSettings } from '../../../shared/types';

interface McpIntegrationProps {
  settings: AppSettings;
  onSettingsUpdate: () => void;
}

interface TemplateInstallationStatus {
  [templateId: string]: {
    isInstalled: boolean;
    isInstalling: boolean;
    error?: string;
  };
}

export const McpIntegration: React.FC<McpIntegrationProps> = ({ settings, onSettingsUpdate }) => {
  const [templates, setTemplates] = useState<McpServerTemplateInfo[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<McpServerTemplateInfo | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [serverName, setServerName] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [installationStatus, setInstallationStatus] = useState<TemplateInstallationStatus>({});
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    loadTemplates();
    checkInstallationStatus();
  }, []);

  const loadTemplates = async () => {
    try {
      const result = await window.electronAPI.getMcpTemplates() as any;
      if (result.success) {
        setTemplates(result.templates);
      }
    } catch (error) {
      console.error('Failed to load MCP templates:', error);
    }
  };

  const checkInstallationStatus = async () => {
    try {
      const result = await window.electronAPI.checkMcpInstallations() as any;
      if (result.success) {
        setInstallationStatus(result.status);
      }
    } catch (error) {
      console.error('Failed to check installation status:', error);
    }
  };

  const handleTemplateSelect = (template: McpServerTemplateInfo) => {
    setSelectedTemplate(template);
    setServerName(`${template.name} Server`);
    
    // Set default values
    const defaultConfig: Record<string, any> = {};
    template.configFields.forEach(field => {
      if (field.defaultValue !== undefined) {
        defaultConfig[field.key] = field.defaultValue;
      }
    });
    setConfig(defaultConfig);
    setValidationErrors({});
    setIsConfiguring(true);
  };

  const handleConfigChange = (field: McpConfigField, value: any) => {
    const newConfig = { ...config, [field.key]: value };
    setConfig(newConfig);
    
    // Clear validation error for this field
    if (validationErrors[field.key]) {
      const newErrors = { ...validationErrors };
      delete newErrors[field.key];
      setValidationErrors(newErrors);
    }
  };

  const validateConfig = (): boolean => {
    if (!selectedTemplate) return false;
    
    const errors: Record<string, string> = {};
    
    selectedTemplate.configFields.forEach(field => {
      const value = config[field.key];
      
      if (field.required && (value === undefined || value === null || value === '')) {
        errors[field.key] = `${field.label} is required`;
      } else if (value && field.validation && !field.validation.test(String(value))) {
        errors[field.key] = `${field.label} format is invalid`;
      }
    });
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInstall = async (templateId: string) => {
    setInstallationStatus(prev => ({
      ...prev,
      [templateId]: { ...prev[templateId], isInstalling: true, error: undefined }
    }));

    try {
      const result = await window.electronAPI.installMcpTemplate(templateId) as any;
      
      setInstallationStatus(prev => ({
        ...prev,
        [templateId]: {
          isInstalled: result.success,
          isInstalling: false,
          error: result.success ? undefined : result.error
        }
      }));

      // Auto-create server for templates that don't require configuration
      if (result.success) {
        const template = templates.find(t => t.id === templateId);
        if (template && !template.requiresConfig && template.configFields.length === 0) {
          const serverResult = await window.electronAPI.generateServerFromTemplate(
            templateId, 
            {}, 
            `${template.name} Server`
          ) as any;
          
          if (serverResult.success) {
            onSettingsUpdate();
          }
        }
      }
    } catch (error) {
      setInstallationStatus(prev => ({
        ...prev,
        [templateId]: {
          isInstalled: false,
          isInstalling: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }));
    }
  };

  const handleAddServer = async () => {
    if (!selectedTemplate || !validateConfig()) return;

    setIsAdding(true);
    try {
      const result = await window.electronAPI.generateServerFromTemplate(selectedTemplate.id, config, serverName) as any;
      if (result.success) {
        setIsConfiguring(false);
        setSelectedTemplate(null);
        setConfig({});
        setServerName('');
        onSettingsUpdate();
      } else {
        throw new Error(result.error || 'Failed to generate server from template');
      }
    } catch (error) {
      console.error('Failed to add MCP server:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const renderConfigField = (field: McpConfigField) => {
    const value = config[field.key] || '';
    const hasError = !!validationErrors[field.key];

    const fieldClasses = `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      hasError 
        ? 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700' 
        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
    }`;

    switch (field.type) {
      case 'text':
      case 'password':
        return (
          <input
            type={field.type}
            value={value}
            onChange={(e) => handleConfigChange(field, e.target.value)}
            placeholder={field.placeholder}
            className={fieldClasses}
          />
        );
      
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleConfigChange(field, parseInt(e.target.value) || '')}
            placeholder={field.placeholder}
            className={fieldClasses}
          />
        );
      
      case 'boolean':
        return (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleConfigChange(field, e.target.checked)}
              className="mr-2 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Enable {field.label}
            </span>
          </label>
        );
      
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleConfigChange(field, e.target.value)}
            className={fieldClasses}
          >
            <option value="">Select {field.label}</option>
            {field.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      
      case 'path':
        return (
          <div className="flex">
            <input
              type="text"
              value={value}
              onChange={(e) => handleConfigChange(field, e.target.value)}
              placeholder={field.placeholder}
              className={`${fieldClasses} rounded-r-none`}
            />
            <button
              type="button"
              onClick={() => {
                // TODO: Implement file/folder picker
                console.log('File picker not implemented yet');
              }}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              📁
            </button>
          </div>
        );
      
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleConfigChange(field, e.target.value)}
            placeholder={field.placeholder}
            className={fieldClasses}
          />
        );
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'filesystem': return '📁';
      case 'web': return '🌐';
      case 'weather': return '🌤️';
      case 'productivity': return '📊';
      case 'development': return '⚡';
      default: return '🔧';
    }
  };

  // Configuration Modal
  if (isConfiguring && selectedTemplate) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{selectedTemplate.icon}</span>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Configure {selectedTemplate.name}
                </h3>
              </div>
              <button
                onClick={() => setIsConfiguring(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
              >
                ×
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {selectedTemplate.description}
              </p>
              {selectedTemplate.documentation && (
                <a
                  href={selectedTemplate.documentation}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
                >
                  📖 View Documentation
                </a>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Server Name
              </label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="Enter a name for this server"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
              />
            </div>

            {selectedTemplate.configFields.map(field => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {renderConfigField(field)}
                {field.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {field.description}
                  </p>
                )}
                {validationErrors[field.key] && (
                  <p className="text-xs text-red-500 mt-1">
                    {validationErrors[field.key]}
                  </p>
                )}
              </div>
            ))}

            {selectedTemplate.examples && selectedTemplate.examples.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Example Usage:
                </h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  {selectedTemplate.examples.map((example, index) => (
                    <li key={index}>• {example}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
            <button
              onClick={() => setIsConfiguring(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddServer}
              disabled={isAdding || !serverName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAdding ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Adding...
                </div>
              ) : (
                'Add Server'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Combine servers and templates into unified items
  const allItems = [
    // Existing servers
    ...settings.mcp.servers.map(server => ({
      type: 'server' as const,
      id: server.id,
      name: server.name,
      description: server.description || 'MCP Server',
      icon: '🔧',
      category: 'active',
      status: server.state,
      command: server.command,
      templateId: server.templateId,
      server
    })),
    // Available templates (that are not already added as servers)
    ...templates
      .filter(template => !settings.mcp.servers.some(server => server.templateId === template.id))
      .map(template => ({
        type: 'template' as const,
        id: template.id,
        name: template.name,
        description: template.description,
        icon: template.icon,
        category: template.category,
        template
      }))
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">MCP Integration</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Manage your MCP servers and add new integrations to extend functionality.
        </p>
      </div>

      {/* Filter/Search Bar */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search servers and templates..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span>Active ({settings.mcp.servers.filter(s => s.state === 'ready').length})</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            <span>Available ({templates.filter(t => !settings.mcp.servers.some(s => s.templateId === t.id)).length})</span>
          </span>
        </div>
      </div>

      {/* Unified Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {allItems.map(item => {
          if (item.type === 'server') {
            // Server Card
            return (
              <div
                key={item.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">{item.name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    item.status === 'ready' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : item.status === 'failed'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      : item.status === 'starting'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {item.status || 'configured'}
                  </span>
                </div>

                <div className="mb-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {item.command}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {getCategoryIcon(item.category)} {item.category}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors">
                      Edit
                    </button>
                    <button className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
                      Restart
                    </button>
                    <button className="px-2 py-1 text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          } else {
            // Template Card
            const status = installationStatus[item.id];
            const isInstalled = status?.isInstalled ?? (item.template.npmPackage === undefined);
            const isInstalling = status?.isInstalling ?? false;
            const hasError = !!status?.error;

            return (
              <div
                key={item.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">{item.name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
                    </div>
                  </div>
                  {isInstalled ? (
                    <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-full">
                      Ready
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full">
                      Not Installed
                    </span>
                  )}
                </div>

                {hasError && (
                  <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400">
                    Error: {status.error}
                  </div>
                )}

                <div className="mb-3">
                  <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center space-x-1">
                      <span>{getCategoryIcon(item.category)}</span>
                      <span>{item.category}</span>
                    </span>
                    <span>Config: {item.template.requiresConfig ? 'Required' : 'Optional'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {item.template.documentation && (
                    <a
                      href={item.template.documentation}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:underline"
                    >
                      📖 Docs
                    </a>
                  )}
                  <div className="flex items-center space-x-2 ml-auto">
                    {!isInstalled ? (
                      <button
                        onClick={() => handleInstall(item.id)}
                        disabled={isInstalling}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isInstalling ? 'Installing...' : 'Install'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleTemplateSelect(item.template)}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Add Server
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          }
        })}
      </div>

      {/* Empty State */}
      {allItems.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">🔧</div>
          <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">No MCP integrations available</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            Templates will appear here when the MCP system is properly configured
          </p>
        </div>
      )}
    </div>
  );
};