import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { isDev } from '../shared/utils';

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
      preload: join(__dirname, '../preload/preload.js'),
      // Enable web security
      webSecurity: true,
    },
    // Window configuration
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false, // Don't show until ready
  });

  // Load the app
  if (isDev) {
    // Development - load from vite dev server
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
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
import { configManager } from './config/ConfigManager';
import { connectionManager } from './mcp/ConnectionManager';
import { llmManager } from './llm/LlmManager';

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
    for (const serverConfig of settings.mcp.servers) {
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

// LLM handlers
ipcMain.handle('llm:sendMessage', async (_event, message, options = {}) => {
  try {
    const messages = [{ 
      id: Date.now().toString(), 
      role: 'user' as const, 
      content: message, 
      timestamp: new Date() 
    }];
    
    const response = await llmManager.sendMessage(messages, options);
    return { success: true, response };
  } catch (error) {
    console.error('LLM message failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Event forwarding from services to renderer
connectionManager.on('statusChange', (status) => {
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