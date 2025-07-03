#!/usr/bin/env node

/**
 * Test setup script to ensure proper test environment
 */

import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Ensure test-results directory exists
const testResultsDir = join(projectRoot, 'test-results');
if (!existsSync(testResultsDir)) {
  mkdirSync(testResultsDir, { recursive: true });
  console.log('Created test-results directory');
}

// Ensure coverage directory exists
const coverageDir = join(projectRoot, 'coverage');
if (!existsSync(coverageDir)) {
  mkdirSync(coverageDir, { recursive: true });
  console.log('Created coverage directory');
}

console.log('Test environment setup complete');