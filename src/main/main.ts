import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { isDev } from '../shared/utils.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Detect if running in WSL
const isWSL = process.platform === 'linux' && (
  process.env.WSL_DISTRO_NAME || 
  process.env.WSLENV ||
  require('fs').existsSync('/proc/version') && 
  require('fs').readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft')
);

// Apply WSL-specific fixes only when running in WSL
if (isWSL) {
  console.log('🐧 WSL detected - applying compatibility fixes');
  
  // Force software rendering for WSL compatibility
  app.disableHardwareAcceleration();
  
  // Add WSL-specific command line switches
  app.commandLine.appendSwitch('--no-sandbox');
  app.commandLine.appendSwitch('--disable-setuid-sandbox');
  app.commandLine.appendSwitch('--disable-dev-shm-usage');
  app.commandLine.appendSwitch('--disable-accelerated-2d-canvas');
  app.commandLine.appendSwitch('--disable-gpu');
  app.commandLine.appendSwitch('--disable-gpu-compositing');
  app.commandLine.appendSwitch('--disable-shared-memory');
  app.commandLine.appendSwitch('--in-process-gpu');
} else if (process.platform === 'linux') {
  console.log('🐧 Native Linux detected - using hardware acceleration');
}

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
      // Disable web security in dev for debugging
      webSecurity: !isDev,
      // Enable ES modules support in sandbox
      sandbox: false,
      // Enable ES modules in preload
      additionalArguments: [
        '--enable-experimental-web-platform-features',
        // WSL-specific flags to help with rendering
        '--disable-gpu-sandbox',
        '--disable-software-rasterizer',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      // Enable DevTools in development
      devTools: isDev,
    },
    // Window configuration
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: !isDev, // Show menu bar in dev for debugging
    show: true, // Show immediately for debugging
  });

  // Load the app
  if (isDev) {
    // Development - load from vite dev server
    const devPort = process.env.DEV_SERVER_PORT || '5173';
    const url = `http://localhost:${devPort}`;
    console.log(`🌐 Loading URL: ${url}`);
    console.log(`🔧 isDev: ${isDev}, NODE_ENV: ${process.env.NODE_ENV}`);
    
    mainWindow.loadURL(url);
    
    // Add error handling for load failures
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error(`❌ Failed to load: ${validatedURL}`);
      console.error(`❌ Error: ${errorCode} - ${errorDescription}`);
    });
    
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('✅ Page loaded successfully');
    });
    
    // DevTools available via menu or Ctrl+Shift+I, but don't auto-open
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
import { serverManager } from './mcp/ConnectionManager.js';
import { llmManager } from './llm/LlmManager.js';
import { templateManager } from './mcp/templates/TemplateManager.js';
import { permissionManager } from './permissions/PermissionManager.js';

