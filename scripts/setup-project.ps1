param(
    [switch]$Help
)

# NEXUS Project Setup Script (PowerShell)
# This script initializes the project structure and installs dependencies

if ($Help) {
    Write-Host @"
NEXUS Project Setup Script

Usage: .\setup-project.ps1

This script will:
- Check prerequisites (Node.js, npm, git)
- Initialize package.json with all required dependencies
- Create the complete project structure
- Install all dependencies
- Set up TypeScript, Vite, Tailwind CSS configurations
- Create initial source files
- Configure linting and formatting tools

Prerequisites:
- Node.js 18+ (https://nodejs.org/)
- npm 9+
- Git (recommended)

"@
    exit 0
}

$ErrorActionPreference = "Stop"

# Project information
$PROJECT_NAME = "nexus-mvp"
$PROJECT_DESCRIPTION = "NEXUS - MCP-first desktop application built with Electron"

Write-Host "🚀 Setting up NEXUS Project" -ForegroundColor Green

# Check prerequisites
function Test-Prerequisites {
    Write-Host "🔍 Checking prerequisites..." -ForegroundColor Yellow
    
    # Check Node.js
    try {
        $nodeVersion = node --version
        $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        
        if ($majorVersion -lt 18) {
            throw "Node.js 18+ is required. Current version: $nodeVersion"
        }
        
        Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
        Write-Host "💡 Download from: https://nodejs.org/" -ForegroundColor Blue
        throw
    }
    
    # Check npm
    try {
        $npmVersion = npm --version
        Write-Host "✅ npm version: $npmVersion" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ npm is not installed" -ForegroundColor Red
        throw
    }
    
    # Check git
    try {
        $gitVersion = git --version
        Write-Host "✅ $gitVersion" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  Git is not installed. Some features may not work." -ForegroundColor Yellow
    }
}

# Initialize package.json
function Initialize-PackageJson {
    Write-Host "📦 Initializing package.json..." -ForegroundColor Yellow
    
    $packageJson = @{
        name = $PROJECT_NAME
        version = "0.1.0"
        description = $PROJECT_DESCRIPTION
        main = "dist/main/main.js"
        scripts = @{
            dev = "concurrently `"npm run dev:renderer`" `"npm run dev:main`""
            "dev:renderer" = "vite"
            "dev:main" = "tsc -p tsconfig.main.json && electron dist/main/main.js"
            build = "npm run build:renderer && npm run build:main"
            "build:renderer" = "vite build"
            "build:main" = "tsc -p tsconfig.main.json"
            dist = "electron-builder"
            "dist:win" = "electron-builder --win"
            "dist:mac" = "electron-builder --mac"
            "dist:linux" = "electron-builder --linux"
            test = "jest"
            "test:watch" = "jest --watch"
            lint = "eslint src --ext .ts,.tsx"
            format = "prettier --write src/**/*.{ts,tsx}"
            clean = "rimraf dist node_modules/.cache"
        }
        keywords = @("electron", "mcp", "model-context-protocol", "desktop", "ai", "chat")
        author = "NEXUS Team"
        license = "MIT"
        devDependencies = @{}
        dependencies = @{}
        build = @{
            appId = "com.nexus.mvp"
            productName = "NEXUS"
            directories = @{
                output = "release"
            }
            files = @("dist/**/*", "assets/**/*", "package.json")
            win = @{
                target = "nsis"
                icon = "assets/icon.ico"
            }
            mac = @{
                target = "dmg"
                icon = "assets/icon.icns"
            }
            linux = @{
                target = "AppImage"
                icon = "assets/icon.png"
            }
        }
    }
    
    $packageJson | ConvertTo-Json -Depth 10 | Set-Content -Path "package.json" -Encoding UTF8
    Write-Host "✅ package.json created" -ForegroundColor Green
}

# Create project structure
function New-ProjectStructure {
    Write-Host "📁 Creating project structure..." -ForegroundColor Yellow
    
    # Main directories
    $directories = @(
        "src/main", "src/renderer", "src/preload", "src/shared",
        "src/renderer/components/Layout", "src/renderer/components/Chat", "src/renderer/components/Settings",
        "src/main/mcp", "src/main/llm", "src/main/config", "src/main/permissions",
        "src/main/mcp/templates", "src/main/llm/providers",
        "assets", "scripts", "tests", "docs"
    )
    
    foreach ($dir in $directories) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    
    Write-Host "✅ Project structure created" -ForegroundColor Green
}

# Install dependencies
function Install-Dependencies {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    
    # Core dependencies
    $coreDependencies = @(
        "electron", "@modelcontextprotocol/sdk", "react", "react-dom",
        "zustand", "react-markdown", "remark-gfm", "prismjs"
    )
    
    npm install @coreDependencies
    if ($LASTEXITCODE -ne 0) { throw "Failed to install core dependencies" }
    
    # Development dependencies
    $devDependencies = @(
        "@types/node", "@types/react", "@types/react-dom", "@types/prismjs",
        "typescript", "vite", "@vitejs/plugin-react", "electron-builder",
        "concurrently", "tailwindcss", "@tailwindcss/typography", "autoprefixer",
        "postcss", "eslint", "@typescript-eslint/eslint-plugin",
        "@typescript-eslint/parser", "prettier", "jest", "@testing-library/react",
        "@testing-library/jest-dom", "playwright", "winston", "rimraf"
    )
    
    npm install --save-dev @devDependencies
    if ($LASTEXITCODE -ne 0) { throw "Failed to install dev dependencies" }
    
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
}

# Create TypeScript configuration
function New-TypeScriptConfig {
    Write-Host "⚙️  Creating TypeScript configuration..." -ForegroundColor Yellow
    
    # Main tsconfig.json
    $tsconfig = @{
        compilerOptions = @{
            target = "ES2020"
            lib = @("ES2020", "DOM", "DOM.Iterable")
            allowJs = $true
            skipLibCheck = $true
            esModuleInterop = $true
            allowSyntheticDefaultImports = $true
            strict = $true
            forceConsistentCasingInFileNames = $true
            moduleResolution = "node"
            resolveJsonModule = $true
            isolatedModules = $true
            noEmit = $true
            jsx = "react-jsx"
            baseUrl = "."
            paths = @{
                "@/*" = @("src/*")
                "@/main/*" = @("src/main/*")
                "@/renderer/*" = @("src/renderer/*")
                "@/shared/*" = @("src/shared/*")
            }
        }
        include = @("src/renderer/**/*", "src/shared/**/*")
        exclude = @("node_modules", "dist")
    }
    
    $tsconfig | ConvertTo-Json -Depth 10 | Set-Content -Path "tsconfig.json" -Encoding UTF8
    
    # Main process tsconfig
    $tsconfigMain = @{
        extends = "./tsconfig.json"
        compilerOptions = @{
            target = "ES2020"
            module = "CommonJS"
            outDir = "dist/main"
            noEmit = $false
            jsx = "preserve"
        }
        include = @("src/main/**/*", "src/preload/**/*", "src/shared/**/*")
        exclude = @("src/renderer", "node_modules", "dist")
    }
    
    $tsconfigMain | ConvertTo-Json -Depth 10 | Set-Content -Path "tsconfig.main.json" -Encoding UTF8
    
    Write-Host "✅ TypeScript configuration created" -ForegroundColor Green
}

# Create Vite configuration
function New-ViteConfig {
    Write-Host "⚙️  Creating Vite configuration..." -ForegroundColor Yellow
    
    $viteConfig = @"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/main': resolve(__dirname, 'src/main'),
      '@/renderer': resolve(__dirname, 'src/renderer'),
      '@/shared': resolve(__dirname, 'src/shared')
    }
  },
  server: {
    port: 3000
  }
})
"@
    
    $viteConfig | Set-Content -Path "vite.config.ts" -Encoding UTF8
    Write-Host "✅ Vite configuration created" -ForegroundColor Green
}

