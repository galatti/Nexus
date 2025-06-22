# NEXUS MVP 🚀

**A Modern MCP-First Desktop Application Built with Electron + React + TypeScript**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-28.0+-green.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.0+-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0+-purple.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0+-cyan.svg)](https://tailwindcss.com/)

---

## 🎯 **Current Status: Phase 3 Complete ✅**

NEXUS MVP is a fully functional desktop application that provides a modern interface for interacting with MCP (Model Context Protocol) servers and LLM providers. All core features have been implemented and tested.

### ✨ **Key Features**

- 🖥️ **Modern Desktop UI** - Professional Electron application with native window controls
- 🤖 **Multi-LLM Support** - Ollama (local) and OpenRouter (cloud) integration
- 🔌 **MCP Integration** - Built-in server templates and tool execution
- 🎨 **Beautiful Interface** - Dark/light themes with Tailwind CSS
- 🛡️ **Security First** - Comprehensive permission system and risk assessment
- ⚡ **High Performance** - Vite-powered development with hot reload
- 🔧 **Developer Friendly** - TypeScript throughout with comprehensive tooling

---

## 📋 **What's Implemented**

### 🚀 **Phase 1: Core Infrastructure ✅**
- ✅ **Electron Application**: Cross-platform desktop app with secure architecture
- ✅ **TypeScript Setup**: Strict typing throughout main and renderer processes
- ✅ **Vite Build System**: Fast development with hot module replacement
- ✅ **React UI Foundation**: Modern component architecture with Tailwind CSS
- ✅ **Theme System**: Dark, light, and system theme support
- ✅ **Development Scripts**: Cross-platform build and development tools

### 🚀 **Phase 2: Essential Features ✅**
- ✅ **Advanced Chat Interface**: 
  - GitHub Flavored Markdown rendering
  - Syntax highlighting for 200+ languages
  - Message persistence and history
  - Copy functionality and auto-scroll
  - Professional loading states
  
- ✅ **LLM Provider Integration**:
  - **Ollama Provider**: Local model support with auto-detection
  - **OpenRouter Provider**: Cloud API with credit tracking
  - Model management and health monitoring
  - Streaming architecture (ready for implementation)
  
- ✅ **Settings Management**:
  - Professional tabbed interface
  - Real-time configuration updates
  - Data validation and error handling
  - Import/export capabilities

### 🚀 **Phase 3: MCP Integration ✅**
- ✅ **Server Templates System**:
  - **Filesystem Template**: Secure file system access
  - **Web Search Template**: Brave Search API integration
  - **Weather Template**: OpenWeatherMap integration
  - **Pomodoro Template**: Built-in productivity timer
  
- ✅ **Permission Management**:
  - Risk assessment (low/medium/high)
  - User approval workflows with timeouts
  - Granular permission scopes
  - Security-first architecture
  
- ✅ **Professional UI**:
  - Server template selection interface
  - Configuration forms with validation
  - Installation status indicators
  - Template categorization

- ✅ **Build System**:
  - Cross-platform MCP server compilation
  - TypeScript to JavaScript transpilation
  - Automated build scripts (.sh/.ps1)

---

## 🚀 **Quick Start**

### Prerequisites
- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- **Git**
- **OS**: Windows 10+, macOS 10.15+, or Linux

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Nexus
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

The application will launch automatically with:
- **Vite Dev Server**: http://localhost:5173
- **Electron App**: Desktop application window
- **Hot Reload**: Automatic refresh on code changes

### Production Build

```bash
# Build for production
npm run build

# Package for distribution (if configured)
npm run dist
```

---

## 🏗️ **Architecture Overview**

### Project Structure
```
src/
├── main/                   # Electron Main Process
│   ├── config/            # Configuration management
│   ├── llm/               # LLM provider integrations
│   ├── mcp/               # MCP server management
│   │   ├── servers/       # Custom MCP servers
│   │   └── templates/     # Server template system
│   ├── permissions/       # Security and permissions
│   └── utils/            # Shared utilities
├── renderer/              # React Frontend
│   ├── components/        # UI components
│   │   ├── Chat/         # Chat interface
│   │   ├── Layout/       # Application layout
│   │   ├── MCP/          # MCP management UI
│   │   └── Settings/     # Settings interface
│   ├── context/          # React contexts
│   └── styles/           # CSS and styling
├── preload/              # Electron preload scripts
└── shared/               # Shared types and utilities
```

### Technology Stack

**Frontend**
- **React 18** - Modern UI library with hooks
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Beautiful icon library
- **React Markdown** - Markdown rendering
- **Prism.js** - Syntax highlighting

**Backend**
- **Electron 28** - Desktop application framework
- **Node.js** - Runtime environment
- **Winston** - Structured logging
- **MCP SDK** - Model Context Protocol integration

**Development**
- **Vite** - Fast build tool and dev server
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Jest** - Testing framework

---

## 🎮 **Usage Guide**

### First Launch
1. **Start the application** using `npm run dev`
2. **Configure LLM provider** in Settings → LLM Settings
3. **Set up MCP servers** in Settings → Server Templates
4. **Start chatting** in the main chat interface

### LLM Configuration

**Ollama (Local)**
- Install Ollama on your system
- Models are auto-detected
- No API keys required

**OpenRouter (Cloud)**
- Get API key from OpenRouter
- Configure in Settings → LLM Settings
- Monitor credit usage

### MCP Server Templates

**Filesystem Template**
- Secure file system access
- Configure allowed directories
- Read, write, and search files

**Web Search Template**
- Brave Search API integration
- Configure API key
- Real-time web search capabilities

**Weather Template**
- OpenWeatherMap integration
- Get current weather and forecasts
- Location-based queries

**Pomodoro Template**
- Built-in productivity timer
- Start, pause, and reset sessions
- Integrated with chat interface

### Permissions System
- **Automatic Risk Assessment**: Low, medium, high risk categorization
- **User Approval**: Explicit approval for tool execution
- **Permission Scopes**: Once, session, or always
- **Timeout Handling**: Automatic denial after timeout

---

## 🛠️ **Development**

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run dev:vite         # Start Vite dev server only
npm run dev:electron     # Start Electron only

# Building
npm run build            # Build for production
npm run build:renderer   # Build React frontend
npm run build:main       # Build Electron main process

# Custom MCP Servers
npm run build:pomodoro    # Build Pomodoro server

# Linting and Testing
npm run lint             # Run ESLint
npm run test             # Run Jest tests
npm run type-check       # TypeScript compilation check
```

### Cross-Platform Scripts

Each script is available in both formats:
- **Bash/Zsh**: `.sh` files for macOS/Linux
- **PowerShell**: `.ps1` files for Windows

Example:
```bash
# macOS/Linux
./scripts/dev-server.sh

# Windows
./scripts/dev-server.ps1
```

### Configuration

**Environment Variables**
- Development environment auto-detected
- Configuration stored in user data directory
- Settings persist between sessions

**Logging**
- Winston-based structured logging
- File rotation and size limits
- Development vs production log levels

---

## 🔧 **Customization**

### Adding New LLM Providers

1. Create provider class extending `BaseProvider`
2. Implement required methods (`initialize`, `generateResponse`, etc.)
3. Register in `LlmManager.ts`
4. Add UI configuration in Settings

### Creating Custom MCP Servers

1. Use `PomodoroServer.ts` as template
2. Implement MCP protocol methods
3. Add build script for compilation
4. Create template class for UI integration

### Theme Customization

Themes are defined in `ThemeContext.tsx`:
- **Light Theme**: Professional light color scheme
- **Dark Theme**: Modern dark color scheme  
- **System Theme**: Follows OS preference

Customize colors in `tailwind.config.js`.

---

## 🧪 **Testing**

### Running Tests
```bash
npm run test              # Run all tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run with coverage report
```

### Test Structure
- **Unit Tests**: Component and utility testing
- **Integration Tests**: Cross-component functionality
- **E2E Tests**: Full application workflows (planned)

---

## 🚀 **Deployment**

### Production Build
```bash
npm run build
```

### Distribution Package
```bash
npm run dist  # (if electron-builder configured)
```

### Platform Support
- **Windows**: x64, ARM64
- **macOS**: x64, ARM64 (Apple Silicon)
- **Linux**: x64, ARM64

---

## 🔒 **Security**

### Security Features
- **Context Isolation**: Renderer process sandboxing
- **Node Integration Disabled**: Prevents direct Node.js access
- **Content Security Policy**: Strict CSP headers
- **Permission System**: User approval for tool execution
- **Risk Assessment**: Automatic security evaluation

### Best Practices
- All external APIs require explicit user configuration
- File system access is sandboxed and permission-based
- Network requests are logged and monitored
- User data is encrypted and stored securely

---

## 📚 **API Reference**

### IPC API
The preload script exposes these APIs to the renderer:

```typescript
window.electronAPI = {
  // Configuration
  getConfig: () => Promise<Config>
  updateConfig: (updates: Partial<Config>) => Promise<void>
  
  // LLM
  generateResponse: (message: string) => Promise<string>
  getAvailableModels: () => Promise<Model[]>
  
  // MCP
  getServerTemplates: () => Promise<ServerTemplate[]>
  installTemplate: (templateId: string, config: any) => Promise<void>
  
  // Permissions
  requestPermission: (request: PermissionRequest) => Promise<boolean>
}
```

### Configuration Schema
```typescript
interface Config {
  theme: 'light' | 'dark' | 'system'
  language: string
  llm: {
    provider: 'ollama' | 'openrouter'
    apiKey?: string
    selectedModel?: string
  }
  mcp: {
    servers: McpServerConfig[]
  }
}
```

---

## 🤝 **Contributing**

### Development Workflow
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes with proper TypeScript types
4. Add tests for new functionality
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open Pull Request

### Code Standards
- **TypeScript**: Strict mode with proper typing
- **ESLint**: Follow configured rules
- **Prettier**: Automatic code formatting
- **Conventional Commits**: Use conventional commit messages

### Testing Requirements
- Unit tests for new components
- Integration tests for cross-component features
- E2E tests for critical user workflows

---

## 📊 **Project Status**

### Completed Phases
- ✅ **Phase 1**: Core Infrastructure (100%)
- ✅ **Phase 2**: Essential Features (100%)
- ✅ **Phase 3**: MCP Integration (100%)

### Next Phase
- 🔄 **Phase 4**: Advanced Features (Planning)
  - Advanced chat capabilities
  - Plugin system
  - Performance optimization
  - Advanced debugging tools

### Statistics
- **Components**: 15+ React components
- **TypeScript Files**: 25+ source files
- **Lines of Code**: 3000+ lines
- **Build Size**: ~17MB (optimized)
- **Supported Platforms**: Windows, macOS, Linux

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 **Acknowledgments**

- **Electron Team** - Amazing desktop application framework
- **React Team** - Excellent UI library
- **Vite Team** - Lightning-fast build tool
- **Tailwind CSS** - Beautiful utility-first CSS framework
- **MCP Protocol** - Model Context Protocol specification
- **TypeScript Team** - Type-safe JavaScript development

---

## 📞 **Support**

For questions, issues, or contributions:
- **Issues**: GitHub Issues tab
- **Discussions**: GitHub Discussions
- **Documentation**: See `/docs` directory (when available)

---

**Built with ❤️ using modern web technologies** 