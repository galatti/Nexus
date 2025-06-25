# NEXUS MVP - Technical Specification

## Project Overview

**NEXUS** is an MCP-first desktop application built with Electron that provides a seamless interface for managing Model Context Protocol servers and interacting with Large Language Models. The application prioritizes ease of MCP server installation, configuration, and usage while supporting both local (Ollama) and cloud (OpenRouter) LLM providers.

## Core Philosophy

**MCP-First Design**: The application is built around the Model Context Protocol ecosystem, making it exceptionally easy to discover, install, configure, and use MCP servers. This differentiates NEXUS from generic chat clients by focusing specifically on the MCP ecosystem.

## Technical Foundation

### Technology Stack
- **Framework**: Electron (latest stable version)
- **Language**: TypeScript
- **MCP SDK**: @modelcontextprotocol/sdk (latest version)
- **UI Framework**: React with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Build Tool**: Vite
- **Package Manager**: npm

### Architecture
- **Main Process**: Handles MCP server connections, LLM API calls, and system integration
- **Renderer Process**: React-based UI for chat interface and configuration
- **Preload Scripts**: Secure IPC bridge between main and renderer processes

## MVP Feature Specification

### 1. Core Chat Interface

#### Chat Window
- Single active chat session (no multiple chat tabs in MVP)
- Full Markdown rendering support for both user input and AI responses
- Code syntax highlighting within markdown blocks
- Message history persistence across application restarts
- Auto-scroll to latest message
- Copy message content functionality
- Clear chat history option

#### Message Flow
- User types message in input field
- Application analyzes message for potential tool usage
- Sends request to configured LLM provider
- If LLM requests tool usage, displays user permission prompt
- Executes approved tool calls through MCP servers
- Displays final response with clear indication of tool usage

### 2. LLM Provider Management

#### Supported Providers
- **Ollama**: Local model support via http://localhost:11434/v1 endpoint
- **OpenRouter**: Cloud models via https://openrouter.ai/api/v1 endpoint

#### Provider Configuration
- Form-based configuration (no raw JSON editing for users)
- Provider selection dropdown (Ollama/OpenRouter)
- Model selection dropdown (auto-populated from provider)
- API key input field (for OpenRouter)
- Base URL override option (for custom Ollama installations)
- Temperature slider (0.0 to 1.0)
- Max tokens input field
- Test connection functionality

#### Ollama Integration
- Auto-detect local Ollama installation
- Fetch available models from Ollama API
- Display model download status if model not found
- Handle Ollama connection errors gracefully

#### OpenRouter Integration
- Support for OpenRouter API key authentication
- Model list fetching from OpenRouter API
- Proper request headers (HTTP-Referer, X-Title)
- Rate limiting awareness and error handling

### 3. MCP Server Management

#### Server Configuration Interface
- Visual form for each server type (no raw JSON)
- Server enable/disable toggles
- Per-server configuration fields:
  - Display name
  - Connection parameters
  - API keys (if required)
  - File paths (for filesystem server)
  - Allowed domains (for web search)
- Test connection button for each server
- Connection status indicators (connected/disconnected/error)

#### MCP Connection Management
- Support for up to 8 simultaneous MCP server connections
- Automatic reconnection on connection loss
- Connection health monitoring
- Graceful error handling and user notification

#### Tool and Resource Discovery
- List all available tools from connected servers
- Display tool descriptions and parameter requirements
- List all available resources from connected servers
- Preview resource content before usage
- Real-time updates when servers connect/disconnect

### 4. User Interface Design

#### Theme System
- Light theme (default)
- Dark theme
- System theme (follows OS preference)
- Theme persistence across application restarts
- Smooth theme transitions

#### Layout Structure
- Header: Application title and settings access
- Sidebar: MCP server status and provider configuration
- Main: Chat interface
- Footer: Status bar with connection indicators

#### Responsive Design
- Minimum window size: 1024x768
- Resizable interface with preserved proportions
- Sidebar collapse/expand functionality
- Proper text wrapping and overflow handling

