# NEXUS

**A Modern MCP-First Desktop Application for AI Interactions**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-28.0+-green.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.0+-blue.svg)](https://reactjs.org/)
[![MCP](https://img.shields.io/badge/MCP-Enabled-purple.svg)](https://modelcontextprotocol.io/)
[![Test Coverage](https://img.shields.io/badge/Coverage-80%25+-brightgreen.svg)](./coverage/index.html)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-blue.svg)](https://github.com/galatti/Nexus/actions)
[![Quality Gate](https://img.shields.io/badge/Quality-Passing-brightgreen.svg)](./test-results/)

---

## Overview

NEXUS is a modern desktop application that provides a seamless interface for managing Model Context Protocol (MCP) servers and interacting with Large Language Models. Built with Electron, React, and TypeScript, it offers a professional user experience for both local and cloud AI providers.

**Current Status:** Post-MVP – Core MCP + multi-LLM complete with **comprehensive test coverage** and **automated CI/CD pipeline**. Recent work introduced **persistent multi-chat**, a session sidebar, and production-ready quality assurance. Next iterations will layer optional power-user features on top of this solid, well-tested foundation.

🎯 **NEXUS has successfully completed its MVP phase** with full MCP integration, multi-LLM support, professional chat interface, and **enterprise-grade testing & automation**. We're now expanding into advanced productivity features with confidence in our robust quality assurance foundation.

### Key Features

- **Multi-LLM Support** - Ollama (local) and OpenRouter (cloud) with real-time model switching
- **Advanced MCP Integration** - Full protocol support with tool execution and resource management
- **Professional Chat Interface** - Markdown rendering, syntax highlighting, and message persistence
- **Dashboard View** - Overview of system status, MCP servers, and recent activity
- **Comprehensive Security** - Permission system with risk assessment and user approval workflows
- **Configuration Management** - Visual forms, validation, and automatic backup
- **Modern UI** - Dark/light themes with responsive design and smooth animations
- **Cross-Platform Scripts** - Both .sh (bash/zsh) and .ps1 (PowerShell) versions for all automation
- **Enterprise Testing** - 80%+ test coverage with automated CI/CD pipeline
- **Quality Assurance** - Comprehensive linting, type checking, and security scanning

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

### Multiple Chat Sessions (Implemented)

Nexus now lets you create and switch between unlimited chat sessions via a dedicated sidebar:

* **＋ New Chat** instantly starts a fresh conversation.
* Session titles auto-rename to the first user prompt.
* Pinned, rename and delete controls are available via a hover menu.
* All sessions persist to local storage and can be cleared from Settings → General → *Clear Chat History*.

Advanced workspace / project features remain on the roadmap; see [CHAT_SESSIONS_IMPLEMENTATION.md](CHAT_SESSIONS_IMPLEMENTATION.md) for the simplified next steps.

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

### Testing & Quality Assurance

The project maintains **enterprise-grade testing standards** with comprehensive coverage and automated quality gates:

```bash
# Run all tests
npm test

# Run tests with coverage report (enforces 80%+ threshold)
npm run test:coverage

# Run tests in watch mode during development
npm run test:watch

# Run CI test suite (includes coverage + quality checks)
npm run test:ci
```

**🎯 Test Coverage Summary:**
- **Overall Coverage**: 80%+ maintained (lines, functions, statements)
- **Branch Coverage**: 75%+ maintained
- **Critical Components**: 90%+ coverage for core business logic
- **Integration Tests**: Full end-to-end workflows and IPC communication

**📊 Test Categories:**
- **Unit Tests**: 272+ tests covering individual components
- **Integration Tests**: Cross-component workflows and main process IPC
- **Provider Tests**: Comprehensive LLM provider implementations (Ollama, OpenRouter)
- **Security Tests**: Permission system, risk assessment, and argument validation
- **Error Handling**: Network failures, timeouts, edge cases, and recovery scenarios

**🛠️ Test Infrastructure:**
- **Test Runner**: Vitest with jsdom environment
- **UI Testing**: @testing-library/react with Jest DOM matchers
- **Mocking**: Advanced mocking for Electron APIs, network requests, and external dependencies
- **Coverage**: V8 coverage with HTML reports and threshold enforcement
- **CI/CD**: Automated testing on multiple Node.js versions and platforms

**📋 Quality Gates:**
- **Linting**: ESLint with TypeScript support
- **Type Safety**: Strict TypeScript compilation
- **Security**: npm audit and dependency scanning
- **Performance**: Bundle size monitoring and optimization
- **Code Quality**: Automated PR checks and commit validation

See [TESTING.md](TESTING.md) for detailed testing information and [CI/CD Pipeline Documentation](#cicd-pipeline) below.

### Automation Scripts

The project includes comprehensive automation scripts for all platforms. See [SCRIPTS.md](SCRIPTS.md) for detailed documentation of available scripts including:
- Project setup and initialization
- Development server management
- Production builds and distribution
- MCP server testing and validation
- Utility scripts for port management and cleanup

## CI/CD Pipeline

NEXUS includes a comprehensive **GitHub Actions-based CI/CD pipeline** ensuring code quality and reliable releases:

### 🔄 Automated Workflows

**Pull Request Checks** (`.github/workflows/pr-check.yml`)
- **Changed File Analysis**: Targets testing and linting to modified files
- **Security Scanning**: npm audit and vulnerability checking
- **Bundle Size Monitoring**: Prevents bloated distributions
- **Commit Validation**: Enforces conventional commit messages
- **Coverage Reporting**: Automated PR comments with test coverage results

**Main Test Suite** (`.github/workflows/test.yml`)
- **Multi-Platform Testing**: Ubuntu, Windows, macOS
- **Multi-Node.js Versions**: Node 18 and 20 LTS
- **Comprehensive Checks**: Linting, type checking, full test suite
- **Coverage Enforcement**: 80%+ threshold requirement
- **Artifact Generation**: Coverage reports and test results

**Release Pipeline** (`.github/workflows/release.yml`)
- **Quality Gates**: Full test suite must pass before release
- **Multi-Platform Builds**: Automated distribution packaging
- **GitHub Releases**: Automatic release creation with artifacts
- **Version Management**: Semantic versioning with automated changelogs

### 🛡️ Quality Gates

**Pre-Merge Requirements:**
- All tests must pass with 80%+ coverage
- ESLint must pass with zero violations
- TypeScript compilation must succeed
- Security audit must show no high-severity vulnerabilities
- Bundle size must remain within acceptable limits

**Release Requirements:**
- Coverage threshold must be maintained (80%+)
- All supported platforms must build successfully
- Integration tests must pass on all target environments
- Security scanning must pass

### 🎯 Development Workflow

1. **Feature Development**: Create feature branch with descriptive name
2. **Commit Standards**: Use conventional commits (feat/fix/docs/etc.)
3. **Testing**: Ensure tests pass locally before pushing
4. **Pull Request**: Automated checks run on PR creation
5. **Code Review**: Manual review required for merge approval
6. **Merge**: Automated testing and quality gates on main branch
7. **Release**: Tag-based automated releases with multi-platform builds

### 📊 Monitoring & Reporting

- **Coverage Reports**: HTML reports generated and stored as artifacts
- **Test Results**: JUnit XML format for CI integration
- **Security Reports**: Automated vulnerability scanning
- **Performance Metrics**: Bundle size tracking and optimization alerts

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
