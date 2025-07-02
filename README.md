# NEXUS

**A Modern MCP-First Desktop Application for AI Interactions**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-28.0+-green.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.0+-blue.svg)](https://reactjs.org/)
[![MCP](https://img.shields.io/badge/MCP-Enabled-purple.svg)](https://modelcontextprotocol.io/)

---

## Overview

NEXUS is a modern desktop application that provides a seamless interface for managing Model Context Protocol (MCP) servers and interacting with Large Language Models. Built with Electron, React, and TypeScript, it offers a professional user experience for both local and cloud AI providers.

**Current Status:** Post-MVP development - Core MCP functionality complete, now implementing advanced features including multiple chat sessions/tabs.

🎯 **NEXUS has successfully completed its MVP phase** with full MCP integration, multi-LLM support, and a professional chat interface. We're now expanding into advanced productivity features to transform NEXUS into a comprehensive AI interaction platform.

### Key Features

- **Multi-LLM Support** - Ollama (local) and OpenRouter (cloud) with real-time model switching
- **Advanced MCP Integration** - Full protocol support with tool execution and resource management
- **Professional Chat Interface** - Markdown rendering, syntax highlighting, and message persistence
- **Dashboard View** - Overview of system status, MCP servers, and recent activity
- **Comprehensive Security** - Permission system with risk assessment and user approval workflows
- **Configuration Management** - Visual forms, validation, and automatic backup
- **Modern UI** - Dark/light themes with responsive design and smooth animations
- **Cross-Platform Scripts** - Both .sh (bash/zsh) and .ps1 (PowerShell) versions for all automation

---

## Quick Start

### Prerequisites
- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- **OS**: Windows 10+, macOS 10.15+, or Linux

### Installation

```bash
# Clone and install
git clone https://github.com/galatti/Nexus.git
cd Nexus
npm install

# Start the application
npm run dev
```

The application launches automatically with hot reload enabled.

### First-Time Setup

1. **Configure LLM Provider** - Go to Settings → LLM Settings
   - **Ollama**: Automatically detects local installation
   - **OpenRouter**: Requires API key configuration

2. **Set Up MCP Servers** - Go to Settings → MCP Servers
   - Configure connection parameters
   - Test connections before enabling

3. **Start Chatting** - Switch between Dashboard and Chat views to begin conversations

---

## Features

### Chat Interface

- **Markdown Rendering** - Full GitHub Flavored Markdown support
- **Syntax Highlighting** - 200+ programming languages via Prism.js
- **Message History** - Persistent across application restarts
- **Tool Execution** - Visual indicators for MCP tool usage
- **Slash Commands** - Execute MCP prompts with `/` prefix
- **Copy/Clear** - Message-level and full history operations
- **Permission Prompts** - User approval required for tool execution
- **Progress Tracking** - Real-time updates for long-running operations
- **Error Handling** - Graceful degradation with helpful error messages

### Dashboard View

- **System Status** - Overview of LLM providers and MCP server health
- **Server Management** - Quick access to MCP server controls
- **Recent Activity** - History of tool executions and interactions
- **Performance Metrics** - Connection status and response times

### LLM Provider Support

**Ollama (Local)**
- Auto-detection of local Ollama installation
- Model management with download status
- Connection health monitoring
- Zero configuration when Ollama is running

**OpenRouter (Cloud)**
- Full API integration with proper headers
- 100+ models with search and filtering
- Credit tracking and usage monitoring
- Automatic rate limiting handling

**Multi-Provider Features**
- Hot switching between providers
- Configuration persistence across sessions
- Connection testing and validation

### MCP Server Management

**Supported Server Types**
- Support for any MCP-compliant server

**Management Features**
- Visual configuration with form-based setup
- Real-time connection health monitoring
- Granular tool-level permissions

**Tool Execution**
- Automatic risk assessment (low/medium/high)
- Modal dialogs with detailed permission requests
- Session management (once/session/always permissions)
- Parameter validation before execution

### Settings & Configuration

**Categories**
- **General** - Theme selection and application preferences
- **LLM Settings** - Provider configuration and model selection
- **MCP Servers** - Server management and permissions
- **Permissions** - Global permission policies and security settings

**Features**
- Real-time validation with immediate feedback
- Automatic configuration persistence
- Import/export functionality for backup and restore
- Migration support for configuration format changes

### Security & Permissions

**Permission System**
- Individual approval for each tool execution
- Automatic evaluation of tool danger levels
- Temporary, session, or permanent permission scopes
- Explicit user confirmation with timeout handling

**Security Features**
- Renderer process sandboxing with context isolation
- API keys protected in OS keychain
- Parameter sanitization and type checking
- Logging of all external network requests

### User Interface

**Design System**
- Clean, professional interface with logical organization
- Responsive design for different window sizes
- Keyboard navigation and accessibility support
- Loading states, progress indicators, and status messages

**Theme Support**
- Professional light color scheme
- Modern dark color scheme with proper contrast
- Automatic system preference detection
- Smooth animated theme transitions

---

## 📋 **Post-MVP Development**

### Multiple Chat Sessions & Advanced Organization

NEXUS is actively implementing a comprehensive chat session management system that incorporates the best patterns from leading AI platforms (ChatGPT, Claude, Gemini). This includes:

- **Tabbed interface** with Chrome-like session management
- **Project workspaces** for organizing related conversations  
- **Advanced search & filtering** across all sessions
- **Session branching & threading** for complex workflows
- **Smart categorization** with AI-powered topic detection

📖 **Full Implementation Details:** See [CHAT_SESSIONS_IMPLEMENTATION.md](CHAT_SESSIONS_IMPLEMENTATION.md) for the complete technical specification, UI/UX patterns, and development timeline.

---

## Architecture

### Technology Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Electron 28 + Node.js
- **MCP**: @modelcontextprotocol/sdk v0.5.0
- **Build**: Vite + ESLint + Prettier
- **State**: Zustand + React Context + Local Storage
- **Testing**: Vitest + @testing-library/react

### Project Structure
```
src/
├── main/                 # Electron Main Process
│   ├── config/          # Configuration management
│   ├── llm/             # LLM provider implementations
│   ├── mcp/             # MCP server management
│   └── permissions/     # Security and permissions
├── renderer/            # React Frontend
│   ├── components/      # UI components
│   │   ├── Chat/        # Chat interface components
│   │   ├── Dashboard/   # Dashboard view components
│   │   ├── Layout/      # Application layout components
│   │   ├── MCP/         # MCP-specific components
│   │   ├── Permissions/ # Permission management UI
│   │   └── Settings/    # Settings and configuration UI
│   ├── context/         # React contexts
│   └── styles/          # Styling
└── preload/             # IPC bridge

scripts/                 # Automation Scripts
├── *.sh                # Bash/Zsh scripts (Linux/macOS)
├── *.ps1               # PowerShell scripts (Windows)
├── build-prod.*        # Production build automation
├── dev-server.*        # Development server management
├── kill-port.*         # Port cleanup utilities
├── mcp-verify.*        # MCP server testing and validation
├── setup-project.*     # Project initialization
└── test-mcp-everything.* # Comprehensive MCP testing
```

---

## Development

### Available Scripts

**Core Development**
```bash
# Development
npm run dev              # Start development server with hot reload

# Building
npm run build            # Build for production
npm run build:renderer   # Build React frontend
npm run build:main       # Build Electron main process

# Testing
npm test                 # Run all tests with Vitest
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate test coverage report

# Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues automatically
npm run type-check       # TypeScript compilation check
npm run clean            # Clean dist directory

# Distribution
npm run dist             # Build distribution packages
npm run dist:dir         # Build to directory (no packaging)
```

**Platform-Specific Scripts**

The `scripts/` directory contains automation scripts with both .sh and .ps1 versions:

```bash
# Project Setup (run once after clone)
./scripts/setup-project.sh          # Linux/macOS
./scripts/setup-project.ps1         # Windows

# Development Server Management
./scripts/dev-server.sh              # Linux/macOS
./scripts/dev-server.ps1             # Windows

# Production Builds
./scripts/build-prod.sh              # Linux/macOS
./scripts/build-prod.ps1             # Windows

# MCP Server Testing
./scripts/mcp-verify.sh              # Linux/macOS
./scripts/mcp-verify.ps1             # Windows
./scripts/test-mcp-everything.sh     # Linux/macOS
./scripts/test-mcp-everything.ps1    # Windows

# Utilities
./scripts/kill-port.sh 5173          # Linux/macOS
./scripts/kill-port.ps1 5173         # Windows
```

### Development Features
- Hot reload with instant updates
- Full TypeScript type safety
- Automated code formatting and linting
- Complete debugging support with source maps
- Comprehensive testing with Vitest
- Test coverage reporting
- Cross-platform script automation

### Testing

The project uses **Vitest** as the test runner with comprehensive coverage:

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode during development
npm run test:watch

# Run specific test pattern
npx vitest run --grep "ConnectionManager"
```

**Current Test Coverage:**
- **MCP Connection Manager**: 96.11% (highly tested core functionality)
- **UI Components**: 50-80% (key components well tested)
- **Integration Tests**: Full end-to-end MCP server lifecycle testing

**Test Framework:**
- **Test Runner**: Vitest (fast, modern testing framework)
- **UI Testing**: @testing-library/react with Jest DOM matchers
- **Mocking**: Vitest mocks with comprehensive Electron API simulation
- **Coverage**: V8 coverage reporting

See [TESTING.md](TESTING.md) for detailed testing information.

### Automation Scripts

The project includes comprehensive automation scripts for all platforms. See [SCRIPTS.md](SCRIPTS.md) for detailed documentation of available scripts including:
- Project setup and initialization
- Development server management
- Production builds and distribution
- MCP server testing and validation
- Utility scripts for port management and cleanup

---

## Known Issues

### WSL Compatibility
- **Hardware Acceleration**: Disabled in WSL environments for compatibility
- **Rendering**: Uses software rendering with additional compatibility flags
- **Performance**: May be slower than native Linux/Windows installations

### Broken pipe (EPIPE) warnings on shutdown

When an MCP server launched via **STDIO transport** is stopped, the child process can sometimes close its side of the pipe before Electron finishes flushing buffered data.  This manifests as repeated log lines similar to:

```
Error: write EPIPE
    at ChildProcess.target._send (node:internal/child_process.js:811:25)
```

These EPIPE messages are harmless – the server is already shutting down – and are swallowed by Nexus at runtime (see `ConnectionManager.ts -> swallowEpipe`).  No user action is required.

---

## Deployment

### Production Build
```bash
npm run build
```

### Distribution
- Cross-platform support (Windows, macOS, Linux)
- Code signing infrastructure ready
- Auto-updater framework implemented
---

## Development Roadmap

### 🚧 **Currently In Development**
- **Multiple chat sessions/tabs** - Full implementation plan available in [CHAT_SESSIONS_IMPLEMENTATION.md](CHAT_SESSIONS_IMPLEMENTATION.md)
- **Project/workspace management** - Contextual workspaces for related conversations
- **Advanced session organization** - Smart categorization, search, and filtering

### 🔮 **Future Features**
- MCP marketplace with one-click installation
- Auto-discovery of local MCP servers
- Localization and internationalization
- Advanced debugging and analytics
- Plugin system for custom integrations
- Mobile companion app
- Team collaboration features
---

## ⚠️ Important Disclaimers

### User Responsibility
**NEXUS is provided "AS IS" without warranty of any kind.** Users are solely responsible for:
- **Configuration and Usage**: Proper setup and operation of the application
- **Third-Party Services**: API keys, costs, and compliance with provider terms
- **MCP Server Security**: Vetting and securing any installed MCP servers
- **Data Protection**: Backing up and securing their data and configurations
- **System Security**: Maintaining secure computing environments

### Liability Limitations
- **No Warranty**: This software is provided without warranties of merchantability or fitness
- **User Risk**: Use at your own risk - we are not responsible for data loss, security breaches, or system damage
- **Third-Party Services**: We are not responsible for issues with Ollama, OpenRouter, or other integrated services
- **Financial Responsibility**: Users are responsible for any costs incurred through API usage

### Security Notice
- **Tool Execution**: MCP tools can perform system operations - review permissions carefully
- **API Keys**: Secure your API keys and never share them
- **File Access**: MCP servers may access your file system - use appropriate restrictions
- **Network Requests**: Third-party servers may make external network requests

**See [DISCLAIMER.md](DISCLAIMER.md) and [TERMS_OF_USE.md](TERMS_OF_USE.md) for complete legal terms.**

## Community

We are committed to providing a welcoming and inclusive environment for all contributors. Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating in the project.

---

## License

This project is licensed under the MIT License with additional disclaimers - see the [LICENSE](LICENSE) file for details.

---

## Support

For questions, issues, or contributions:
- **Issues**: GitHub Issues tab
- **Discussions**: GitHub Discussions

**Note**: Support is provided on a best-effort basis. Users are responsible for troubleshooting their own configurations and environments.