# Create Tailwind configuration
function New-TailwindConfig {
    Write-Host "⚙️  Creating Tailwind CSS configuration..." -ForegroundColor Yellow
    
    $tailwindConfig = @"
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
  darkMode: 'class',
}
"@
    
    $tailwindConfig | Set-Content -Path "tailwind.config.js" -Encoding UTF8
    
    $postcssConfig = @"
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
"@
    
    $postcssConfig | Set-Content -Path "postcss.config.js" -Encoding UTF8
    Write-Host "✅ Tailwind CSS configuration created" -ForegroundColor Green
}

# Create initial source files
function New-InitialFiles {
    Write-Host "📝 Creating initial source files..." -ForegroundColor Yellow
    
    # Main process entry point
    $mainTs = @"
import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '../preload/preload.js')
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
"@
    
    $mainTs | Set-Content -Path "src/main/main.ts" -Encoding UTF8
    
    # Preload script
    $preloadTs = @"
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Add IPC methods here
})
"@
    
    $preloadTs | Set-Content -Path "src/preload/preload.ts" -Encoding UTF8
    
    # React App
    $appTsx = @"
import React from 'react'
import './App.css'

function App() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-8">
          NEXUS
        </h1>
        <p className="text-lg text-center text-gray-600 dark:text-gray-300">
          MCP-first desktop application built with Electron
        </p>
      </div>
    </div>
  )
}