// Smart formatting functions
// Clean up corrupted Unicode and HTML entities
function cleanupText(text: string): string {
  let cleaned = text;
  
  // HTML entities - fix these first
  cleaned = cleaned.replace(/&quot;/g, '"');
  cleaned = cleaned.replace(/&#x27;/g, "'");
  cleaned = cleaned.replace(/&lt;strong&gt;/g, '**');
  cleaned = cleaned.replace(/&lt;\/strong&gt;/g, '**');
  cleaned = cleaned.replace(/&lt;/g, '<');
  cleaned = cleaned.replace(/&gt;/g, '>');
  cleaned = cleaned.replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/&nbsp;/g, ' ');
  
  // Portuguese and special characters - most common issues
  cleaned = cleaned.replace(/S├úo Paulo/g, 'São Paulo');
  cleaned = cleaned.replace(/S├úo/g, 'São');
  cleaned = cleaned.replace(/├úo/g, 'ão');
  cleaned = cleaned.replace(/├¡/g, 'á');
  cleaned = cleaned.replace(/├¬/g, 'ì');
  cleaned = cleaned.replace(/├⌐/g, 'é');
  cleaned = cleaned.replace(/├¢/g, 'â');
  cleaned = cleaned.replace(/├┤/g, 'ô');
  cleaned = cleaned.replace(/├╡/g, 'õ');
  cleaned = cleaned.replace(/├º/g, 'ú');
  cleaned = cleaned.replace(/├ç/g, 'ç');
  
  // Degree symbols and coordinates
  cleaned = cleaned.replace(/┬░/g, '°');
  cleaned = cleaned.replace(/┬┤/g, "'");
  cleaned = cleaned.replace(/┬│/g, '"');
  
  // Corrupted emojis and symbols - replace with proper ones
  cleaned = cleaned.replace(/≡ƒöì/g, '🔍');
  cleaned = cleaned.replace(/≡ƒôä/g, '📄');
  cleaned = cleaned.replace(/≡ƒô¥/g, '📝');
  cleaned = cleaned.replace(/≡ƒöù/g, '🔗');
  cleaned = cleaned.replace(/≡ƒìà/g, '🍅');
  cleaned = cleaned.replace(/ΓÅ░/g, '⏰');
  cleaned = cleaned.replace(/≡ƒôè/g, '📊');
  cleaned = cleaned.replace(/≡ƒÄ»/g, '🎯');
  
  // Text symbols and punctuation
  cleaned = cleaned.replace(/ΓÇó/g, '•');
  cleaned = cleaned.replace(/ΓÇª/g, '...');
  cleaned = cleaned.replace(/ΓçÉ/g, '⇌');
  cleaned = cleaned.replace(/ΓçÆ/g, '⇆');
  cleaned = cleaned.replace(/┬╖/g, '·');
  
  // Phonetic symbols (for pronunciation) - simplify
  cleaned = cleaned.replace(/╔É╠â╦êpin╔És/g, 'Campinas');
  cleaned = cleaned.replace(/k╔É╠â╦êpin╔És/g, 'Campinas');
  cleaned = cleaned.replace(/\[k╔É╠â╦êpin╔És\]/g, '[Campinas]');
  cleaned = cleaned.replace(/╔É/g, 'a');
  cleaned = cleaned.replace(/╠â/g, '');
  cleaned = cleaned.replace(/╦ê/g, '');
  cleaned = cleaned.replace(/pin╔És/g, 'pinas');
  cleaned = cleaned.replace(/╔ç/g, 'e');
  
  return cleaned;
}

function formatToolResult(toolName: string, resultText: string): string {
  // Detect data types and format accordingly
  if (resultText.startsWith('Error:')) {
    return `❌ **Error**: ${resultText.replace('Error:', '').trim()}`;
  }
  
  // Format directory listings
  if (toolName.includes('list') || toolName.includes('directory')) {
    if (resultText.includes('Allowed directories:')) {
      return `📂 **Accessible Directories:**\n\`\`\`\n${resultText.replace('Allowed directories:\n', '')}\n\`\`\``;
    }
    
    // Format file/directory listings
    const lines = resultText.split('\n').filter(line => line.trim());
    if (lines.length > 1) {
      let formatted = '📁 **Directory Contents:**\n';
      lines.forEach(line => {
        if (line.includes('[DIR]')) {
          formatted += `📁 ${line.replace('[DIR]', '').trim()}\n`;
        } else if (line.includes('[FILE]')) {
          formatted += `📄 ${line.replace('[FILE]', '').trim()}\n`;
        } else if (line.trim()) {
          formatted += `• ${line.trim()}\n`;
        }
      });
      return formatted.trim();
    }
  }
  
  // Format JSON data
  if (resultText.trim().startsWith('{') || resultText.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(resultText);
      return `📊 **Data:**\n\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
    } catch {
      // Not valid JSON, continue with other formatting
    }
  }
  
  // Format file content
  if (toolName.includes('read_file')) {
    return `📄 **File Content:**\n\`\`\`\n${resultText}\n\`\`\``;
  }
  
  // Format search results with better structure
  if (toolName.includes('search') || toolName.includes('brave_')) {
    // Clean up the search results with comprehensive Unicode fixing
    let cleaned = cleanupText(resultText);
    
    // Remove HTML tags but preserve content
    cleaned = cleaned.replace(/<\/?strong>/g, '**');
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    
    // Structure the search results better
    const entries = cleaned.split('\n\n').filter(entry => entry.trim());
    let formatted = '🔍 **Search Results:**\n\n';
    
    entries.forEach((entry, index) => {
      if (entry.trim()) {
        const lines = entry.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
          formatted += `**Result ${index + 1}:**\n`;
          lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('Title:')) {
              formatted += `📄 **${trimmed}**\n`;
            } else if (trimmed.startsWith('URL:')) {
              const url = trimmed.replace('URL:', '').trim();
              formatted += `🔗 **URL:** [${url}](${url})\n`;
            } else if (trimmed.startsWith('Description:')) {
              formatted += `📝 **${trimmed}**\n`;
            } else if (trimmed) {
              formatted += `${trimmed}\n`;
            }
          });
          formatted += '\n---\n\n';
        }
      }
    });
    
    return formatted.trim();
  }
  
  // Default formatting with appropriate icon
  const icon = getToolIcon(toolName);
  return `${icon} **Result:**\n${resultText}`;
}

