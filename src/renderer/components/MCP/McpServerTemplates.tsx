import React, { useState, useEffect } from 'react';
import { McpServerTemplateInfo, McpConfigField } from '../../../main/mcp/templates/McpServerTemplate';

interface McpServerTemplatesProps {
  onAddServer: (templateId: string, config: Record<string, any>, serverName: string) => void;
}

interface TemplateInstallationStatus {
  [templateId: string]: {
    isInstalled: boolean;
    isInstalling: boolean;
    error?: string;
  };
}

export const McpServerTemplates: React.FC<McpServerTemplatesProps> = ({ onAddServer }) => {
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
            // Notify parent that a server was added
            onAddServer(templateId, {}, `${template.name} Server`);
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
        // Call the parent's onAddServer callback if needed
        onAddServer(selectedTemplate.id, config, serverName);
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



  if (isConfiguring && selectedTemplate) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsConfiguring(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ← Back
            </button>
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{selectedTemplate.icon}</span>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Configure {selectedTemplate.name}
              </h3>
            </div>
          </div>
        </div>

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

        <div className="space-y-4">
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
        </div>

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

        <div className="flex justify-end space-x-3">
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
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Server Templates
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Choose from pre-configured server templates to quickly add new MCP servers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map(template => {
          const status = installationStatus[template.id];
          const isInstalled = status?.isInstalled ?? (template.npmPackage === undefined);
          const isInstalling = status?.isInstalling ?? false;
          const hasError = !!status?.error;

          return (
            <div
              key={template.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{template.icon}</span>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {template.name}
                    </h4>
                    <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {getCategoryIcon(template.category)} {template.category}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {isInstalled ? (
                    <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 px-2 py-1 rounded-full">
                      Ready
                    </span>
                  ) : (
                    <button
                      onClick={() => handleInstall(template.id)}
                      disabled={isInstalling}
                      className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 px-2 py-1 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50"
                    >
                      {isInstalling ? 'Installing...' : 'Install'}
                    </button>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {template.description}
              </p>

              {hasError && (
                <div className="text-xs text-red-600 dark:text-red-400 mb-3">
                  Error: {status.error}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>Requires config: {template.requiresConfig ? 'Yes' : 'No'}</span>
                </div>
                <button
                  onClick={() => handleTemplateSelect(template)}
                  disabled={!isInstalled}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Configure
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-400 text-4xl mb-4">🔧</div>
          <p className="text-gray-500 dark:text-gray-400">No server templates available</p>
        </div>
      )}
    </div>
  );
}; 