# Contributing to Nexus

Thank you for your interest in contributing to Nexus! This document provides guidelines and instructions for contributing to the project.

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- **Git** for version control
- **OS**: Windows 10+, macOS 10.15+, or Linux

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/galatti/Nexus.git
   cd Nexus
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Initialize Project (Optional)**
   ```bash
   # Run platform-specific setup script
   ./scripts/setup-project.sh      # Linux/macOS
   ./scripts/setup-project.ps1     # Windows
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   # OR use platform-specific script
   ./scripts/dev-server.sh         # Linux/macOS
   ./scripts/dev-server.ps1        # Windows
   ```

5. **Run Tests**
   ```bash
   npm test
   ```

## 🧪 Testing Requirements

**All contributions must include appropriate tests.** We maintain high test coverage for core functionality using **Vitest** as our test runner.

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Platform-Specific Testing
```bash
# MCP server verification
./scripts/mcp-verify.sh             # Linux/macOS
./scripts/mcp-verify.ps1            # Windows

# Comprehensive MCP testing
./scripts/test-mcp-everything.sh    # Linux/macOS
./scripts/test-mcp-everything.ps1   # Windows
```

### Test Guidelines
- Write tests for new features and bug fixes
- Maintain or improve existing test coverage
- Use descriptive test names that explain expected behavior
- Test both success and error cases
- Follow existing testing patterns (see `tests/` directory)
- **Use Vitest syntax** (`vi.fn()`, `vi.mock()`, etc.)
- Include tests for both UI components and backend functionality

## 📝 Code Standards

### TypeScript
- Use strict TypeScript configurations
- Provide proper type annotations
- Avoid `any` types unless absolutely necessary
- Follow existing code style and patterns
- Use shared types from `src/shared/types.ts`

### Cross-Platform Development
- **Always provide both .sh and .ps1 versions** of any automation scripts
- Use environment variables instead of hardcoded paths
- Test on multiple platforms when possible
- Follow platform-specific best practices

### Linting and Formatting
```bash
# Check for linting issues
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Type checking
npm run type-check
```

### Commit Messages
Use clear, descriptive commit messages:
```
feat: add new MCP server configuration validation
fix: resolve connection timeout issue in HTTP transport
docs: update API documentation for tool execution
test: add unit tests for permission manager
scripts: add cross-platform build automation
```

## 🎯 Areas for Contribution

### High Priority
- **Test Coverage Expansion**: Increase coverage for UI components and LLM providers
- **Documentation**: Improve setup guides, API documentation, and examples
- **Bug Fixes**: Address issues reported in GitHub Issues
- **Performance**: Optimize MCP server connection handling
- **Cross-Platform Scripts**: Enhance automation scripts for better platform support

### Medium Priority
- **UI/UX Improvements**: Enhance user interface and experience
- **Error Handling**: Improve error messages and recovery mechanisms
- **Platform Support**: Better cross-platform compatibility
- **Accessibility**: Enhance keyboard navigation and screen reader support
- **Dashboard Enhancements**: Add more metrics and status indicators

### Feature Requests
- **MCP Server Templates**: Additional pre-configured server templates
- **Configuration Import/Export**: Backup and restore functionality
- **Advanced Logging**: Enhanced debugging and monitoring tools
- **Plugin System**: Extensibility for custom integrations
- **Multiple Chat Sessions**: Tab-based conversation management

## 🔄 Development Workflow

### 1. Create Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes
- Write code following project conventions
- Add tests for new functionality (using Vitest)
- Update documentation as needed
- Ensure all tests pass
- **Create both .sh and .ps1 versions** of any scripts

### 3. Test Your Changes
```bash
# Run full test suite
npm test

# Check linting
npm run lint

# Verify TypeScript compilation
npm run type-check

# Test the application manually
npm run dev

# Test MCP functionality (if applicable)
./scripts/mcp-verify.sh     # Linux/macOS
./scripts/mcp-verify.ps1    # Windows
```

### 4. Build Verification
```bash
# Test production build
npm run build

# OR use platform-specific build script
./scripts/build-prod.sh     # Linux/macOS
./scripts/build-prod.ps1    # Windows
```

### 5. Submit Pull Request
- Create a descriptive pull request title
- Provide detailed description of changes
- Reference any related issues
- Ensure all CI checks pass
- Include screenshots for UI changes

## 🐛 Bug Reports

### Before Reporting
1. Check existing issues for duplicates
2. Test with the latest version
3. Reproduce with minimal test case
4. Test on multiple platforms if possible

