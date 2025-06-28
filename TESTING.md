# Testing Guide

This document outlines the comprehensive testing strategy for the Nexus project, covering unit tests, integration tests, and coverage reporting.

## Test Suite Overview

The Nexus project includes extensive testing for core MCP client functionality:

- **104 total tests** covering all critical components
- **96.11% coverage** for MCP Connection Manager (core functionality)
- **50-80% coverage** for UI components
- **Full integration testing** for end-to-end MCP server lifecycle

## Running Tests

### Basic Test Commands

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs when files change)
npm run test:watch

# Generate detailed coverage report
npm run test:coverage
```

### Test Categories

#### 1. Unit Tests
- **MCP Connection Manager** (`tests/main/mcp/ConnectionManager.test.ts`)
  - 970+ lines of comprehensive testing
  - Server lifecycle management (start/stop/restart)
  - Tool execution with permission handling
  - Resource management and subscriptions
  - Prompt execution and discovery
  - Error handling and edge cases
  - Platform-specific behavior testing
  - Concurrency and performance testing

#### 2. UI Component Tests
- **MCP Integration Component** (`tests/renderer/components/MCP/McpIntegration.test.tsx`)
  - 655+ lines testing server management UI
  - Loading states and error handling
  - Server display and status indicators
  - User interactions and form handling
  - Accessibility and keyboard navigation

- **MCP Server Wizard** (`tests/renderer/components/MCP/McpServerWizard.test.tsx`)
  - 240+ lines testing multi-step setup wizard
  - Form validation and user input handling
  - Connection testing and server creation
  - Error states and retry mechanisms

#### 3. Integration Tests
- **End-to-End MCP Integration** (`tests/integration/mcp-integration.test.ts`)
  - 255+ lines of full lifecycle testing
  - Multi-server management scenarios
  - Real MCP protocol communication
  - Resource subscription management
  - Performance and concurrency validation

#### 4. Test Utilities
- **Comprehensive Mock Framework** (`tests/utils/test-helpers.ts`)
  - 361+ lines of testing utilities
  - Mock factories for MCP clients and transports
  - Electron API mocking
  - Test data generators and fixtures
  - Performance measurement tools

## Coverage Report

Generate a detailed coverage report with:

```bash
npm run test:coverage
```

### Current Coverage Statistics
- **Overall Coverage**: 12.43% (focused on core functionality)
- **MCP Connection Manager**: 96.11% (fully tested)
- **UI Components**: 50-80% (key flows tested)
- **Integration Points**: Well covered for critical paths

### Coverage Details by Component

| Component | Coverage | Notes |
|-----------|----------|-------|
| MCP Connection Manager | 96.11% | Comprehensive testing of all core MCP functionality |
| MCP Integration UI | 81.42% | Full UI interaction testing |
| MCP Server Wizard | 50.81% | Key wizard flows tested |
| Integration Tests | 100% | End-to-end scenarios covered |

## Test Environment

### Framework and Tools
- **Test Runner**: Vitest (fast, modern testing framework)
- **UI Testing**: @testing-library/react with Jest DOM matchers
- **Mocking**: Vitest mocks with comprehensive Electron API simulation
- **Coverage**: V8 coverage reporting

### Configuration
- Test configuration in `vitest.config.ts`
- Test setup in `src/setupTests.ts`
- Custom test utilities in `tests/utils/`

## Writing New Tests

### Test Structure
```typescript
describe('Component/Feature Name', () => {
  beforeEach(() => {
    // Setup for each test
  });

  afterEach(() => {
    cleanup(); // Clean up DOM and mocks
  });

  it('should describe what it tests', async () => {
    // Test implementation
  });
});
```

### Best Practices
1. **Use descriptive test names** that explain the expected behavior
2. **Mock external dependencies** appropriately (Electron APIs, MCP SDK)
3. **Test user interactions** not implementation details
4. **Include error cases** and edge conditions
5. **Clean up after tests** to prevent interference between tests

### Mocking Guidelines
- Use the mock utilities in `tests/utils/test-helpers.ts`
- Mock Electron APIs consistently across tests
- Simulate realistic MCP server responses
- Test both success and failure scenarios

## Debugging Tests

### Running Specific Tests
```bash
# Run tests matching a pattern
npx vitest run --grep "ConnectionManager"

# Run tests in a specific file
npx vitest run tests/main/mcp/ConnectionManager.test.ts

# Run with verbose output
npx vitest run --reporter=verbose
```

### Common Issues
1. **DOM Cleanup**: Ensure `cleanup()` is called in `afterEach`
2. **Async Operations**: Use `waitFor()` for async state changes
3. **Mock Conflicts**: Clear mocks between tests with `vi.clearAllMocks()`
4. **Element Queries**: Use `getAllBy*` when multiple elements exist

## Continuous Integration

The test suite is designed to run reliably in CI environments:
- All tests complete within reasonable time limits
- No external dependencies required for testing
- Comprehensive mocking eliminates flaky network calls
- Platform-agnostic testing approach

## Contributing

When adding new features:
1. **Write tests first** (TDD approach recommended)
2. **Ensure good coverage** for new functionality
3. **Test error conditions** and edge cases
4. **Update documentation** if adding new testing patterns

For questions about testing or adding new test cases, refer to the existing test files as examples or check the project's issue tracker.
