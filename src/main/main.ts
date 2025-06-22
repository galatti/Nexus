import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { isDev } from '../shared/utils.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      // Enable node integration in renderer process
      nodeIntegration: false,
      // Enable context isolation for security
      contextIsolation: true,
      // Preload script path
      preload: join(__dirname, '../preload/preload.mjs'),
      // Enable web security
      webSecurity: true,
      // Enable ES modules support in sandbox
      sandbox: false,
      // Enable ES modules in preload
      additionalArguments: ['--enable-experimental-web-platform-features'],
    },
    // Window configuration
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true, // Hide menu bar (can still access with Alt key)
    show: false, // Don't show until ready
  });

  // Load the app
  if (isDev) {
    // Development - load from vite dev server
    const devPort = process.env.DEV_SERVER_PORT || '5173';
    mainWindow.loadURL(`http://localhost:${devPort}`);
    // Open DevTools in development (commented out for cleaner startup)
    // mainWindow.webContents.openDevTools();
  } else {
    // Production - load from built files
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// App event handlers
app.whenReady().then(async () => {
  try {
    createWindow();
    await initializeServices();
  } catch (error) {
    console.error('Failed to initialize application:', error);
    app.quit();
  }

  // macOS specific: create window on dock icon click
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    await cleanup();
    app.quit();
  }
});

// Handle app quit
app.on('before-quit', async (event) => {
  event.preventDefault();
  await cleanup();
  app.exit();
});

// Security: Prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});

// Import services
import { configManager } from './config/ConfigManager.js';
import { connectionManager } from './mcp/ConnectionManager.js';
import { llmManager } from './llm/LlmManager.js';
import { templateManager } from './mcp/templates/TemplateManager.js';
import { permissionManager } from './permissions/PermissionManager.js';

