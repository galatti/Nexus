# Testing Documentation

NEXUS maintains enterprise-grade testing standards with comprehensive coverage, automated quality gates, and robust CI/CD integration.

## Overview

Our testing philosophy focuses on **reliability, coverage, and confidence** in deployments. We maintain strict quality gates to ensure production readiness and smooth releases.

### Testing Metrics

- **Overall Coverage**: 80%+ maintained (lines, functions, statements)
- **Branch Coverage**: 75%+ maintained  
- **Critical Components**: 90%+ coverage for core business logic
- **Test Count**: 293+ tests across 12 test files
- **Test Code**: 2,675+ lines of comprehensive test coverage

## Test Architecture

### Test Categories

#### 1. **Unit Tests** (272+ tests)
Individual component testing with comprehensive mocking:

**ConfigManager Tests** (`tests/main/config/ConfigManager.test.ts`)
- Settings validation, persistence, and migration
- Provider and server configuration management
- Import/export functionality and error handling
- 149 test cases covering all configuration scenarios

**LlmManager Tests** (`tests/main/llm/LlmManager.test.ts`)  
- Provider lifecycle management and health monitoring
- Message processing and model management
- Event emission and concurrent operations
- 118 test cases covering LLM orchestration

**PermissionManager Tests** (`tests/main/permissions/PermissionManager.test.ts`)
- Risk assessment algorithms and permission storage
- Session management and argument validation  
- User approval workflows and security features
- 126 test cases covering security-critical functionality

**Provider Tests**
- **OllamaProvider** (`tests/main/llm/providers/OllamaProvider.test.ts`): 45 tests
- **OpenRouterProvider** (`tests/main/llm/providers/OpenRouterProvider.test.ts`): 44 tests
- Connection testing, model management, message processing
- Streaming support, error handling, timeout scenarios

#### 2. **Integration Tests** (21+ tests)
Cross-component workflows and system integration:

**Main Process IPC** (`tests/integration/main-ipc.test.ts`)
- IPC handler testing with full workflow simulation
- Cross-module integration (Config + LLM + Permissions)
- Error handling and data flow validation
- Multi-component scenario testing

#### 3. **Existing MCP Tests**
Comprehensive MCP server lifecycle testing:

**ConnectionManager** (`tests/main/mcp/ConnectionManager.test.ts`)
- 96.11% coverage with 920+ lines of tests
- Server lifecycle, tool execution, resource management
- Permission integration and error scenarios

**Component Tests**
- UI component testing with React Testing Library
- MCP integration components and wizards
- Session management and user interactions

## Running Tests

### Development Testing

```bash
# Run all tests once
npm test

# Run tests in watch mode (development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test files
npx vitest run ConfigManager
npx vitest run --grep "permission"

# Run tests with specific patterns
npx vitest run tests/main/
npx vitest run tests/integration/
```

### CI/CD Testing

```bash
# Full CI test suite (used in GitHub Actions)
npm run test:ci

# Coverage with threshold enforcement
npm run test:coverage

# Generate JUnit reports for CI
npx vitest run --reporter=junit --outputFile=test-results/junit.xml
```

### Coverage Analysis

```bash
# Generate coverage reports
npm run test:coverage

# View HTML coverage report
open coverage/index.html

# Check coverage summary
cat coverage/coverage-summary.json
```

## Quality Gates

### Pre-Merge Requirements

**Test Coverage Thresholds:**
- **Lines**: 80% minimum
- **Functions**: 80% minimum  
- **Branches**: 75% minimum
- **Statements**: 80% minimum

**Quality Checks:**
- All tests must pass (zero failures)
- ESLint validation (zero violations)
- TypeScript compilation (zero errors)
- Security audit (no high-severity vulnerabilities)

### CI/CD Integration

**Automated Testing Pipeline:**
1. **Install Dependencies**: `npm ci` for consistent builds
2. **Lint Code**: `npm run lint` with fix-on-save
3. **Type Check**: `npm run typecheck` for both main and renderer
4. **Run Tests**: `npm run test:coverage` with threshold enforcement
5. **Security Scan**: `npm audit` and vulnerability checking
6. **Generate Reports**: Coverage, JUnit, and artifact creation

**Multi-Platform Testing:**
- **Ubuntu Latest**: Primary Linux testing environment
- **Windows Latest**: Windows compatibility validation  
- **macOS Latest**: macOS compatibility validation
- **Node.js 18 & 20**: LTS version compatibility

---

**Last Updated**: 2024-01-03  
**Coverage Target**: 80%+ (lines, functions, statements), 75%+ (branches)  
**Test Count**: 293+ tests across 12 test files  
**Quality Gate**: All tests must pass with coverage thresholds met