### Bug Report Template
```markdown
**Description**
Clear description of the bug

**Steps to Reproduce**
1. Step one
2. Step two
3. Step three

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- OS: [e.g., Windows 11, macOS 13, Ubuntu 22.04]
- Node.js version: [e.g., 18.17.0]
- Nexus version: [e.g., 0.1.0]
- MCP servers: [list any relevant MCP servers]

**Logs**
Any relevant error messages or logs

**Additional Context**
Any other relevant information
```

## 💡 Feature Requests

### Before Requesting
1. Check existing issues and roadmap
2. Consider if it fits the project scope
3. Think about implementation complexity
4. Consider cross-platform implications

### Feature Request Template
```markdown
**Problem Statement**
What problem does this solve?

**Proposed Solution**
How should this be implemented?

**Platform Considerations**
How should this work across different platforms?

**Alternatives Considered**
What other approaches were considered?

**Additional Context**
Any other relevant information
```

## 🏗️ Architecture Guidelines

### Project Structure
```
src/
├── main/                 # Electron Main Process
│   ├── config/          # Configuration management
│   ├── llm/             # LLM provider implementations
│   ├── mcp/             # MCP server management
│   └── permissions/     # Security and permissions
├── renderer/            # React Frontend
│   ├── components/      # UI components organized by feature
│   ├── context/         # React contexts for state management
│   └── styles/          # Tailwind CSS styling
├── preload/             # IPC bridge between main and renderer
└── shared/              # Shared types and utilities

scripts/                 # Automation Scripts
├── *.sh                # Bash/Zsh scripts (Linux/macOS)
├── *.ps1               # PowerShell scripts (Windows)
└── *.js                # Node.js utilities
```

### Component Organization
- **Chat/**: Chat interface and message handling
- **Dashboard/**: System overview and status display
- **Layout/**: Application layout and navigation
- **MCP/**: MCP server management and integration
- **Permissions/**: Permission management UI
- **Settings/**: Configuration and settings UI

### State Management
- **Zustand**: Primary state management for complex application state
- **React Context**: Theme management and global UI state
- **Local Storage**: Configuration persistence and user preferences

### Testing Strategy
- **Unit Tests**: Individual component and function testing
- **Integration Tests**: Full MCP server lifecycle testing  
- **UI Tests**: User interaction and accessibility testing
- **Platform Tests**: Cross-platform script validation

## 🔧 Development Tools

### Available Scripts
All development scripts are available in both .sh and .ps1 versions:

| Purpose | Linux/macOS | Windows |
|---------|-------------|---------|
| Project Setup | `./scripts/setup-project.sh` | `./scripts/setup-project.ps1` |
| Dev Server | `./scripts/dev-server.sh` | `./scripts/dev-server.ps1` |
| Production Build | `./scripts/build-prod.sh` | `./scripts/build-prod.ps1` |
| MCP Verification | `./scripts/mcp-verify.sh` | `./scripts/mcp-verify.ps1` |
| Full MCP Testing | `./scripts/test-mcp-everything.sh` | `./scripts/test-mcp-everything.ps1` |
| Port Cleanup | `./scripts/kill-port.sh 5173` | `./scripts/kill-port.ps1 5173` |

### Development Environment
- **Hot Reload**: Instant updates during development
- **Type Safety**: Full TypeScript integration with strict mode
- **Code Quality**: ESLint + Prettier for consistent formatting
- **Testing**: Vitest with comprehensive coverage reporting
- **Debugging**: Full source map support and Chrome DevTools integration

## 📋 Checklist for Contributors

Before submitting a pull request, ensure:

- [ ] Code follows TypeScript best practices
- [ ] All tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] New features include appropriate tests
- [ ] Documentation is updated for new features
- [ ] Cross-platform scripts are provided (.sh and .ps1)
- [ ] Changes work on multiple platforms (if applicable)
- [ ] MCP functionality is tested (if applicable)
- [ ] UI changes are accessible and responsive

## 🤝 Community Guidelines

We are committed to providing a welcoming and inclusive environment for all contributors. Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating in the project.

### Getting Help
- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and community discussion
- **Code Review**: Constructive feedback on pull requests

## 📚 Additional Resources

- [TESTING.md](TESTING.md) - Comprehensive testing guide
- [README.md](README.md) - Project overview and setup
- [CHANGELOG.md](CHANGELOG.md) - Version history and changes
- [Architecture Documentation](docs/) - Detailed technical documentation

---

Thank you for contributing to Nexus! Your contributions help make this project better for everyone. 