export default App
"@
    
    $appTsx | Set-Content -Path "src/renderer/App.tsx" -Encoding UTF8
    
    # App CSS
    $appCss = @"
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
"@
    
    $appCss | Set-Content -Path "src/renderer/App.css" -Encoding UTF8
    
    # Main entry point
    $mainTsx = @"
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
"@
    
    $mainTsx | Set-Content -Path "src/renderer/main.tsx" -Encoding UTF8
    
    # HTML template
    $indexHtml = @"
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NEXUS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
"@
    
    $indexHtml | Set-Content -Path "src/renderer/index.html" -Encoding UTF8
    
    Write-Host "✅ Initial source files created" -ForegroundColor Green
}

# Create linting configuration
function New-LintingConfig {
    Write-Host "⚙️  Creating linting configuration..." -ForegroundColor Yellow
    
    $eslintConfig = @"
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
  ],
  env: {
    node: true,
    browser: true,
    es2020: true,
  },
  rules: {
    // Add custom rules here
  },
}
"@
    
    $eslintConfig | Set-Content -Path ".eslintrc.js" -Encoding UTF8
    
    $prettierConfig = @{
        semi = $false
        trailingComma = "es5"
        singleQuote = $true
        printWidth = 80
        tabWidth = 2
        useTabs = $false
    }
    
    $prettierConfig | ConvertTo-Json | Set-Content -Path ".prettierrc" -Encoding UTF8
    
    Write-Host "✅ Linting configuration created" -ForegroundColor Green
}

# Create Git configuration
function New-GitConfig {
    Write-Host "⚙️  Creating Git configuration..." -ForegroundColor Yellow
    
    $gitignore = @"
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist/
release/
build/

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# nyc test coverage
.nyc_output/

# Electron
app/dist/
app/build/
"@
    
    $gitignore | Set-Content -Path ".gitignore" -Encoding UTF8
    Write-Host "✅ Git configuration created" -ForegroundColor Green
}

# Create README
function New-ReadmeFile {
    Write-Host "📚 Creating README..." -ForegroundColor Yellow
    
    $readme = @"
# NEXUS - Quick Start Guide

## Development Setup

### Prerequisites
- Node.js 18+ 
- npm 9+
- Git (recommended)

### Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   # Using provided script (recommended)
   ./scripts/dev-server.sh        # Linux/macOS
   .\scripts\dev-server.ps1       # Windows PowerShell
   
   # Or directly with npm
   npm run dev
   ```

3. **Build for production:**
   ```bash
   # Using provided script (recommended)
   ./scripts/build-prod.sh        # Linux/macOS
   .\scripts\build-prod.ps1       # Windows PowerShell
   
   # Or directly with npm
   npm run build
   npm run dist
   ```

### Available Scripts

- ``npm run dev`` - Start development server
- ``npm run build`` - Build for production
- ``npm run dist`` - Package for distribution
- ``npm test`` - Run tests
- ``npm run lint`` - Lint code
- ``npm run format`` - Format code

### Project Structure

```
src/
├── main/           # Electron main process
├── renderer/       # React frontend
├── preload/        # Preload scripts
└── shared/         # Shared types and utilities

scripts/            # Build and utility scripts
assets/             # Icons, images, etc.
tests/              # Test files
```

### Next Steps

Follow the implementation plan in ``IMPLEMENTATION_PLAN.md`` to build out the complete NEXUS application.
"@
    
    $readme | Set-Content -Path "SETUP_README.md" -Encoding UTF8
    Write-Host "✅ README created" -ForegroundColor Green
}

# Main execution with error handling
$startTime = Get-Date

try {
    Test-Prerequisites
    Initialize-PackageJson
    New-ProjectStructure
    Install-Dependencies
    New-TypeScriptConfig
    New-ViteConfig
    New-TailwindConfig
    New-InitialFiles
    New-LintingConfig
    New-GitConfig
    New-ReadmeFile
    
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    Write-Host "`n🎉 NEXUS project setup completed successfully!" -ForegroundColor Green
    Write-Host "Setup time: $([math]::Round($duration, 2))s" -ForegroundColor Blue
    Write-Host "`nNext steps:" -ForegroundColor Yellow
    Write-Host "1. cd into your project directory" -ForegroundColor Blue
    Write-Host "2. Run .\scripts\dev-server.ps1 to start development" -ForegroundColor Blue
    Write-Host "3. Follow IMPLEMENTATION_PLAN.md for detailed development steps" -ForegroundColor Blue
}
catch {
    Write-Host "❌ Setup failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    # Cleanup if needed
    Write-Host "`n✅ Setup process completed" -ForegroundColor Green
} 