#!/bin/bash
set -e

# NEXUS Project Setup Script
# This script initializes the project structure and installs dependencies

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project information
PROJECT_NAME="nexus-mvp"
PROJECT_DESCRIPTION="NEXUS - MCP-first desktop application built with Electron"

echo -e "${GREEN}🚀 Setting up NEXUS Project${NC}"

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
        echo -e "${BLUE}💡 Download from: https://nodejs.org/${NC}"
        exit 1
    fi
    
    node_version=$(node --version | sed 's/v//')
    major_version=$(echo $node_version | cut -d'.' -f1)
    
    if [ "$major_version" -lt 18 ]; then
        echo -e "${RED}❌ Node.js 18+ is required. Current version: v$node_version${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Node.js version: v$node_version${NC}"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm is not installed${NC}"
        exit 1
    fi
    
    npm_version=$(npm --version)
    echo -e "${GREEN}✅ npm version: $npm_version${NC}"
    
    # Check git
    if ! command -v git &> /dev/null; then
        echo -e "${YELLOW}⚠️  Git is not installed. Some features may not work.${NC}"
    else
        git_version=$(git --version)
        echo -e "${GREEN}✅ $git_version${NC}"
    fi
}

# Initialize package.json
init_package_json() {
    echo -e "${YELLOW}📦 Initializing package.json...${NC}"
    
    cat > package.json << EOF
{
  "name": "$PROJECT_NAME",
  "version": "0.1.0",
  "description": "$PROJECT_DESCRIPTION",
  "main": "dist/main/main.js",
  "scripts": {
    "dev": "concurrently \"npm run dev:renderer\" \"npm run dev:main\"",
    "dev:renderer": "vite",
    "dev:main": "tsc -p tsconfig.main.json && electron dist/main/main.js",
    "build": "npm run build:renderer && npm run build:main",
    "build:renderer": "vite build",
    "build:main": "tsc -p tsconfig.main.json",
    "dist": "electron-builder",
    "dist:win": "electron-builder --win",
    "dist:mac": "electron-builder --mac",
    "dist:linux": "electron-builder --linux",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src --ext .ts,.tsx",
    "format": "prettier --write src/**/*.{ts,tsx}",
    "clean": "rimraf dist node_modules/.cache"
  },
  "keywords": [
    "electron",
    "mcp",
    "model-context-protocol",
    "desktop",
    "ai",
    "chat"
  ],
  "author": "NEXUS Team",
  "license": "MIT",
  "devDependencies": {},
  "dependencies": {},
  "build": {
    "appId": "com.nexus.mvp",
    "productName": "NEXUS",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "assets/**/*",
      "package.json"
    ],
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "mac": {
      "target": "dmg",
      "icon": "assets/icon.icns"
    },
    "linux": {
      "target": "AppImage",
      "icon": "assets/icon.png"
    }
  }
}
EOF
    
    echo -e "${GREEN}✅ package.json created${NC}"
}

# Create project structure
create_project_structure() {
    echo -e "${YELLOW}📁 Creating project structure...${NC}"
    
    # Main directories
    mkdir -p src/{main,renderer,preload,shared}
    mkdir -p src/renderer/components/{Layout,Chat,Settings}
    mkdir -p src/main/{mcp,llm,config,permissions}
    mkdir -p src/main/mcp/templates
    mkdir -p src/main/llm/providers
    mkdir -p assets
    mkdir -p scripts
    mkdir -p tests
    mkdir -p docs
    
    echo -e "${GREEN}✅ Project structure created${NC}"
}

# Install core dependencies
install_dependencies() {
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    
    # Core dependencies
    npm install \
        electron \
        @modelcontextprotocol/sdk \
        react \
        react-dom \
        zustand \
        react-markdown \
        remark-gfm \
        prismjs
    
    # Development dependencies
    npm install --save-dev \
        @types/node \
        @types/react \
        @types/react-dom \
        @types/prismjs \
        typescript \
        vite \
        @vitejs/plugin-react \
        electron-builder \
        concurrently \
        tailwindcss \
        @tailwindcss/typography \
        autoprefixer \
        postcss \
        eslint \
        @typescript-eslint/eslint-plugin \
        @typescript-eslint/parser \
        prettier \
        jest \
        @testing-library/react \
        @testing-library/jest-dom \
        playwright \
        winston \
        rimraf
    
    echo -e "${GREEN}✅ Dependencies installed${NC}"
}

