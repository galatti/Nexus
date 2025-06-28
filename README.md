# NEXUS

**A Modern MCP-First Desktop Application for AI Interactions**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-28.0+-green.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.0+-blue.svg)](https://reactjs.org/)
[![MCP](https://img.shields.io/badge/MCP-Enabled-purple.svg)](https://modelcontextprotocol.io/)

---

## Overview

NEXUS is a modern desktop application that provides a seamless interface for managing Model Context Protocol (MCP) servers and interacting with Large Language Models. Built with Electron, React, and TypeScript, it offers a professional user experience for both local and cloud AI providers.

**Current Status:** Active development with core MCP functionality fully implemented and tested.

### Key Features

- **Multi-LLM Support** - Ollama (local) and OpenRouter (cloud) with real-time model switching
- **Advanced MCP Integration** - Full protocol support with tool execution and resource management
- **Professional Chat Interface** - Markdown rendering, syntax highlighting, and message persistence
- **Comprehensive Security** - Permission system with risk assessment and user approval workflows
- **Configuration Management** - Visual forms, validation, and automatic backup
- **Modern UI** - Dark/light themes with responsive design and smooth animations

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
   - Choose from available server templates
   - Configure connection parameters
   - Test connections before enabling

3. **Start Chatting** - Return to main interface and begin conversations

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
- **Filesystem Server** - Secure file system access with permission controls
- **Web Search Server** - Brave Search API integration for real-time web queries
- **Weather Server** - OpenWeatherMap integration for weather data
- **Custom Servers** - Support for any MCP-compliant server

**Management Features**
- Visual configuration with form-based setup
- Real-time connection health monitoring
- Granular tool-level permissions
- Pre-configured server templates

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

## Architecture

### Technology Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Electron 28 + Node.js
- **MCP**: @modelcontextprotocol/sdk v0.5.0
- **Build**: Vite + ESLint + Prettier
- **State**: React Context + Local Storage

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
│   ├── context/         # React contexts
│   └── styles/          # Styling
└── preload/             # IPC bridge
```

---

## Development

### Available Scripts
```bash
# Development
npm run dev              # Start development server with hot reload

# Building
npm run build            # Build for production
npm run build:renderer   # Build React frontend
npm run build:main       # Build Electron main process

# Testing
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate test coverage report

# Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues automatically
npm run type-check       # TypeScript compilation check
```

### Development Features
- Hot reload with instant updates
- Full TypeScript type safety
- Automated code formatting and linting
- Complete debugging support with source maps
- Comprehensive testing with Vitest
- Test coverage reporting

### Testing
The project includes comprehensive unit and integration tests:

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode during development
npm run test:watch
```

**Current Test Coverage:**
- **MCP Connection Manager**: 96.11% (highly tested core functionality)
- **UI Components**: 50-80% (key components well tested)
- **Integration Tests**: Full end-to-end MCP server lifecycle testing

See [TESTING.md](TESTING.md) for detailed testing information.

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

## Future Roadmap (Post-MVP)

Features explicitly excluded from MVP but planned for future versions:
- Multiple chat sessions/tabs
- MCP marketplace with one-click installation
- Auto-discovery of local MCP servers
- Workspace/project management
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

---