function formatAIResponse(content: string): string {
  // First, clean up corrupted Unicode and HTML entities
  let formatted = cleanupText(content);
  
  // Then, normalize spacing
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  
  // Format search results with bullet points and better structure
  formatted = formatted.replace(/^•\s*(.+)$/gm, (match, content) => {
    // Extract key information from search results
    if (content.includes('Title:') && content.includes('URL:')) {
      return `\n**🔍 Search Result:**\n${content}`;
    }
    return `• ${content}`;
  });
  
  // Format coordinate and geographic information - handle multiple formats
  formatted = formatted.replace(/latitude[:\s]*(-?\d+(?:\.\d+)?)[°\s]*([NS])?/gi, '🌍 **Latitude:** $1°$2');
  formatted = formatted.replace(/longitude[:\s]*(-?\d+(?:\.\d+)?)[°\s]*([EW])?/gi, '🌍 **Longitude:** $1°$2');
  
  // Handle coordinate pairs in descriptions (common format: "coordinates are: -22.907104, -47.063240")
  formatted = formatted.replace(/coordinates are:\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/gi, 
    '🌍 **Coordinates:** $1°, $2°');
  
  // Handle "Latitude: X Longitude: Y" format
  formatted = formatted.replace(/Latitude:\s*(-?\d+(?:\.\d+)?)\s*Longitude:\s*(-?\d+(?:\.\d+)?)/gi,
    '🌍 **Latitude:** $1° 🌍 **Longitude:** $2°');
    
  formatted = formatted.replace(/elevation[:\s]*(\d+(?:\.\d+)?)\s*(m|meters?|ft|feet?)?/gi, '⛰️ **Elevation:** $1 $2');
  
  // Format URLs better
  formatted = formatted.replace(/URL:\s*(https?:\/\/[^\s]+)/g, '🔗 **URL:** [$1]($1)');
  
  // Format titles with proper emphasis
  formatted = formatted.replace(/Title:\s*(.+?)(?=\n|$)/g, '📄 **Title:** $1');
  
  // Format descriptions with better spacing
  formatted = formatted.replace(/Description:\s*(.+?)(?=\n•|\n$)/gs, (match, desc) => {
    // Clean up description formatting
    const cleanDesc = desc.replace(/<\/?strong>/g, '**').trim();
    return `📝 **Description:** ${cleanDesc}`;
  });
  
  // Format weather information
  formatted = formatted.replace(/temperature[:\s]*(-?\d+(?:\.\d+)?)[°\s]*([CF])?/gi, '🌡️ **Temperature:** $1°$2');
  formatted = formatted.replace(/humidity[:\s]*(\d+(?:\.\d+)?)%?/gi, '💧 **Humidity:** $1%');
  formatted = formatted.replace(/wind[:\s]*(\d+(?:\.\d+)?)\s*(mph|km\/h|m\/s)?/gi, '💨 **Wind:** $1 $2');
  
  // Format location information
  formatted = formatted.replace(/city[:\s]*([^,\n]+)/gi, '🏙️ **City:** $1');
  formatted = formatted.replace(/country[:\s]*([^,\n]+)/gi, '🌎 **Country:** $1');
  formatted = formatted.replace(/state[:\s]*([^,\n]+)/gi, '🗺️ **State:** $1');
  
  // Add proper list formatting
  formatted = formatted.replace(/^(\d+\.\s)/gm, '\n$1');
  formatted = formatted.replace(/^(-\s|\*\s)/gm, '\n$1');
  
  // Improve code block formatting
  formatted = formatted.replace(/```(\w+)?\n/g, '\n```$1\n');
  formatted = formatted.replace(/\n```\n/g, '\n```\n\n');
  
  // Format coordinates in a more readable way
  formatted = formatted.replace(/(\d+)°\s*(\d+)'\s*(\d+(?:\.\d+)?)"?\s*([NSEW])/g, '$1° $2′ $3″ $4');
  
  // Add section breaks for long responses with multiple search results
  const lines = formatted.split('\n');
  let resultCount = 0;
  const processedLines = lines.map((line, index) => {
    if (line.includes('🔍 Search Result:')) {
      resultCount++;
      if (resultCount > 1 && index > 0) {
        return `\n---\n\n${line}`;
      }
    }
    return line;
  });
  
  formatted = processedLines.join('\n');
  
  // Add summary section for coordinate searches
  if (formatted.includes('🌍') && (formatted.includes('Search Result') || formatted.includes('search'))) {
    // Try multiple coordinate extraction patterns
    let lat = '', lng = '', latDir = '', lngDir = '';
    
    // Pattern 1: "🌍 **Coordinates:** -22.907104°, -47.063240°"
    const coordPairMatch = formatted.match(/🌍 \*\*Coordinates:\*\* (-?\d+(?:\.\d+)?)°,\s*(-?\d+(?:\.\d+)?)°/);
    if (coordPairMatch) {
      lat = coordPairMatch[1];
      lng = coordPairMatch[2];
    } else {
      // Pattern 2: Separate latitude and longitude
      const latMatch = formatted.match(/🌍 \*\*Latitude:\*\* (-?\d+(?:\.\d+)?)[°\s]*([NS])?/);
      const lngMatch = formatted.match(/🌍 \*\*Longitude:\*\* (-?\d+(?:\.\d+)?)[°\s]*([EW])?/);
      
      if (latMatch && lngMatch) {
        lat = latMatch[1];
        latDir = latMatch[2] || '';
        lng = lngMatch[1];
        lngDir = lngMatch[2] || '';
      }
    }
    
    if (lat && lng) {
      const summary = `## 📍 **Quick Summary**\n**Coordinates:** ${lat}°${latDir}, ${lng}°${lngDir}\n\n---\n\n## 🔍 **Detailed Search Results**\n\n`;
      formatted = summary + formatted;
    }
  }
  
  // Clean up extra whitespace and normalize
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  formatted = formatted.replace(/^\n+|\n+$/g, '');
  
  return formatted;
}

function getToolIcon(toolName: string): string {
  if (toolName.includes('read')) return '📖';
  if (toolName.includes('write') || toolName.includes('create')) return '✏️';
  if (toolName.includes('list') || toolName.includes('directory')) return '📋';
  if (toolName.includes('search') || toolName.includes('find')) return '🔍';
  if (toolName.includes('delete') || toolName.includes('remove')) return '🗑️';
  if (toolName.includes('move') || toolName.includes('copy')) return '📦';
  if (toolName.includes('info') || toolName.includes('status')) return 'ℹ️';
  if (toolName.includes('edit') || toolName.includes('modify')) return '📝';
  if (toolName.includes('weather')) return '🌤️';
  if (toolName.includes('web') || toolName.includes('search')) return '🌐';
  return '🔧'; // Default tool icon
}

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
    

    
    // Start configured MCP servers
    const updatedSettings = configManager.getSettings();
    for (const serverConfig of updatedSettings.mcp.servers) {
      if (serverConfig.enabled && serverConfig.autoStart) {
        try {
          await serverManager.startServer(serverConfig);
        } catch (error) {
          console.error(`Failed to auto-start MCP server ${serverConfig.name}:`, error);
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
ipcMain.handle('mcp:start', async (_event, config) => {
  try {
    await serverManager.startServer(config);
    
    // Save server configuration
    configManager.addMcpServer(config);
    
    return { success: true };
  } catch (error) {
    console.error('MCP server start failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('mcp:stop', async (_event, serverId) => {
  try {
    await serverManager.stopServer(serverId);
    return { success: true };
  } catch (error) {
    console.error('MCP server stop failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('mcp:executeTool', async (_event, serverId, toolName, args) => {
  try {
    const result = await serverManager.executeTool(serverId, toolName, args);
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
    
    // Auto-start if enabled
    if (serverConfig.enabled && serverConfig.autoStart) {
      await serverManager.startServer(serverConfig);
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
    // Add current server state to each server
    const serversWithState = servers.map(server => ({
      ...server,
      state: serverManager.getServerState(server.id)?.state || 'configured'
    }));
    return { success: true, servers: serversWithState };
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
    
    await serverManager.startServer(server);
    return { success: true };
  } catch (error) {
    console.error('Failed to start server:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('mcp:getServerCapabilities', async (_event, serverId) => {
  try {
    const serverState = serverManager.getServerState(serverId);
    if (!serverState || serverState.state !== 'ready') {
      return { success: false, error: 'Server not ready' };
    }

    const tools = serverManager.getAvailableTools(serverId);
    
    // TODO: Add resources and prompts when implemented
    const capabilities = {
      tools: tools.length,
      resources: 0, // Placeholder until resources are implemented
      prompts: 0,   // Placeholder until prompts are implemented
      toolsList: tools
    };
    
    return { success: true, capabilities };
  } catch (error) {
    console.error('Failed to get server capabilities:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('mcp:getAllCapabilities', async (_event) => {
  try {
    const allTools = serverManager.getAllAvailableTools();
    
    // Group tools by server
    const toolsByServer: Record<string, any[]> = {};
    allTools.forEach(tool => {
      if (!toolsByServer[tool.serverId]) {
        toolsByServer[tool.serverId] = [];
      }
      toolsByServer[tool.serverId].push(tool);
    });
    
    const totalCapabilities = {
      tools: allTools.length,
      resources: 0, // Placeholder until resources are implemented
      prompts: 0,   // Placeholder until prompts are implemented
      toolsByServer
    };
    
    return { success: true, capabilities: totalCapabilities };
  } catch (error) {
    console.error('Failed to get all capabilities:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('mcp:updateServerEnabled', async (_event, serverId, enabled) => {
  try {
    const servers = configManager.getMcpServers();
    const serverIndex = servers.findIndex(s => s.id === serverId);
    
    if (serverIndex === -1) {
      throw new Error(`Server ${serverId} not found`);
    }

    // Update the server configuration
    configManager.updateMcpServer(serverId, { 
      enabled: enabled,
      autoStart: enabled // Also update autoStart to match
    });
    
    // If disabling, stop the server
    if (!enabled) {
      await serverManager.stopServer(serverId);
    }
    // If enabling and autoStart is true, start the server
    else if (enabled && servers[serverIndex].autoStart) {
      try {
        await serverManager.startServer(servers[serverIndex]);
      } catch (error) {
        console.error(`Failed to auto-start server ${serverId} after enabling:`, error);
        // Don't fail the enable operation if start fails
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to update server enabled status:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Permission handlers
ipcMain.handle('permissions:getPending', () => {
  try {
    const pending = permissionManager.getPendingApprovals();
    // Create serializable versions (remove functions and timeout objects)
    const serializablePending = pending.map(approval => ({
      id: approval.id,
      serverId: approval.serverId,
      serverName: approval.serverName,
      toolName: approval.toolName,
      toolDescription: approval.toolDescription,
      args: approval.args,
      riskLevel: approval.riskLevel,
      riskReasons: approval.riskReasons,
      requestedAt: approval.requestedAt
    }));
    return { success: true, pending: serializablePending };
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
ipcMain.handle('llm:sendMessage', async (_event, conversationHistory, options = {}) => {
  try {
    // conversationHistory is now an array of ChatMessage objects
    const messages = conversationHistory.map((msg: any) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
      timestamp: new Date(msg.timestamp)
    }));
    
    // Get available MCP tools and add them to the system message
    const availableTools = serverManager.getAllAvailableTools();
    console.log('LLM: Available tools:', availableTools.length, availableTools.map(t => t.name));
    
    // Check if we already have a system message with tools, if not add one
    const hasSystemMessage = messages.some((msg: any) => msg.role === 'system' && msg.content.includes('Model Context Protocol'));
    
    if (availableTools.length > 0 && !hasSystemMessage) {
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
3. After the tool call, continue your response as if the tool result will be inserted
4. The tool result will be automatically included, so you should provide context and explanation

For example, if user says "list files", respond with:
"I'll check the available directories and then list the files for you. <tool_call>{"tool": "list_allowed_directories", "serverId": "filesystem-1750707971824", "args": {}}</tool_call>

Based on the available directories above, I can help you navigate and list files in your accessible locations."

IMPORTANT: Always provide clear, well-structured responses. When presenting search results or complex information:
- Use clear headings and sections
- Break up long text into digestible chunks
- Highlight key information (coordinates, temperatures, etc.)
- Provide context and explanations
- Use bullet points for lists
- Include relevant emojis for visual clarity

Your responses will be automatically formatted for better readability, but you should still structure your content logically.`,
        timestamp: new Date()
      } as any;
      
      // Add system message with tools info at the beginning
      messages.unshift(toolsMessage);
    }
    
    const response = await llmManager.sendMessage(messages, options);
    
    // Parse response for tool calls
    let finalResponse = response;
    console.log('LLM: Response content before parsing:', response.content);
    const toolCallRegex = /<tool_call>(.*?)<\/tool_call>/gs; // Added 's' flag for multiline
    const toolCalls: Array<{ toolCall: any; fullMatch: string }> = [];
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
    
    // Execute tool calls in parallel for better performance
    if (toolCalls.length > 0) {
      console.log('LLM: Executing tool calls in parallel:', toolCalls.length);
      let updatedContent = response.content;
      
      // Execute all tools in parallel
      const toolExecutionPromises = toolCalls.map(async (item) => {
        const { toolCall, fullMatch } = item;
        try {
          console.log('LLM: Executing tool:', toolCall.tool, 'on server:', toolCall.serverId);
          const toolResult = await serverManager.executeTool(
            toolCall.serverId, 
            toolCall.tool, 
            toolCall.args || {}
          );
          console.log('LLM: Tool result for', toolCall.tool, ':', toolResult);
          
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
          
          // Fix corrupted Unicode characters and HTML entities
          const unicodeFixes: Array<[RegExp, string]> = [
            // Common corrupted emojis
            [/≡ƒìà/g, '🍅'], // Tomato emoji
            [/ΓÅ░/g, '⏰'],   // Clock emoji  
            [/≡ƒôè/g, '📊'], // Chart emoji
            [/≡ƒÄ»/g, '🎯'], // Target emoji
            [/ΓÅ╕∩╕Å/g, '⏸️'], // Pause emoji
            [/≡ƒÅ¡/g, '☕'], // Coffee emoji
            [/≡ƒÅ╗/g, '🧘'], // Meditation emoji
            [/≡ƒôü/g, '🔄'], // Refresh emoji
            [/≡ƒöì/g, '🔍'], // Search emoji
            [/ΓÇó/g, '•'],   // Bullet point
            [/├úo/g, 'ão'],  // Portuguese ão
            [/╔É╠â╦êpin╔És/g, 'kɐ̃ˈpinɐs'], // Campinas pronunciation
            [/ΓÇª/g, '...'], // Ellipsis
            [/┬░/g, '°'],    // Degree symbol
            [/├úo Paulo/g, 'São Paulo'], // São Paulo
            [/S├úo/g, 'São'], // São
            [/╔É/g, 'ɐ'],    // Schwa
            [/╠â/g, '̃'],     // Tilde combining
            [/╦ê/g, 'ˈ'],    // Primary stress
            [/pin╔És/g, 'pinɐs'], // Campinas ending
            [/╔ç/g, 'ɛ'],    // Open-mid front unrounded vowel
            [/ΓçÉ/g, '→'],   // Right arrow
            [/ΓçÆ/g, '←'],   // Left arrow
            [/&#x27;/g, "'"], // Apostrophe
            [/&quot;/g, '"'], // Quote
            [/&lt;/g, '<'],   // Less than
            [/&gt;/g, '>'],   // Greater than
            [/&amp;/g, '&'],  // Ampersand
          ];
          
          for (const [corrupted, fixed] of unicodeFixes) {
            resultText = resultText.replace(corrupted, fixed);
          }
          
          // Smart format the tool result
          const formattedResultText = formatToolResult(toolCall.tool, resultText);
          const cleanResultText = `\n\n${formattedResultText}`;
          
          return {
            fullMatch,
            cleanResultText,
            success: true
          };
          
        } catch (error) {
          console.error('LLM: Tool execution failed for', toolCall.tool, ':', error);
          const errorText = `\n\n❌ **Tool Error**: ${error instanceof Error ? error.message : String(error)}`;
          
          return {
            fullMatch,
            cleanResultText: errorText,
            success: false
          };
        }
      });
      
      // Wait for all tool executions to complete
      const toolResults = await Promise.allSettled(toolExecutionPromises);
      
      // Process results and update content
      toolResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const { fullMatch, cleanResultText } = result.value;
          console.log('LLM: Replacing:', fullMatch, 'with:', cleanResultText);
          updatedContent = updatedContent.replace(fullMatch, cleanResultText);
        } else {
          // Handle promise rejection
          const { fullMatch } = toolCalls[index];
          const errorText = `\n\n❌ **Tool Error**: ${result.reason}`;
          console.log('LLM: Replacing (promise rejected):', fullMatch, 'with error:', errorText);
          updatedContent = updatedContent.replace(fullMatch, errorText);
        }
      });
      
      // If the response ends abruptly after tool results, add a helpful conclusion
      const trimmedContent = updatedContent.trim();
      const lines = trimmedContent.split('\n');
      const lastLine = lines[lines.length - 1];
      
      console.log('LLM: Checking for follow-up. Last line:', lastLine);
      console.log('LLM: Total lines:', lines.length, 'Content length:', trimmedContent.length);
      
      // Check if response ends abruptly
      const endsAbruptly = (
        lastLine.includes('Error:') || 
        lastLine.includes('Allowed directories:') ||
        lastLine.match(/^[A-Z]:\\/) || // Windows path
        lastLine.endsWith('check...') || // Common incomplete ending
        lastLine.endsWith('...') || // Any ellipsis ending
        lines.length <= 4 || // Increased from 3
        trimmedContent.length < 150 // Increased threshold
      );
      
      console.log('LLM: Ends abruptly?', endsAbruptly);
      
      if (endsAbruptly) {
        if (lastLine.includes('Error:')) {
          updatedContent += '\n\nI encountered an error. Let me know if you need help with the correct path or a different approach!';
        } else {
          updatedContent += '\n\nLet me know if you need help with anything specific!';
        }
        console.log('LLM: Added follow-up text');
      }
      
      finalResponse = {
        ...response,
        content: updatedContent
      };
    }
    
    // Apply smart formatting to the entire response
    finalResponse = {
      ...finalResponse,
      content: formatAIResponse(finalResponse.content)
    };
    
    return { success: true, response: finalResponse };
  } catch (error) {
    console.error('LLM message failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('llm:getStatus', () => {
  try {
    const status = llmManager.getStatus();
    return { success: true, data: status };
  } catch (error) {
    console.error('Failed to get LLM status:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('llm:getAvailableModels', async (_event, providerId) => {
  try {
    const models = await llmManager.getAvailableModels(providerId);
    return { success: true, data: models };
  } catch (error) {
    console.error('Failed to get available models:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Event forwarding from services to renderer
serverManager.on('stateChange', (serverState) => {
  console.log('Forwarding state change:', serverState.serverId, serverState.state, 'mainWindow exists:', !!mainWindow);
  mainWindow?.webContents.send('mcp:serverStateChange', serverState.serverId, serverState.state);
});

llmManager.on('currentProviderChanged', (data) => {
  mainWindow?.webContents.send('llm:providerChanged', data);
});

llmManager.on('messageError', (data) => {
  mainWindow?.webContents.send('llm:messageError', data);
});

// Permission event forwarding
permissionManager.on('permissionRequest', (pendingApproval) => {
  console.log('Forwarding permission request:', pendingApproval.toolName, 'mainWindow exists:', !!mainWindow);
  // Create serializable version for IPC
  const serializableApproval = {
    id: pendingApproval.id,
    serverId: pendingApproval.serverId,
    serverName: pendingApproval.serverName,
    toolName: pendingApproval.toolName,
    toolDescription: pendingApproval.toolDescription,
    args: pendingApproval.args,
    riskLevel: pendingApproval.riskLevel,
    riskReasons: pendingApproval.riskReasons,
    requestedAt: pendingApproval.requestedAt
  };
  mainWindow?.webContents.send('permissions:requestPermission', serializableApproval);
});

// Cleanup handlers
const cleanup = async () => {
  console.log('Application cleanup started');
  
  try {
    await serverManager.stopAllServers();
    await llmManager.shutdown();
    console.log('Application cleanup completed');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}; 