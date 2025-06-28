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

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

## 🧪 Testing Requirements

**All contributions must include appropriate tests.** We maintain high test coverage for core functionality.

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Guidelines
- Write tests for new features and bug fixes
- Maintain or improve existing test coverage
- Use descriptive test names that explain expected behavior
- Test both success and error cases
- Follow existing testing patterns (see `tests/` directory)

## 📝 Code Standards

### TypeScript
- Use strict TypeScript configurations
- Provide proper type annotations
- Avoid `any` types unless absolutely necessary
- Follow existing code style and patterns

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
```

## 🎯 Areas for Contribution

### High Priority
- **Test Coverage Expansion**: Increase coverage for UI components and LLM providers
- **Documentation**: Improve setup guides, API documentation, and examples
- **Bug Fixes**: Address issues reported in GitHub Issues
- **Performance**: Optimize MCP server connection handling

### Medium Priority
- **UI/UX Improvements**: Enhance user interface and experience
- **Error Handling**: Improve error messages and recovery mechanisms
- **Platform Support**: Better cross-platform compatibility
- **Accessibility**: Enhance keyboard navigation and screen reader support

### Feature Requests
- **MCP Server Templates**: Additional pre-configured server templates
- **Configuration Import/Export**: Backup and restore functionality
- **Advanced Logging**: Enhanced debugging and monitoring tools
- **Plugin System**: Extensibility for custom integrations

## 🔄 Development Workflow

### 1. Create Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes
- Write code following project conventions
- Add tests for new functionality
- Update documentation as needed
- Ensure all tests pass

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
```

### 4. Submit Pull Request
- Create a descriptive pull request title
- Provide detailed description of changes
- Reference any related issues
- Ensure all CI checks pass

## 🐛 Bug Reports

### Before Reporting
1. Check existing issues for duplicates
2. Test with the latest version
3. Reproduce with minimal test case

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

**Additional Context**
Any other relevant information
```

## 💡 Feature Requests

### Before Requesting
1. Check existing issues and roadmap
2. Consider if it fits the project scope
3. Think about implementation complexity

### Feature Request Template
```markdown
**Problem Statement**
What problem does this solve?

**Proposed Solution**
How should this be implemented?

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
│   ├── components/      # UI components
│   ├── context/         # React contexts
│   └── styles/          # Styling
├── preload/             # IPC bridge
└── shared/              # Shared utilities and types
```

### Design Principles
- **Security First**: All external communication must be secure
- **Type Safety**: Comprehensive TypeScript usage
- **Testability**: Code should be easily testable
- **Modularity**: Clear separation of concerns
- **Performance**: Efficient resource usage

## 📚 Documentation

### Types of Documentation
- **Code Comments**: For complex logic and algorithms
- **API Documentation**: For public interfaces
- **User Guides**: For setup and usage instructions
- **Developer Guides**: For contribution and architecture

### Documentation Standards
- Write clear, concise explanations
- Include code examples where helpful
- Keep documentation up-to-date with changes
- Use proper markdown formatting

## 🤝 Community Guidelines

### Code of Conduct
- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Maintain a professional tone

### Communication
- Use GitHub Issues for bug reports and feature requests
- Use GitHub Discussions for questions and general discussion
- Be patient and helpful with new contributors
- Provide clear, actionable feedback in code reviews

## ⚖️ Legal

### License
By contributing to Nexus, you agree that your contributions will be licensed under the MIT License.

### Contributor License Agreement
For significant contributions, you may be asked to sign a Contributor License Agreement (CLA).

## 🆘 Getting Help

### Resources
- **Documentation**: Check README.md and other docs
- **Issues**: Search existing GitHub issues
- **Discussions**: Use GitHub Discussions for questions

### Contact
- Create an issue for bugs or feature requests
- Use discussions for general questions
- Tag maintainers for urgent issues

---

**Thank you for contributing to Nexus!** Your help makes this project better for everyone. 