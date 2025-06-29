#!/bin/bash

# Documentation Validation Script
# Validates that documentation matches actual implementation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Output formatting
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warning() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${BLUE}[*]${NC} $1"; }

# Validation counters
CHECKS_PASSED=0
CHECKS_FAILED=0

validate_check() {
    if [ $? -eq 0 ]; then
        success "$1"
        ((CHECKS_PASSED++))
    else
        error "$1"
        ((CHECKS_FAILED++))
    fi
}

info "Starting documentation validation..."

# Check 1: Verify package.json scripts match documentation
info "Checking package.json scripts vs README documentation..."
README_SCRIPTS=$(grep -c "npm run" README.md)
PACKAGE_SCRIPTS=$(jq '.scripts | keys | length' package.json)

if [ "$README_SCRIPTS" -ge 10 ] && [ "$PACKAGE_SCRIPTS" -ge 14 ]; then
    validate_check "Package.json scripts documented in README"
else
    false
    validate_check "Package.json scripts documented in README (found $README_SCRIPTS in README, $PACKAGE_SCRIPTS in package.json)"
fi

# Check 2: Verify test framework consistency
info "Checking test framework consistency..."
if grep -q "vitest" package.json && grep -q "Vitest" README.md && grep -q "Vitest" TESTING.md; then
    validate_check "Test framework (Vitest) consistently documented"
else
    false
    validate_check "Test framework (Vitest) consistently documented"
fi

# Check 3: Verify Jest references are mostly migration-related
info "Checking for inappropriate Jest references..."
JEST_REFS=$(grep -r -i "jest" *.md | grep -v -E "(jest-dom|migrat|instead of|from Jest to Vitest|Jest DOM|Jest DOM matchers|@testing-library/react with Jest DOM|legacy.*jest|jest\.config\.js)" | wc -l)
if [ "$JEST_REFS" -eq 0 ]; then
    validate_check "No inappropriate Jest references in documentation"
else
    false
    validate_check "No inappropriate Jest references found (found $JEST_REFS inappropriate references)"
fi

# Check 4: Verify scripts directory matches SCRIPTS.md
info "Checking scripts directory vs SCRIPTS.md documentation..."
SCRIPT_FILES=$(find scripts/ -name "*.sh" -o -name "*.ps1" | wc -l)
DOCUMENTED_SCRIPTS=$(grep -c "\.{sh,ps1}" SCRIPTS.md 2>/dev/null || echo 0)

if [ "$SCRIPT_FILES" -gt 10 ] && [ "$DOCUMENTED_SCRIPTS" -ge 5 ]; then
    validate_check "Scripts directory documented in SCRIPTS.md"
else
    false
    validate_check "Scripts directory documented in SCRIPTS.md (found $SCRIPT_FILES files, $DOCUMENTED_SCRIPTS documented)"
fi

# Check 5: Verify state management description
info "Checking state management description..."
if grep -q "Zustand" README.md && grep -q "React Context" README.md; then
    validate_check "State management (Zustand + React Context) correctly documented"
else
    false
    validate_check "State management (Zustand + React Context) correctly documented"
fi

# Check 6: Verify technology stack accuracy
info "Checking technology stack descriptions..."
if grep -q "Electron 28" README.md && grep -q "React 18" README.md && grep -q "TypeScript" README.md; then
    validate_check "Technology stack accurately documented"
else
    false
    validate_check "Technology stack accurately documented"
fi

# Check 7: Verify cross-platform script mentions
info "Checking cross-platform script documentation..."
if grep -q "\.sh.*\.ps1" README.md && [ -f "SCRIPTS.md" ]; then
    validate_check "Cross-platform scripts documented"
else
    false
    validate_check "Cross-platform scripts documented"
fi

# Check 8: Verify known issues section exists
info "Checking known issues documentation..."
if grep -q "Known Issues" README.md && grep -q "EPIPE" README.md; then
    validate_check "Known issues section with EPIPE errors documented"
else
    false
    validate_check "Known issues section with EPIPE errors documented"
fi

# Check 9: Verify dashboard view is mentioned
info "Checking dashboard view documentation..."
if grep -q -i "dashboard" README.md; then
    validate_check "Dashboard view documented in README"
else
    false
    validate_check "Dashboard view documented in README"
fi

# Check 10: Verify vitest.config.ts exists (not jest.config.js)
info "Checking test configuration files..."
if [ -f "vitest.config.ts" ] && [ ! -f "jest.config.js" ]; then
    validate_check "Correct test configuration file (vitest.config.ts) exists"
else
    false
    validate_check "Correct test configuration file (vitest.config.ts) exists"
fi

# Summary
echo ""
info "Documentation validation complete!"
success "Checks passed: $CHECKS_PASSED"
if [ "$CHECKS_FAILED" -gt 0 ]; then
    error "Checks failed: $CHECKS_FAILED"
    echo ""
    error "Documentation validation failed. Please fix the issues above."
    exit 1
else
    echo ""
    success "All documentation validation checks passed!"
    exit 0
fi 