# Changelog

All notable changes to the Nexus project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Documentation Updates**
  - Comprehensive scripts documentation in SCRIPTS.md
  - Updated README with accurate implementation details
  - Corrected testing documentation to reflect Vitest usage
  - Enhanced contributing guidelines with cross-platform support
- Persistent multi-chat support with new `SessionSidebar` (create/switch/rename/pin/delete chats).
- Auto-session renaming, session pruning utilities, clear history button.
- Neutral waiting indicator while awaiting LLM responses.

### Changed
- **Test Framework Migration**
  - Fully migrated from Jest to Vitest for better ES module support
  - Removed legacy jest.config.js file
  - Updated all test documentation and examples
- Branding updated from "Nexus MVP" to "Nexus".
- Chat set as default primary tab; Dashboard moved after Chat.
- Removed obsolete MCP server sidebar component.

### Fixed
- **Documentation Accuracy**
  - Corrected state management description (Zustand + React Context)
  - Updated available scripts list to match package.json
  - Fixed test framework references throughout documentation
  - Added known issues section for EPIPE errors and WSL compatibility

### Planned
- Multiple chat sessions/tabs
- MCP marketplace integration
- Auto-discovery of local MCP servers
- Workspace/project management features
- Advanced debugging and analytics
- Plugin system for custom integrations

### MCP Server Shutdown
  - Added graceful shutdown and error-listener logic in `src/main/mcp/ConnectionManager.ts` to prevent Nexus from crashing with `EPIPE: broken pipe` when stopping STDIO servers.  The underlying MCP child process may still print an EPIPE stack-trace, but this is now confirmed to be **cosmetic** and has no impact on Nexus stability.

## [Post-MVP] - 2025-01-03

### 🎉 **MVP COMPLETION & POST-MVP TRANSITION**

NEXUS has successfully completed its MVP phase! All core functionality has been implemented and thoroughly tested:

#### ✅ **MVP Achievements Completed**
- **Multi-LLM Support** - Full integration with Ollama (local) and OpenRouter (cloud)
- **Advanced MCP Integration** - Complete protocol support with tool execution
- **Professional Chat Interface** - Markdown rendering, syntax highlighting, persistence
- **Dashboard System** - Comprehensive system overview and monitoring
- **Security Framework** - Complete permission system with risk assessment
- **Configuration Management** - Visual forms, validation, and backup systems
- **Modern UI/UX** - Responsive design, themes, smooth animations
- **Cross-Platform Support** - Windows, macOS, Linux with automation scripts

#### 🚀 **Post-MVP Development Initiated**

We're now transitioning to advanced productivity features:

**Currently In Development:**
- **Multiple Chat Sessions/Tabs** - Comprehensive session management system
- **Project Workspaces** - Contextual organization for related conversations
- **Advanced Organization** - Smart categorization, search, and filtering

**Implementation Details:**
- Created comprehensive implementation plan: `CHAT_SESSIONS_IMPLEMENTATION.md`
- Incorporates best patterns from ChatGPT, Claude, and Gemini
- 10-week phased development approach
- Focus on performance, UX, and backward compatibility

#### 📋 **Documentation Updates**
- Updated README.md to reflect post-MVP status
- Created detailed implementation specification
- Updated development roadmap and feature priorities

### Technical Changes
- No breaking changes in this release
- All existing functionality remains stable
- Preparation for session management architecture

---

## [MVP] - Previous Releases

### Core Features Delivered
- MCP server integration and management
- Multi-provider LLM support (Ollama, OpenRouter)
- Professional chat interface with markdown support
- Dashboard and system monitoring
- Security and permissions framework
- Configuration management system
- Cross-platform compatibility
- Comprehensive testing suite

---

**Note:** This transition marks NEXUS's evolution from a functional MVP to a comprehensive AI interaction platform focused on productivity and advanced workflow management.

## [0.1.0] - 2025-06-28

### Added
- **Core MCP Integration**
  - Full Model Context Protocol support with @modelcontextprotocol/sdk v0.5.0
  - MCP server lifecycle management (start/stop/restart)
  - Tool execution with comprehensive permission system
  - Resource management and subscription handling
  - Prompt execution and discovery

- **LLM Provider Support**
  - Ollama integration for local LLM inference
  - OpenRouter integration for cloud-based models
  - Hot-swapping between providers
  - Model management and configuration

- **User Interface**
  - Modern React 18 + TypeScript + Tailwind CSS interface
  - Professional dark/light theme support
  - Responsive design with accessibility features
  - Dashboard view for system overview
  - MCP server management wizard
  - Settings management with real-time validation

- **State Management**
  - Zustand for complex application state
  - React Context for theme and global UI state
  - Local Storage for configuration persistence

- **Cross-Platform Automation**
  - Comprehensive script library with .sh and .ps1 versions
  - Project setup and initialization scripts
  - Development server management scripts
  - Production build automation
  - MCP server testing and verification scripts
  - Port management and cleanup utilities

- **Security Features**
  - Comprehensive permission system with risk assessment
  - Secure API key storage in OS keychain
  - Renderer process sandboxing with context isolation
  - Parameter sanitization and type checking

- **Testing Infrastructure**
  - Vitest-based test suite with 104+ tests
  - 96.11% coverage for core MCP functionality
  - Unit, integration, and UI component testing
  - Extensive mocking utilities for Electron and MCP APIs
  - Platform-specific testing scripts

- **Documentation**
  - Complete README with setup and usage instructions
  - Comprehensive testing guide (TESTING.md)
  - Contributing guidelines for open source development (CONTRIBUTING.md)
  - Scripts documentation (SCRIPTS.md)
  - Legal documents (MIT License, Terms of Use, Disclaimer)

### Technical Details
- **Framework**: Electron 28 + Node.js 18+
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Build System**: Vite + ESLint + Prettier
- **Testing**: Vitest + Jest DOM + Testing Library
- **State Management**: Zustand + React Context + Local Storage
- **Architecture**: Clean separation of main/renderer/preload processes

### Development
- Hot reload development environment
- TypeScript strict mode with comprehensive type safety
- Automated linting and formatting
- Cross-platform support (Windows, macOS, Linux)
- WSL compatibility with hardware acceleration handling

### Known Issues
- Occasional EPIPE errors during MCP server shutdown (non-fatal)
- WSL environments use software rendering for compatibility
- Legacy jest.config.js removed in favor of vitest.config.ts
- Residual EPIPE stack traces emitted **inside** MCP child processes during shutdown (cosmetic only — Nexus remains fully stable)

---

## Version History

### Versioning Strategy
- **Major.Minor.Patch** following Semantic Versioning
- **Major**: Breaking changes or significant feature additions
- **Minor**: New features and improvements
- **Patch**: Bug fixes and minor improvements

### Release Process
1. Update version in `package.json`
2. Update `CHANGELOG.md` with release notes
3. Create git tag with version number
4. Build and test release packages
5. Publish to GitHub releases

---

**Note**: This project is in active development. Features and APIs may change between versions. Documentation has been updated to reflect the current implementation accurately. 