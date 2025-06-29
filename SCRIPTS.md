# Automation Scripts Guide

This document describes the automation scripts available in the `scripts/` directory. All scripts are provided in both `.sh` (bash/zsh for Linux/macOS) and `.ps1` (PowerShell for Windows) versions to ensure cross-platform compatibility.

## Overview

The Nexus project includes comprehensive automation scripts for:
- Project setup and initialization
- Development server management  
- Production builds
- MCP server testing and validation
- Port management and cleanup
- Environment configuration

## Available Scripts

### Project Setup

#### `setup-project.{sh,ps1}`
**Purpose**: Complete project initialization and environment setup

**Features**:
- Node.js and npm version validation
- Dependency installation and verification
- Environment variable configuration
- Development tool setup
- Initial configuration file creation
- Project structure validation

**Usage**:
```bash
# Linux/macOS
./scripts/setup-project.sh

# Windows
./scripts/setup-project.ps1
```

**When to use**: Run once after cloning the repository for first-time setup.

---

### Development Server Management

#### `dev-server.{sh,ps1}`
**Purpose**: Start and manage the development server with enhanced features

**Features**:
- Port availability checking and cleanup
- Vite development server startup
- Electron process management
- Hot reload configuration
- Error handling and recovery
- Process monitoring

**Usage**:
```bash
# Linux/macOS
./scripts/dev-server.sh

# Windows
./scripts/dev-server.ps1
```

**Alternative**: `npm run dev` (uses `start-dev.js`)

#### `start-dev.js`
**Purpose**: Node.js-based development server launcher

**Features**:
- Cross-platform port management
- Concurrent process handling
- Build process coordination
- Automatic browser launching

**Usage**: Called automatically by `npm run dev`

---

### Production Builds

#### `build-prod.{sh,ps1}`
**Purpose**: Complete production build with optimization and packaging

**Features**:
- Clean build environment setup
- Renderer and main process compilation
- Asset optimization and minification
- Source map generation
- Build verification and testing
- Distribution package creation
- Code signing preparation

**Usage**:
```bash
# Linux/macOS
./scripts/build-prod.sh

# Windows
./scripts/build-prod.ps1
```

**Output**: Optimized build in `dist/` directory and distribution packages in `release/`

---

### MCP Server Testing

#### `mcp-verify.{sh,ps1}`
**Purpose**: Basic MCP server connectivity and functionality verification

**Features**:
- MCP server installation checking
- Connection establishment testing
- Basic tool discovery
- Health check validation
- Configuration verification
- Quick smoke tests

**Usage**:
```bash
# Linux/macOS
./scripts/mcp-verify.sh [server-name]

# Windows
./scripts/mcp-verify.ps1 [server-name]
```

**Parameters**:
- `server-name` (optional): Specific server to test, defaults to all configured servers

#### `test-mcp-everything.{sh,ps1}`
**Purpose**: Comprehensive MCP server integration testing

**Features**:
- Multiple MCP server installation and setup
- Full lifecycle testing (start/stop/restart)
- Tool execution with all parameter types
- Resource subscription and management
- Prompt discovery and execution
- Error condition simulation
- Performance benchmarking
- Concurrency testing
- Clean up and teardown

**Usage**:
```bash
# Linux/macOS
./scripts/test-mcp-everything.sh

# Windows
./scripts/test-mcp-everything.ps1
```

**Duration**: 5-10 minutes for complete test suite

---

### Utility Scripts

#### `kill-port.{sh,ps1,js}`
**Purpose**: Kill processes running on specified ports

**Features**:
- Cross-platform process identification
- Graceful and forced termination
- Multiple port handling
- Error handling for permission issues

**Usage**:
```bash
# Linux/macOS
./scripts/kill-port.sh 5173

# Windows  
./scripts/kill-port.ps1 5173

# Node.js (cross-platform)
node scripts/kill-port.js 5173
```

**Parameters**:
- `port`: Port number to free (required)

#### `setup-encoding.{sh,ps1}`
**Purpose**: Configure proper text encoding for development

**Features**:
- UTF-8 encoding setup
- Terminal configuration
- Environment variable setting
- Locale configuration

**Usage**:
```bash
# Linux/macOS
./scripts/setup-encoding.sh

# Windows
./scripts/setup-encoding.ps1
```

#### `rename-preload.js`
**Purpose**: Rename preload script for proper ES module loading

**Features**:
- Automatic file extension management
- Build process integration
- Error handling

**Usage**: Called automatically during build process

#### `clear-mcp-config.ps1`
**Purpose**: Reset MCP server configuration (Windows only)

**Features**:
- Configuration file cleanup
- Server state reset
- Permission cache clearing
- Backup creation

**Usage**:
```powershell
./scripts/clear-mcp-config.ps1
```

---

## Script Conventions

### Naming Convention
- **Base name**: Descriptive action (e.g., `setup-project`, `build-prod`)
- **Extensions**: `.sh` for bash/zsh, `.ps1` for PowerShell, `.js` for Node.js

### Error Handling
All scripts include:
- Exit code management (0 for success, non-zero for errors)
- Descriptive error messages
- Cleanup on failure
- Logging for debugging

### Output Format
Consistent status indicators:
- `[✓]` Success messages
- `[!]` Warning messages  
- `[✗]` Error messages
- `[*]` Information messages
- `[>]` Progress indicators

### Parameters and Configuration
- Environment variables for configuration
- Command-line parameters for flexibility
- Validation of required inputs
- Help documentation (`--help` flag)

## Environment Variables

Scripts respect these environment variables:

| Variable | Purpose | Default |
|----------|---------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `DEV_SERVER_PORT` | Development server port | `5173` |
| `MCP_CONFIG_PATH` | MCP configuration directory | `~/.nexus/mcp` |
| `NEXUS_LOG_LEVEL` | Logging verbosity | `info` |
| `SKIP_CLEANUP` | Skip cleanup on exit | `false` |

## Best Practices

### Running Scripts
1. **Make scripts executable** (Linux/macOS):
   ```bash
   chmod +x scripts/*.sh
   ```

2. **Check PowerShell execution policy** (Windows):
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

3. **Run from project root**:
   ```bash
   ./scripts/script-name.sh
   ```

### Development Workflow
1. **Initial setup**: `setup-project.{sh,ps1}`
2. **Daily development**: `npm run dev` or `dev-server.{sh,ps1}`
3. **Testing MCP**: `mcp-verify.{sh,ps1}` for quick tests
4. **Full validation**: `test-mcp-everything.{sh,ps1}` before commits
5. **Production builds**: `build-prod.{sh,ps1}` for releases

### Troubleshooting
- **Permission errors**: Check script permissions and execution policies
- **Port conflicts**: Use `kill-port.*` scripts to free ports
- **Build failures**: Check Node.js version and clean with `npm run clean`
- **MCP issues**: Run `mcp-verify.*` to diagnose connectivity problems

## Contributing

When adding new scripts:
1. **Create both .sh and .ps1 versions** for cross-platform support
2. **Follow naming conventions** and output formatting
3. **Include error handling** and cleanup procedures
4. **Add help documentation** with `--help` flag
5. **Test on multiple platforms** before committing
6. **Update this documentation** with new script descriptions

## Security Considerations

- Scripts may require elevated privileges for system operations
- MCP testing scripts install and run external servers
- Build scripts may modify system PATH and environment
- Always review scripts before execution
- Use provided scripts from trusted sources only

---

For questions about scripts or to report issues, please use the project's GitHub Issues. 