### 5. Configuration Management

#### Settings Storage
- JSON configuration file in user data directory
- Automatic backup of configuration on changes
- Configuration validation on application startup
- Migration system for future configuration changes

#### Settings Categories
- **General**: Theme selection, startup behavior
- **LLM Providers**: Provider configurations and credentials
- **MCP Servers**: Server configurations and permissions
- **Chat**: Message history retention, markdown rendering options

#### Form Validation
- Real-time validation feedback
- Required field indicators
- Format validation (URLs, API keys, file paths)
- Error messages with suggested corrections
- Prevention of invalid configurations

### 6. Error Handling and Logging

#### User-Facing Error Handling
- Graceful degradation when servers are unavailable
- Clear error messages with suggested actions
- Retry mechanisms for transient failures
- Fallback behaviors when tools are unavailable

#### Logging System
- Detailed logging for debugging purposes
- Log levels: Debug, Info, Warning, Error
- Separate log files for main process and renderer
- Log rotation to prevent excessive disk usage
- MCP server communication logging

#### Debug Mode
- Developer menu option to enable debug mode
- Real-time MCP message inspection
- Performance metrics display
- Connection status details

### 7. Security and Permissions

#### MCP Server Permissions
- User confirmation required for tool execution
- Per-tool permission settings
- Filesystem access restrictions
- API call approval system

#### Credential Management
- Secure storage of API keys using OS keychain
- No plaintext storage of sensitive data
- Option to clear stored credentials
- Visual indicators for authenticated services

### 8. Installation and Deployment

#### Pre-installation Requirements
- Node.js installation check
- Guidance for installing Node.js if missing
- System compatibility verification

#### Application Distribution
- Electron Builder for packaging
- Code signing for macOS and Windows
- Auto-updater functionality
- Installation size optimization

#### MCP Server Installation
- Integration with existing package registries (npm, GitHub)
- High-level installation instructions for missing dependencies
- Verification of server installation success
- Rollback capability for failed installations

### 9. Onboarding Experience

#### First-Run Setup
- Welcome screen with MCP explanation
- Quick setup wizard for first LLM provider
- Basic MCP server configuration
- Test connection verification

#### Help System
- In-app basic tutorial with tooltips
- Quick tour highlighting key features
- Links to external MCP documentation
- Context-sensitive help for configuration forms

#### Example Demonstrations
- Pre-loaded example conversations showing MCP capabilities
- Sample tool usage scenarios
- Best practices guidance

### 10. Performance Requirements

#### Application Performance
- Startup time under 3 seconds
- Responsive UI with smooth animations
- Memory usage under 200MB during normal operation
- Efficient message rendering for large chat histories

#### MCP Performance
- Tool execution timeout handling (30 seconds default)
- Concurrent tool execution support
- Efficient resource caching
- Connection pooling for multiple servers

## Implementation Priority

### Phase 1: Core Infrastructure
1. Electron application setup with TypeScript
2. Basic React UI with theme system
3. MCP SDK integration and connection management
4. LLM provider abstraction layer

### Phase 2: Essential Features
1. Chat interface with Markdown rendering
2. Ollama and OpenRouter integration
3. Basic MCP server configuration
4. Settings management system

### Phase 3: MCP Integration
1. Pre-configured server templates
2. Tool discovery and execution
3. Permission system implementation
4. Error handling and logging

### Phase 4: Polish and Deployment
1. Onboarding experience
2. Help system and documentation
3. Application packaging and distribution
4. Testing and bug fixes

## Success Criteria

The MVP is considered successful when:
- Users can install and run the application without technical expertise
- Both Ollama and OpenRouter work seamlessly
- At least 3 MCP servers can be configured and used effectively
- Tool execution requires appropriate user permissions
- The application provides clear feedback for all user actions
- Error states are handled gracefully with helpful guidance
- The interface is intuitive enough to require minimal documentation

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

This specification provides a comprehensive blueprint for implementing NEXUS MVP while maintaining focus on the core MCP-first philosophy and ensuring a polished user experience.
