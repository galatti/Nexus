import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { isDev } from '../shared/utils.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Detect if running in WSL
const isWSL = process.platform === 'linux' && (
  process.env.WSL_DISTRO_NAME || 
  process.env.WSLENV ||
  existsSync('/proc/version') && 
  readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft')
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

function generateToolSummary(toolName: string, result: unknown): string {
  try {
    if (!result) return 'No result';
    
    // Handle MCP result format
    if (typeof result === 'object' && result !== null && 'content' in result) {
      const content = (result as any).content;
      if (Array.isArray(content)) {
        const textContent = content
          .filter((item: any) => item.type === 'text')
          .map((item: any) => item.text)
          .join(' ');
        
        // Generate summary based on tool type
        switch (toolName) {
          case 'list_allowed_directories':
          case 'list_directory':
            const lines = textContent.split('\n').filter(line => line.trim());
            return `Found ${lines.length} items`;
          
          case 'read_file':
            const lineCount = textContent.split('\n').length;
            const charCount = textContent.length;
            return `Read ${lineCount} lines (${charCount} characters)`;
          
          case 'search_files':
            const matches = textContent.split('\n').filter(line => line.trim());
            return `Found ${matches.length} matches`;
          
          case 'web_search':
            if (textContent.includes('results')) {
              const resultCount = (textContent.match(/\d+\.\s/g) || []).length;
              return `Found ${resultCount} search results`;
            }
            return 'Search completed';
          
          case 'get_weather':
          case 'weather':
            if (textContent.includes('temperature') || textContent.includes('°')) {
              return 'Weather data retrieved';
            }
            return 'Weather lookup completed';
          
          default:
            return 'Completed successfully';
        }
      }
    }
    
    // Handle simple string results
    if (typeof result === 'string') {
      const lines = result.split('\n').filter(line => line.trim());
      return `Returned ${lines.length} lines`;
    }
    
    return 'Operation completed';
  } catch (error) {
    return 'Result processed';
  }
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

ipcMain.handle('settings:reset', async (_event) => {
  try {
    // Stop all running MCP servers
    const servers = configManager.getMcpServers();
    for (const server of servers) {
      await serverManager.stopServer(server.id);
    }
    
    // Reset to default settings
    configManager.resetToDefaults();
    
    // Emit settings change event
    mainWindow?.webContents.send('settings:changed', configManager.getSettings());
    
    return { success: true };
  } catch (error) {
    console.error('Failed to reset settings:', error);
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

// Resource operations
ipcMain.handle('mcp:readResource', async (_event, serverId, uri) => {
  try {
    const result = await serverManager.readResource(serverId, uri);
    return { success: true, result };
  } catch (error) {
    console.error('MCP resource read failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('mcp:subscribeResource', async (_event, serverId, uri) => {
  try {
    await serverManager.subscribeToResource(serverId, uri);
    return { success: true };
  } catch (error) {
    console.error('MCP resource subscription failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('mcp:unsubscribeResource', async (_event, serverId, uri) => {
  try {
    await serverManager.unsubscribeFromResource(serverId, uri);
    return { success: true };
  } catch (error) {
    console.error('MCP resource unsubscription failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Prompt operations
ipcMain.handle('mcp:executePrompt', async (_event, serverId, promptName, args) => {
  try {
    const result = await serverManager.executePrompt(serverId, promptName, args);
    return { success: true, result };
  } catch (error) {
    console.error('MCP prompt execution failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// LLM sampling via MCP
ipcMain.handle('mcp:sampleLLM', async (_event, serverId, messages, options) => {
  try {
    const result = await serverManager.sampleLLM(serverId, messages, options);
    return { success: true, result };
  } catch (error) {
    console.error('MCP LLM sampling failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// MCP Server management handlers
ipcMain.handle('mcp:addServer', async (_event, serverConfig) => {
  try {
    // Generate unique ID if not provided
    if (!serverConfig.id) {
      serverConfig.id = `server-${Date.now()}`;
    }
    
    // Save the server configuration
    configManager.addMcpServer(serverConfig);
    
    // Auto-start if enabled
    if (serverConfig.enabled && serverConfig.autoStart) {
      await serverManager.startServer(serverConfig);
    }
    
    return { success: true, serverConfig };
  } catch (error) {
    console.error('Failed to add MCP server:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('mcp:updateServer', async (_event, serverId, updates) => {
  try {
    configManager.updateMcpServer(serverId, updates);
    
    // If the server is running and critical settings changed, restart it
    const serverState = serverManager.getServerState(serverId);
    if (serverState && serverState.state === 'ready') {
      if (updates.command || updates.args || updates.env) {
        await serverManager.stopServer(serverId);
        if (updates.enabled !== false) {
          const updatedServer = configManager.getMcpServers().find(s => s.id === serverId);
          if (updatedServer) {
            await serverManager.startServer(updatedServer);
          }
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to update MCP server:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('mcp:removeServer', async (_event, serverId) => {
  try {
    // Stop the server if it's running
    await serverManager.stopServer(serverId);
    
    // Remove from configuration
    configManager.removeMcpServer(serverId);
    
    return { success: true };
  } catch (error) {
    console.error('Failed to remove MCP server:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('mcp:removeAllServers', async (_event) => {
  try {
    // Stop all running servers
    await serverManager.stopAllServers();
    
    // Get all server IDs and remove them
    const servers = configManager.getMcpServers();
    for (const server of servers) {
      configManager.removeMcpServer(server.id);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to remove all MCP servers:', error);
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

ipcMain.handle('mcp:testConnection', async (_event, serverConfigOrId) => {
  try {
    let server;
    
    // Handle both server config (for wizard) and serverId (for existing servers)
    if (typeof serverConfigOrId === 'string') {
      // It's a serverId - find existing server
      const servers = configManager.getMcpServers();
      server = servers.find(s => s.id === serverConfigOrId);
      if (!server) {
        throw new Error(`Server ${serverConfigOrId} not found`);
      }
    } else {
      // It's a server config object from wizard
      server = serverConfigOrId;
    }
    
    // For the wizard, we'll do more thorough validation
    if (server.transport === 'stdio') {
      if (!server.command) {
        return { success: false, error: 'Command is required for STDIO transport' };
      }
      
      // Try to actually test the command if it's for testing (has no ID)
      if (!server.id || server.id.startsWith('test-')) {
        return new Promise((resolve) => {
          try {
            // Parse command properly - handle shell commands
            let cmd: string;
            let args: string[];
            
            if (server.command.includes(' ')) {
              // Split command, but handle quoted arguments properly
              const parts = server.command.match(/[^\s"']+|"([^"]*)"|'([^']*)'/g) || [];
              cmd = parts[0];
                             args = [...parts.slice(1).map((arg: string) => arg.replace(/^["']|["']$/g, '')), ...(server.args || [])];
            } else {
              cmd = server.command;
              args = server.args || [];
            }
            
            // On Windows, handle special commands
            if (process.platform === 'win32' && (cmd === 'npx' || cmd === 'npm' || cmd === 'node')) {
              // Use .cmd extension on Windows for npm/npx
              if (cmd === 'npx' && !cmd.endsWith('.cmd')) {
                cmd = 'npx.cmd';
              } else if (cmd === 'npm' && !cmd.endsWith('.cmd')) {
                cmd = 'npm.cmd';
              }
            }
            
            const child = spawn(cmd, args, {
              stdio: ['pipe', 'pipe', 'pipe'],
              env: { ...process.env, ...(server.env || {}) },
              shell: process.platform === 'win32' // Use shell on Windows
            });
            
            let output = '';
            let errorOutput = '';
            
            const timeout = setTimeout(() => {
              child.kill();
              resolve({ success: false, error: 'Connection test timed out (10s)' });
            }, 10000);
            
            child.stdout?.on('data', (data: Buffer) => {
              output += data.toString();
            });
            
            child.stderr?.on('data', (data: Buffer) => {
              errorOutput += data.toString();
            });
            
            child.on('error', (error: NodeJS.ErrnoException) => {
              clearTimeout(timeout);
              if (error.code === 'ENOENT') {
                resolve({ success: false, error: `Command not found: ${cmd}. Make sure it's installed and in PATH.` });
              } else {
                resolve({ success: false, error: `Failed to start: ${error.message}` });
              }
            });
            
            child.on('spawn', () => {
              // If it spawns successfully, it's probably valid
              setTimeout(() => {
                clearTimeout(timeout);
                child.kill();
                resolve({ success: true, message: 'Command spawned successfully' });
              }, 2000);
            });
            
          } catch (error) {
            resolve({ success: false, error: `Test failed: ${error instanceof Error ? error.message : String(error)}` });
          }
        });
      } else {
        // For existing servers, just validate format
        return { success: true, message: 'STDIO configuration looks valid' };
      }
    } else {
      if (!server.url) {
        return { success: false, error: 'URL is required for network transport' };
      }
      // For network transports, validate the URL format
      try {
        new URL(server.url);
        return { success: true, message: 'URL format is valid' };
      } catch {
        return { success: false, error: 'Invalid URL format' };
      }
    }
  } catch (error) {
    console.error('Failed to test connection:', error);
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
    
    const resources = serverManager.getAvailableResources(serverId);
    const prompts = serverManager.getAvailablePrompts(serverId);
    
    const capabilities = {
      tools: tools.length,
      resources: resources.length,
      prompts: prompts.length,
      toolsList: tools,
      resourcesList: resources,
      promptsList: prompts
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
    
    const allResources = serverManager.getAllAvailableResources();
    const allPrompts = serverManager.getAllAvailablePrompts();
    
    // Group resources and prompts by server
    const resourcesByServer: Record<string, any[]> = {};
    allResources.forEach(resource => {
      if (!resourcesByServer[resource.serverId]) {
        resourcesByServer[resource.serverId] = [];
      }
      resourcesByServer[resource.serverId].push(resource);
    });
    
    const promptsByServer: Record<string, any[]> = {};
    allPrompts.forEach(prompt => {
      if (!promptsByServer[prompt.serverId]) {
        promptsByServer[prompt.serverId] = [];
      }
      promptsByServer[prompt.serverId].push(prompt);
    });
    
    const totalCapabilities = {
      tools: allTools.length,
      resources: allResources.length,
      prompts: allPrompts.length,
      toolsByServer,
      resourcesByServer,
      promptsByServer
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

// Additional permission management handlers
ipcMain.handle('permissions:getAll', () => {
  try {
    const permissions = permissionManager.getAllPermissions();
    // Convert dates to strings for serialization
    const serializable = permissions.map(permission => ({
      ...permission,
      grantedAt: permission.grantedAt?.toISOString(),
      expiresAt: permission.expiresAt?.toISOString(),
      lastUsed: permission.lastUsed?.toISOString()
    }));
    return { success: true, data: serializable };
  } catch (error) {
    console.error('Failed to get all permissions:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('permissions:getStats', () => {
  try {
    const stats = permissionManager.getPermissionStats();
    return { success: true, data: stats };
  } catch (error) {
    console.error('Failed to get permission stats:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('permissions:revoke', (_event, serverId, toolName) => {
  try {
    const success = permissionManager.revokePermission(serverId, toolName);
    return { success };
  } catch (error) {
    console.error('Failed to revoke permission:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('permissions:clearSession', () => {
  try {
    permissionManager.clearSessionPermissions();
    return { success: true };
  } catch (error) {
    console.error('Failed to clear session permissions:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('permissions:clearAll', () => {
  try {
    permissionManager.clearAllPermissions();
    return { success: true };
  } catch (error) {
    console.error('Failed to clear all permissions:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('permissions:clearExpired', () => {
  try {
    const clearedCount = permissionManager.clearExpiredPermissions();
    return { success: true, clearedCount };
  } catch (error) {
    console.error('Failed to clear expired permissions:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Function to detect tool usage from response content
function detectToolUsageFromContent(content: string, availableTools: Array<{ serverId: string; name: string; description: string }>): Array<{ id: string; name: string; args: Record<string, unknown> }> {
  const detectedTools: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];
  
  // Patterns to detect common tool usage scenarios
  const toolPatterns = [
    // File operations
    { 
      pattern: /content of.*?`([^`]+\.(txt|md|js|ts|json|py|html|css|yml|yaml|xml|ini|cfg|conf))`/i,
      toolName: 'read_file',
      extractArgs: (match: RegExpMatchArray) => ({ path: match[1] })
    },
    {
      pattern: /reading.*?file.*?`([^`]+)`/i,
      toolName: 'read_file', 
      extractArgs: (match: RegExpMatchArray) => ({ path: match[1] })
    },
    {
      pattern: /Here.*?content.*?`([^`]+)`.*?file/i,
      toolName: 'read_file',
      extractArgs: (match: RegExpMatchArray) => ({ path: match[1] })
    },
    // Directory operations
    {
      pattern: /directory listing|files.*?directories|listing.*?contents/i,
      toolName: 'list_directory',
      extractArgs: () => ({ path: '.' })
    },
    // Search operations
    {
      pattern: /search.*?results|found.*?matching|searching.*?for/i,
      toolName: 'brave_web_search',
      extractArgs: () => ({ query: 'search query' })
    },
    // Weather operations
    {
      pattern: /weather.*?forecast|current.*?weather|temperature.*?conditions/i,
      toolName: 'get-forecast',
      extractArgs: () => ({ location: 'location' })
    }
  ];

  // Check each pattern against the content
  for (const { pattern, toolName, extractArgs } of toolPatterns) {
    const match = content.match(pattern);
    if (match) {
      // Find the actual tool in available tools
      const tool = availableTools.find(t => t.name === toolName);
      if (tool) {
        const toolId = `detected-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        detectedTools.push({
          id: toolId,
          name: toolName,
          args: extractArgs(match)
        });
        
        console.log('🔍 Detected tool usage:', {
          toolName,
          pattern: pattern.toString(),
          match: match[0],
          args: extractArgs(match)
        });
        
        // Only detect one tool per response to avoid duplicates
        break;
      }
    }
  }

  return detectedTools;
}

// LLM handlers
ipcMain.handle('llm:sendMessage', async (_event, conversationHistory, options = {}) => {
  try {
    let messages = [...conversationHistory];
    let extractedToolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];
    
    // Get available tools and convert to OpenRouter format
    const availableTools = serverManager.getAllAvailableTools();
    let tools: Array<{ type: 'function'; function: { name: string; description: string; parameters: any; } }> = [];
    
    if (availableTools.length > 0) {
      tools = availableTools.map(tool => ({
        type: 'function' as const,
        function: {
          name: `${tool.serverId}__${tool.name}`,
          description: `${tool.description} (Server: ${tool.serverId})`,
          parameters: tool.inputSchema || { type: 'object', properties: {} }
        }
      }));

      console.log('LLM: Available tools for function calling:', tools.length);
    }

    // Make initial LLM request with tools
    const response = await llmManager.sendMessage(messages, {
      ...options,
      tools: tools.length > 0 ? tools : undefined
    });

    console.log('LLM: Response received:', {
      hasContent: !!response.content,
      hasToolCalls: !!response.toolCalls,
      toolCallsCount: response.toolCalls?.length || 0,
      actualToolCalls: response.toolCalls,
      contentPreview: response.content?.substring(0, 200) + '...'
    });

    // Handle tool calls if present (native OpenRouter tool calling)
    let finalResponse = response;
    
    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log('LLM: Processing native tool calls:', response.toolCalls.length);
      
      // Extract tool calls for frontend display
      extractedToolCalls = response.toolCalls.map(toolCall => {
        const [serverId, toolName] = toolCall.function.name.split('__');
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (error) {
          console.error('Failed to parse tool arguments:', toolCall.function.arguments, error);
        }
        
        return {
          id: toolCall.id,
          name: toolName,
          args
        };
      });

      // Add the assistant message with tool calls to conversation
      messages.push({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.content || '',
        timestamp: new Date(),
        tokens: response.tokens
      });

      // Execute all tools in parallel
      const toolExecutionPromises = response.toolCalls.map(async (toolCall) => {
        const [serverId, toolName] = toolCall.function.name.split('__');
        
        try {
          let args = {};
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch (error) {
            console.error('Failed to parse tool arguments:', toolCall.function.arguments, error);
          }
          
          console.log('LLM: Executing tool:', toolName, 'on server:', serverId, 'with args:', args);
          const toolResult = await serverManager.executeTool(serverId, toolName, args);
          console.log('LLM: Tool result for', toolName, ':', toolResult);
          
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
            [/≡ƒìà/g, '🍅'], [/ΓÅ░/g, '⏰'], [/≡ƒôè/g, '📊'], [/≡ƒÄ»/g, '🎯'],
            [/ΓÅ╕∩╕Å/g, '⏸️'], [/≡ƒÅ¡/g, '☕'], [/≡ƒÅ╗/g, '🧘'], [/≡ƒôü/g, '🔄'],
            [/≡ƒöì/g, '🔍'], [/ΓÇó/g, '•'], [/├úo/g, 'ão'], [/ΓÇª/g, '...'],
            [/┬░/g, '°'], [/├úo Paulo/g, 'São Paulo'], [/S├úo/g, 'São'],
            [/&#x27;/g, "'"], [/&quot;/g, '"'], [/&lt;/g, '<'], [/&gt;/g, '>'], [/&amp;/g, '&']
          ];
          
          for (const [corrupted, fixed] of unicodeFixes) {
            resultText = resultText.replace(corrupted, fixed);
          }
          
          return {
            toolCallId: toolCall.id,
            name: toolName,
            content: resultText,
            success: true
          };
          
        } catch (error) {
          console.error('LLM: Tool execution failed for', toolName, ':', error);
          return {
            toolCallId: toolCall.id,
            name: toolName,
            content: `Error: ${error instanceof Error ? error.message : String(error)}`,
            success: false
          };
        }
      });
      
      // Wait for all tool executions to complete
      const toolResults = await Promise.allSettled(toolExecutionPromises);
      
      // Add tool result messages to conversation
      toolResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const { toolCallId, name, content } = result.value;
          messages.push({
            id: `tool-${Date.now()}-${index}`,
            role: 'tool',
            content: content,
            timestamp: new Date(),
            tool_call_id: toolCallId,
            name: name
          });
        } else {
          // Handle promise rejection
          const toolCall = response.toolCalls![index];
          const [, toolName] = toolCall.function.name.split('__');
          messages.push({
            id: `tool-error-${Date.now()}-${index}`,
            role: 'tool',
            content: `Error: ${result.reason}`,
            timestamp: new Date(),
            tool_call_id: toolCall.id,
            name: toolName
          });
        }
      });
      
      // Make second LLM request with tool results
      console.log('LLM: Sending follow-up request with tool results');
      finalResponse = await llmManager.sendMessage(messages, {
        ...options,
        tools: tools.length > 0 ? tools : undefined
      });
    } else {
      // Fallback: Detect tool usage from content when OpenRouter doesn't provide tool calls
      console.log('LLM: No native tool calls detected, analyzing content for tool usage...');
      extractedToolCalls = detectToolUsageFromContent(response.content, availableTools);
      
      if (extractedToolCalls.length > 0) {
        console.log('LLM: Detected tool usage from content:', extractedToolCalls.length);
      }
    }
    
    // Apply smart formatting to the entire response
    finalResponse = {
      ...finalResponse,
      content: formatAIResponse(finalResponse.content)
    };

    console.log('LLM: Returning response with tool calls:', extractedToolCalls.length);

    return { 
      success: true, 
      response: finalResponse,
      toolCalls: extractedToolCalls.length > 0 ? extractedToolCalls : undefined
    };
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

// Forward MCP notifications to renderer
serverManager.on('progressNotification', (serverId, notification) => {
  console.log('Forwarding progress notification:', serverId, notification);
  mainWindow?.webContents.send('mcp:progressNotification', serverId, notification);
});

serverManager.on('logMessage', (serverId, logMessage) => {
  console.log('Forwarding log message:', serverId, logMessage);
  mainWindow?.webContents.send('mcp:logMessage', serverId, logMessage);
});

serverManager.on('resourcesChanged', (serverId, resources) => {
  console.log('Forwarding resources changed:', serverId, resources.length);
  mainWindow?.webContents.send('mcp:resourcesChanged', serverId, resources);
});

serverManager.on('resourceUpdated', (serverId, uri) => {
  console.log('Forwarding resource updated:', serverId, uri);
  mainWindow?.webContents.send('mcp:resourceUpdated', serverId, uri);
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