# Create TypeScript configuration
create_typescript_config() {
    echo -e "${YELLOW}⚙️  Creating TypeScript configuration...${NC}"
    
    # Main tsconfig.json
    cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/main/*": ["src/main/*"],
      "@/renderer/*": ["src/renderer/*"],
      "@/shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/renderer/**/*", "src/shared/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

    # Main process tsconfig
    cat > tsconfig.main.json << 'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "outDir": "dist/main",
    "noEmit": false,
    "jsx": "preserve"
  },
  "include": ["src/main/**/*", "src/preload/**/*", "src/shared/**/*"],
  "exclude": ["src/renderer", "node_modules", "dist"]
}
EOF
    
    echo -e "${GREEN}✅ TypeScript configuration created${NC}"
}

# Create Vite configuration
create_vite_config() {
    echo -e "${YELLOW}⚙️  Creating Vite configuration...${NC}"
    
    cat > vite.config.ts << 'EOF'
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
EOF
    
    echo -e "${GREEN}✅ Vite configuration created${NC}"
}

# Create Tailwind configuration
create_tailwind_config() {
    echo -e "${YELLOW}⚙️  Creating Tailwind CSS configuration...${NC}"
    
    cat > tailwind.config.js << 'EOF'
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
EOF

    cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF
    
    echo -e "${GREEN}✅ Tailwind CSS configuration created${NC}"
}

# Create initial source files
create_initial_files() {
    echo -e "${YELLOW}📝 Creating initial source files...${NC}"
    
    # Main process entry point
    cat > src/main/main.ts << 'EOF'
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
EOF

    # Preload script
    mkdir -p src/preload
    cat > src/preload/preload.ts << 'EOF'
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Add IPC methods here
})
EOF

    # Basic React app
    cat > src/renderer/App.tsx << 'EOF'
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
EOF

    # App CSS with Tailwind
    cat > src/renderer/App.css << 'EOF'
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
EOF

    # Main entry point
    cat > src/renderer/main.tsx << 'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
EOF

    # HTML template
    cat > src/renderer/index.html << 'EOF'
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
EOF
    
    echo -e "${GREEN}✅ Initial source files created${NC}"
}

# Create ESLint and Prettier configuration
create_linting_config() {
    echo -e "${YELLOW}⚙️  Creating linting configuration...${NC}"
    
    cat > .eslintrc.js << 'EOF'
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
EOF

    cat > .prettierrc << 'EOF'
{
  "semi": false,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
EOF
    
    echo -e "${GREEN}✅ Linting configuration created${NC}"
}

# Create Git configuration
create_git_config() {
    echo -e "${YELLOW}⚙️  Creating Git configuration...${NC}"
    
    cat > .gitignore << 'EOF'
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
EOF
    
    echo -e "${GREEN}✅ Git configuration created${NC}"
}

# Create README
create_readme() {
    echo -e "${YELLOW}📚 Creating README...${NC}"
    
    cat > SETUP_README.md << 'EOF'
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

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run dist` - Package for distribution
- `npm test` - Run tests
- `npm run lint` - Lint code
- `npm run format` - Format code

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

Follow the implementation plan in `IMPLEMENTATION_PLAN.md` to build out the complete NEXUS application.
EOF
    
    echo -e "${GREEN}✅ README created${NC}"
}

# Make scripts executable
make_scripts_executable() {
    echo -e "${YELLOW}🔧 Making scripts executable...${NC}"
    
    if [ -f "scripts/dev-server.sh" ]; then
        chmod +x scripts/dev-server.sh
    fi
    
    if [ -f "scripts/build-prod.sh" ]; then
        chmod +x scripts/build-prod.sh
    fi
    
    if [ -f "scripts/setup-project.sh" ]; then
        chmod +x scripts/setup-project.sh
    fi
    
    echo -e "${GREEN}✅ Scripts made executable${NC}"
}

# Main execution
main() {
    local start_time=$(date +%s)
    
    check_prerequisites
    init_package_json
    create_project_structure
    install_dependencies
    create_typescript_config
    create_vite_config
    create_tailwind_config
    create_initial_files
    create_linting_config
    create_git_config
    create_readme
    make_scripts_executable
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo -e "\n${GREEN}🎉 NEXUS project setup completed successfully!${NC}"
    echo -e "${BLUE}Setup time: ${duration}s${NC}"
    echo -e "\n${YELLOW}Next steps:${NC}"
    echo -e "${BLUE}1. cd into your project directory${NC}"
    echo -e "${BLUE}2. Run ./scripts/dev-server.sh to start development${NC}"
    echo -e "${BLUE}3. Follow IMPLEMENTATION_PLAN.md for detailed development steps${NC}"
}

# Execute main function
main "$@" 