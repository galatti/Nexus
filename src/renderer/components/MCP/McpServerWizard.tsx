import React, { useState, useEffect } from 'react';
import { McpServerConfig } from '../../../shared/types';

interface McpServerWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onServerAdded: () => void;
}

interface WizardStep {
  id: string;
  title: string;
  description: string;
}

interface ServerFormData {
  name: string;
  description: string;
  transport: 'stdio' | 'http' | 'sse' | 'websocket';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled: boolean;
  autoStart: boolean;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'basic',
    title: 'Basic Information',
    description: 'Set up your server\'s name and description'
  },
  {
    id: 'transport',
    title: 'Connection Type',
    description: 'Choose how to connect to your MCP server'
  },
  {
    id: 'configuration',
    title: 'Configuration',
    description: 'Configure connection details and settings'
  },
  {
    id: 'options',
    title: 'Options',
    description: 'Set startup and behavior options'
  },
  {
    id: 'review',
    title: 'Review & Test',
    description: 'Review your configuration and test the connection'
  }
];

export const McpServerWizard: React.FC<McpServerWizardProps> = ({ isOpen, onClose, onServerAdded }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<ServerFormData>({
    name: '',
    description: '',
    transport: 'stdio',
    enabled: true,
    autoStart: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset form when wizard opens
      setCurrentStep(0);
      setFormData({
        name: '',
        description: '',
        transport: 'stdio',
        enabled: true,
        autoStart: false
      });
      setErrors({});
      setTestResult(null);
    }
  }, [isOpen]);

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 0: // Basic Information
        if (!formData.name.trim()) {
          newErrors.name = 'Server name is required';
        }
        break;
      case 1: // Transport type - always valid
        break;
      case 2: // Configuration
        if (formData.transport === 'stdio') {
          if (!formData.command?.trim()) {
            newErrors.command = 'Command is required for STDIO transport';
          }
        } else {
          if (!formData.url?.trim()) {
            newErrors.url = 'URL is required for network transports';
          } else if (!formData.url.match(/^https?:\/\/.+/)) {
            newErrors.url = 'URL must start with http:// or https://';
          }
        }
        break;
      case 3: // Options - always valid
        break;
      case 4: // Review - always valid
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, WIZARD_STEPS.length - 1));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const updateFormData = (updates: Partial<ServerFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    // Clear related errors
    const newErrors = { ...errors };
    Object.keys(updates).forEach(key => {
      delete newErrors[key];
    });
    setErrors(newErrors);
  };

  const handleTestConnection = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      // Create a temporary server config for testing
      const testConfig: McpServerConfig = {
        id: `test-${Date.now()}`,
        name: formData.name,
        description: formData.description,
        transport: formData.transport,
        command: formData.command,
        args: formData.args || [],
        env: formData.env || {},
        url: formData.url,
        enabled: false, // Don't enable during test
        autoStart: false
      };

      const result = await window.electronAPI.testMcpConnection(testConfig);
      if (result.success) {
        setTestResult({ success: true, message: result.data?.message || 'Connection successful!' });
      } else {
        setTestResult({ success: false, message: result.error || 'Connection failed' });
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection test failed' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = async () => {
    if (!validateStep(currentStep)) return;

    // Require successful connection test before allowing server creation
    if (!testResult || !testResult.success) {
      setErrors({ general: 'Please test the connection successfully before adding the server.' });
      return;
    }

    setIsLoading(true);
    try {
      const serverConfig: Omit<McpServerConfig, 'id'> = {
        name: formData.name,
        description: formData.description,
        transport: formData.transport,
        command: formData.command,
        args: formData.args || [],
        env: formData.env || {},
        url: formData.url,
        enabled: formData.enabled,
        autoStart: formData.autoStart
      };

      const result = await window.electronAPI.addMcpServer(serverConfig);
      if (result.success) {
        onServerAdded();
        onClose();
      } else {
        setErrors({ general: result.error || 'Failed to add server' });
      }
    } catch (error) {
      setErrors({ 
        general: error instanceof Error ? error.message : 'Failed to add server' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay (click-through disabled to avoid losing progress) */}
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"></div>

        <div className="inline-block w-full max-w-4xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                Add MCP Server
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {WIZARD_STEPS[currentStep].description}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Step Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {WIZARD_STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-center ${index < WIZARD_STEPS.length - 1 ? 'flex-1' : ''}`}
                >
                  <div className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        index === currentStep
                          ? 'bg-blue-600 text-white'
                          : index < currentStep
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {index < currentStep ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="ml-3 hidden sm:block">
                      <p className={`text-sm font-medium ${
                        index === currentStep 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {step.title}
                      </p>
                    </div>
                  </div>
                  {index < WIZARD_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-4 ${
                      index < currentStep ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="mb-8">
            {currentStep === 0 && <BasicInfoStep formData={formData} updateFormData={updateFormData} errors={errors} />}
            {currentStep === 1 && <TransportStep formData={formData} updateFormData={updateFormData} />}
            {currentStep === 2 && <ConfigurationStep formData={formData} updateFormData={updateFormData} errors={errors} />}
            {currentStep === 3 && <OptionsStep formData={formData} updateFormData={updateFormData} />}
            {currentStep === 4 && (
              <ReviewStep 
                formData={formData} 
                onTest={handleTestConnection} 
                testResult={testResult} 
                isLoading={isLoading} 
              />
            )}
          </div>

          {/* Error Display */}
          {errors.general && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200">{errors.general}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-600">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <div className="flex space-x-3">
              {currentStep < WIZARD_STEPS.length - 1 ? (
                <button
                  onClick={nextStep}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleFinish}
                  disabled={isLoading || !testResult || !testResult.success}
                  className={`px-6 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    testResult && testResult.success 
                      ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                  title={testResult && testResult.success ? 'Add Server' : 'Test connection first'}
                >
                  {isLoading ? 'Adding...' : 'Add Server'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Step Components
const BasicInfoStep: React.FC<{
  formData: ServerFormData;
  updateFormData: (data: Partial<ServerFormData>) => void;
  errors: Record<string, string>;
}> = ({ formData, updateFormData, errors }) => {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Server Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => updateFormData({ name: e.target.value })}
          placeholder="e.g., My Filesystem Server"
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
            errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => updateFormData({ description: e.target.value })}
          placeholder="Describe what this server does..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        />
      </div>
    </div>
  );
};

const TransportStep: React.FC<{
  formData: ServerFormData;
  updateFormData: (data: Partial<ServerFormData>) => void;
}> = ({ formData, updateFormData }) => {
  const transports = [
    {
      type: 'stdio' as const,
      icon: '💬',
      title: 'STDIO',
      description: 'Communicate via standard input/output (most common)',
      recommended: true
    },
    {
      type: 'http' as const,
      icon: '🌐',
      title: 'HTTP',
      description: 'Connect to an HTTP server endpoint'
    },
    {
      type: 'sse' as const,
      icon: '📡',
      title: 'Server-Sent Events',
      description: 'Real-time communication via SSE'
    },
    {
      type: 'websocket' as const,
      icon: '⚡',
      title: 'WebSocket',
      description: 'Bidirectional real-time communication'
    }
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Choose how your application will communicate with the MCP server:
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {transports.map((transport) => (
          <div
            key={transport.type}
            onClick={() => updateFormData({ transport: transport.type })}
            className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
              formData.transport === transport.type
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            {transport.recommended && (
              <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                Recommended
              </div>
            )}
            
            <div className="flex items-start space-x-3">
              <div className="text-2xl">{transport.icon}</div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {transport.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {transport.description}
                </p>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 ${
                formData.transport === transport.type
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}>
                {formData.transport === transport.type && (
                  <div className="w-full h-full rounded-full bg-white scale-50"></div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ConfigurationStep: React.FC<{
  formData: ServerFormData;
  updateFormData: (data: Partial<ServerFormData>) => void;
  errors: Record<string, string>;
}> = ({ formData, updateFormData, errors }) => {
  const addEnvVar = () => {
    // Add a new placeholder variable that the user can edit inline
    const placeholderKey = `NEW_VAR_${Date.now()}`;
    updateFormData({
      env: { ...formData.env, [placeholderKey]: '' }
    });
  };

  const removeEnvVar = (key: string) => {
    const newEnv = { ...formData.env };
    delete newEnv[key];
    updateFormData({ env: newEnv });
  };

  const addArg = () => {
    // Append an empty argument placeholder; user can fill the value inline
    updateFormData({
      args: [...(formData.args || []), '']
    });
  };

  const removeArg = (index: number) => {
    const newArgs = [...(formData.args || [])];
    newArgs.splice(index, 1);
    updateFormData({ args: newArgs });
  };

  return (
    <div className="space-y-6">
      {formData.transport === 'stdio' ? (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Command *
            </label>
            <input
              type="text"
              value={formData.command || ''}
              onChange={(e) => updateFormData({ command: e.target.value })}
              placeholder="e.g., npx"
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                errors.command ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {errors.command && <p className="text-red-500 text-sm mt-1">{errors.command}</p>}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              The base command (executable) - arguments go in the Arguments section below
            </p>
            
            {/* Common Examples */}
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              <p className="font-medium mb-1">Common examples:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    updateFormData({ 
                      command: 'npx',
                      args: ['-y', '@modelcontextprotocol/server-everything']
                    });
                  }}
                  className="text-left p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  <div className="font-mono text-blue-600 dark:text-blue-400">npx</div>
                  <div className="text-gray-600 dark:text-gray-400">Everything server</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateFormData({ 
                      command: 'npx',
                      args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/directory']
                    });
                  }}
                  className="text-left p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  <div className="font-mono text-blue-600 dark:text-blue-400">npx</div>
                  <div className="text-gray-600 dark:text-gray-400">Filesystem server</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateFormData({ 
                      command: 'python',
                      args: ['-m', 'my_custom_server']
                    });
                  }}
                  className="text-left p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  <div className="font-mono text-blue-600 dark:text-blue-400">python</div>
                  <div className="text-gray-600 dark:text-gray-400">Custom server</div>
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Arguments
            </label>
            <div className="space-y-2">
              {(formData.args && formData.args.length > 0) ? formData.args.map((arg, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-8">#{index + 1}</span>
                  <input
                    type="text"
                    value={arg}
                    onChange={(e) => {
                      const newArgs = [...(formData.args || [])];
                      newArgs[index] = e.target.value;
                      updateFormData({ args: newArgs });
                    }}
                    placeholder={index === 0 ? "e.g., -y" : index === 1 ? "e.g., @modelcontextprotocol/server-everything" : ""}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                  />
                  <button
                    onClick={() => removeArg(index)}
                    className="text-red-500 hover:text-red-700 px-2 py-1 text-sm"
                  >
                    ✕
                  </button>
                </div>
              )) : (
                <div className="text-sm text-gray-500 dark:text-gray-400 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center">
                  No arguments added yet. Click &quot;Add Argument&quot; below to start.
                </div>
              )}
              <button
                onClick={addArg}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm px-3 py-2 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <span>+</span>
                <span>Add Argument</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Arguments are passed to the command in order. For npx commands, typically start with "-y" to auto-install packages.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Environment Variables
            </label>
            <div className="space-y-2">
              {Object.entries(formData.env || {}).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => {
                      const newKey = e.target.value;
                      const newEnv: Record<string, string> = {};
                      Object.entries(formData.env || {}).forEach(([k, v]) => {
                        if (k === key) {
                          newEnv[newKey] = v;
                        } else {
                          newEnv[k] = v;
                        }
                      });
                      updateFormData({ env: newEnv });
                    }}
                    className="w-1/3 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 dark:text-white"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                      updateFormData({
                        env: { ...formData.env, [key]: e.target.value }
                      });
                    }}
                    className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    onClick={() => removeEnvVar(key)}
                    className="text-red-500 hover:text-red-700 px-2 py-1 text-sm"
                    title="Remove environment variable"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={addEnvVar}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                + Add Environment Variable
              </button>
            </div>
          </div>
        </>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Server URL *
          </label>
          <input
            type="url"
            value={formData.url || ''}
            onChange={(e) => updateFormData({ url: e.target.value })}
            placeholder="https://localhost:3000"
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
              errors.url ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {errors.url && <p className="text-red-500 text-sm mt-1">{errors.url}</p>}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            The URL where your MCP server is running
          </p>
        </div>
      )}
    </div>
  );
};

const OptionsStep: React.FC<{
  formData: ServerFormData;
  updateFormData: (data: Partial<ServerFormData>) => void;
}> = ({ formData, updateFormData }) => {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Enable Server
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Start this server immediately after adding it
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => updateFormData({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Auto-start
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Automatically start this server when the application launches
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.autoStart}
              onChange={(e) => updateFormData({ autoStart: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
          💡 Tip
        </h4>
        <p className="text-sm text-blue-800 dark:text-blue-200">
          You can always change these settings later in the server management interface.
        </p>
      </div>
    </div>
  );
};

const ReviewStep: React.FC<{
  formData: ServerFormData;
  onTest: () => void;
  testResult: { success: boolean; message: string } | null;
  isLoading: boolean;
}> = ({ formData, onTest, testResult, isLoading }) => {
  return (
    <div className="space-y-6">
      {/* Status Chips (Enabled / Auto-start) */}
      <div className="flex items-center space-x-3">
        <span className={`px-2 py-1 rounded-full text-xs ${
          formData.enabled
            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
        }`}>
          {formData.enabled ? 'Enabled' : 'Disabled'}
        </span>
        {formData.autoStart && (
          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
            Auto-start
          </span>
        )}
      </div>

      {/* JSON Configuration Preview */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          📝 Generated Configuration
        </h4>
        <div className="bg-black rounded-md p-3 overflow-x-auto">
          <pre className="text-xs text-green-400 font-mono">
            {JSON.stringify({
              mcpServers: {
                [formData.name.toLowerCase().replace(/\s+/g, '-')]: formData.transport === 'stdio'
                  ? {
                      command: formData.command,
                      args: formData.args || [],
                      ...(formData.env && Object.keys(formData.env).length > 0 ? { env: formData.env } : {})
                    }
                  : {
                      url: formData.url
                    }
              }
            }, null, 2)}
          </pre>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          This configuration will be saved to your MCP settings file.
        </p>
      </div>

      {/* Test Connection */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Connection Test *
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Required before adding the server
            </p>
          </div>
          <button
            onClick={onTest}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50"
          >
            {isLoading ? 'Testing...' : 'Test Connection'}
          </button>
        </div>

        {testResult && (
          <div className={`p-4 rounded-lg border ${
            testResult.success
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center">
              <div className={`w-4 h-4 rounded-full mr-3 ${
                testResult.success ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className={`text-sm ${
                testResult.success
                  ? 'text-green-800 dark:text-green-200'
                  : 'text-red-800 dark:text-red-200'
              }`}>
                {testResult.message}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 