// Initialize services
async function initializeServices(): Promise<void> {
  try {
    console.log('Initializing application services');
    
    // Initialize LLM manager
    await llmManager.initialize();
    
    // Load configuration and set up providers
    const settings = configManager.getSettings();
    
    // Add LLM provider if configured
    if (settings.llm.provider.enabled) {
      await llmManager.addProvider(settings.llm.provider);
    }
    

    
    // Connect to configured MCP servers
    const updatedSettings = configManager.getSettings();
    for (const serverConfig of updatedSettings.mcp.servers) {
      if (serverConfig.enabled && serverConfig.autoStart) {
        try {
          await connectionManager.connectToServer(serverConfig);
        } catch (error) {
          console.error(`Failed to auto-connect to MCP server ${serverConfig.name}:`, error);
        }
      }
    }
    
    console.log('Application services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    throw error;
  }
}

// IPC Handlers

// App info handlers
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// Window control handlers
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

// Settings handlers
ipcMain.handle('settings:get', () => {
  return configManager.getSettings();
});

ipcMain.handle('settings:set', async (_event, settings) => {
  try {
    configManager.updateSettings(settings);
    
    // Update LLM provider if changed
    if (settings.llm?.provider) {
      const currentProvider = llmManager.getCurrentProvider();
      if (currentProvider) {
        const providerId = `${settings.llm.provider.type}-${settings.llm.provider.name.toLowerCase().replace(/\s+/g, '-')}`;
        await llmManager.updateProvider(providerId, settings.llm.provider);
      } else if (settings.llm.provider.enabled) {
        await llmManager.addProvider(settings.llm.provider);
      }
    }
    
    // Emit settings change event
    mainWindow?.webContents.send('settings:changed', configManager.getSettings());
    
    return { success: true };
  } catch (error) {
    console.error('Failed to update settings:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// MCP handlers
ipcMain.handle('mcp:connect', async (_event, config) => {
  try {
    await connectionManager.connectToServer(config);
    
    // Save server configuration
    configManager.addMcpServer(config);
    
    return { success: true };
  } catch (error) {
    console.error('MCP connection failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('mcp:disconnect', async (_event, serverId) => {
  try {
    await connectionManager.disconnectFromServer(serverId);
    return { success: true };
  } catch (error) {
    console.error('MCP disconnection failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('mcp:executeTool', async (_event, serverId, toolName, args) => {
  try {
    const result = await connectionManager.executeTool(serverId, toolName, args);
    return { success: true, result };
  } catch (error) {
    console.error('MCP tool execution failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// MCP Template handlers
ipcMain.handle('mcp:getTemplates', () => {
  try {
    const templates = templateManager.getAllTemplates();
    return { success: true, templates };
  } catch (error) {
    console.error('Failed to get MCP templates:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('mcp:checkInstallations', async () => {
  try {
    const status = await templateManager.checkAllInstallations();
    const statusObject = Object.fromEntries(status);
    return { success: true, status: statusObject };
  } catch (error) {
    console.error('Failed to check MCP installations:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('mcp:installTemplate', async (_event, templateId) => {
  try {
    const result = await templateManager.installTemplate(templateId);
    return result;
  } catch (error) {
    console.error('Failed to install MCP template:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('mcp:generateServerFromTemplate', async (_event, templateId, config, serverName) => {
  try {
    const serverConfig = await templateManager.generateServerConfig(templateId, config, serverName);
    
    // Save the server configuration
    configManager.addMcpServer(serverConfig);
    
    // Auto-connect if enabled
    if (serverConfig.enabled && serverConfig.autoStart) {
      await connectionManager.connectToServer(serverConfig);
    }
    
    return { success: true, serverConfig };
  } catch (error) {
    console.error('Failed to generate server from template:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('mcp:getServers', async (_event) => {
  try {
    const servers = configManager.getMcpServers();
    // Add current connection status to each server
    const serversWithStatus = servers.map(server => ({
      ...server,
      status: connectionManager.getConnectionStatus(server.id)?.status || 'disconnected'
    }));
    return { success: true, servers: serversWithStatus };
  } catch (error) {
    console.error('Failed to get MCP servers:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('mcp:testConnection', async (_event, serverId) => {
  try {
    const servers = configManager.getMcpServers();
    const server = servers.find(s => s.id === serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }
    
    await connectionManager.connectToServer(server);
    return { success: true };
  } catch (error) {
    console.error('Failed to test connection:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Permission handlers
ipcMain.handle('permissions:getPending', () => {
  try {
    const pending = permissionManager.getPendingApprovals();
    return { success: true, pending };
  } catch (error) {
    console.error('Failed to get pending approvals:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('permissions:respond', (_event, approvalId, result) => {
  try {
    const success = permissionManager.respondToApproval(approvalId, result);
    return { success };
  } catch (error) {
    console.error('Failed to respond to approval:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// LLM handlers
ipcMain.handle('llm:sendMessage', async (_event, message, options = {}) => {
  try {
    const messages = [{ 
      id: Date.now().toString(), 
      role: 'user' as const, 
      content: message, 
      timestamp: new Date() 
    }];
    
    // Get available MCP tools and add them to the system message
    const availableTools = connectionManager.getAllAvailableTools();
    console.log('LLM: Available tools:', availableTools.length, availableTools.map(t => t.name));
    if (availableTools.length > 0) {
      const toolsMessage = {
        id: 'system-tools',
        role: 'system' as const,
        content: `You have access to the following tools through the Model Context Protocol (MCP):

${availableTools.map((tool: any) => 
  `**${tool.name}** (from ${tool.serverId}): ${tool.description}
  Parameters: ${JSON.stringify(tool.inputSchema, null, 2)}`
).join('\n\n')}

When the user asks you to perform an action that matches one of these tools, you should:
1. First respond with what you're going to do
2. Then call the tool using this format: <tool_call>{"tool": "tool_name", "serverId": "server_id", "args": {...}}</tool_call>
3. The tool result will be automatically included in your response

For example, if user says "start a timer", respond with:
"I'll start a timer for you. <tool_call>{"tool": "start_timer", "serverId": "timer-server-id", "args": {"sessionType": "work"}}</tool_call>"`,
        timestamp: new Date()
      } as any;
      
      // Add system message with tools info before user message
      messages.unshift(toolsMessage);
    }
    
    const response = await llmManager.sendMessage(messages, options);
    
    // Parse response for tool calls
    let finalResponse = response;
    console.log('LLM: Response content before parsing:', response.content);
    const toolCallRegex = /<tool_call>(.*?)<\/tool_call>/gs; // Added 's' flag for multiline
    const toolCalls = [];
    let match;
    
    while ((match = toolCallRegex.exec(response.content)) !== null) {
      console.log('LLM: Found tool call match:', match[0]);
      try {
        const toolCall = JSON.parse(match[1]);
        toolCalls.push({ toolCall, fullMatch: match[0] });
      } catch (error) {
        console.error('Failed to parse tool call:', match[1], error);
      }
    }
    
    // Execute tool calls
    if (toolCalls.length > 0) {
      console.log('LLM: Executing tool calls:', toolCalls.length);
      let updatedContent = response.content;
      
      for (const item of toolCalls) {
        const { toolCall, fullMatch } = item;
        try {
          console.log('LLM: Executing tool:', toolCall.tool, 'on server:', toolCall.serverId);
          const toolResult = await connectionManager.executeTool(
            toolCall.serverId, 
            toolCall.tool, 
            toolCall.args || {}
          );
          console.log('LLM: Tool result:', toolResult);
          
          // Extract clean text from MCP result
          let resultText = '';
          if (toolResult && typeof toolResult === 'object' && 'content' in toolResult && Array.isArray((toolResult as any).content)) {
            resultText = (toolResult as any).content
              .filter((item: any) => item.type === 'text')
              .map((item: any) => item.text)
              .join('\n');
          } else if (typeof toolResult === 'string') {
            resultText = toolResult;
          } else {
            resultText = JSON.stringify(toolResult, null, 2);
          }
          
          // Fix corrupted Unicode characters (common encoding issues)
          const unicodeFixes: Array<[RegExp, string]> = [
            [/≡ƒìà/g, '🍅'], // Tomato emoji
            [/ΓÅ░/g, '⏰'],   // Clock emoji  
            [/≡ƒôè/g, '📊'], // Chart emoji
            [/≡ƒÄ»/g, '🎯'], // Target emoji
            [/ΓÅ╕∩╕Å/g, '⏸️'], // Pause emoji
            [/≡ƒÅ¡/g, '☕'], // Coffee emoji
            [/≡ƒÅ╗/g, '🧘'], // Meditation emoji
            [/≡ƒôü/g, '🔄'], // Refresh emoji
            [/≡ƒôè/g, '⏹️'], // Stop emoji
          ];
          
          for (const [corrupted, fixed] of unicodeFixes) {
            resultText = resultText.replace(corrupted, fixed);
          }
          
          const cleanResultText = `\n\n${resultText}`;
          console.log('LLM: Replacing:', fullMatch, 'with:', cleanResultText);
          updatedContent = updatedContent.replace(fullMatch, cleanResultText);
          
        } catch (error) {
          console.error('LLM: Tool execution failed:', error);
          const errorText = `\n\n❌ **Tool Error**: ${error instanceof Error ? error.message : String(error)}`;
          console.log('LLM: Replacing:', fullMatch, 'with error:', errorText);
          updatedContent = updatedContent.replace(fullMatch, errorText);
        }
      }
      
      finalResponse = {
        ...response,
        content: updatedContent
      };
    }
    
    return { success: true, response: finalResponse };
  } catch (error) {
    console.error('LLM message failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('llm:getStatus', () => {
  try {
    const status = llmManager.getStatus();
    return { success: true, status };
  } catch (error) {
    console.error('Failed to get LLM status:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('llm:getAvailableModels', async (_event, providerId) => {
  try {
    const models = await llmManager.getAvailableModels(providerId);
    return { success: true, models };
  } catch (error) {
    console.error('Failed to get available models:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Event forwarding from services to renderer
connectionManager.on('statusChange', (status) => {
  console.log('Forwarding status change:', status.serverId, status.status, 'mainWindow exists:', !!mainWindow);
  mainWindow?.webContents.send('mcp:serverStatusChange', status.serverId, status.status);
});

llmManager.on('currentProviderChanged', (data) => {
  mainWindow?.webContents.send('llm:providerChanged', data);
});

llmManager.on('messageError', (data) => {
  mainWindow?.webContents.send('llm:messageError', data);
});

// Cleanup handlers
const cleanup = async () => {
  console.log('Application cleanup started');
  
  try {
    await connectionManager.disconnectAll();
    await llmManager.shutdown();
    console.log('Application cleanup completed');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}; 