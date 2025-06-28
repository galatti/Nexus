# Testing Guide

This document outlines how to run the test suite for the Nexus project.

## Running Tests

To run all tests, use the following command:

```bash
npm test
```

This command will execute all test files (e.g., `*.test.ts`, `*.test.tsx`) located in the `tests/` directory, as configured in `vitest.config.ts`.

## Watching Tests

To run tests in watch mode (re-runs tests when files change), use:

```bash
npm run test:watch
```

## Test Coverage

To generate a test coverage report, use:

```bash
npm run test:coverage
```

This will output a coverage summary to the console and generate an HTML report in the `coverage/` directory.
