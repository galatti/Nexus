#!/bin/bash

# Build script for Pomodoro MCP server
# This script compiles the TypeScript Pomodoro server to JavaScript

set -e

echo "🍅 Building Pomodoro MCP Server..."

# Set environment variables
export NODE_ENV=${NODE_ENV:-production}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Set paths
SRC_DIR="$PROJECT_ROOT/src/main/mcp/servers"
BUILD_DIR="$PROJECT_ROOT/dist/main/mcp/servers"

# Ensure build directory exists
mkdir -p "$BUILD_DIR"

echo -e "${BLUE}📁 Source directory: $SRC_DIR${NC}"
echo -e "${BLUE}📦 Build directory: $BUILD_DIR${NC}"

# Check if TypeScript is available
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx not found. Please install Node.js and npm.${NC}"
    exit 1
fi

# Check if source file exists
if [ ! -f "$SRC_DIR/PomodoroServer.ts" ]; then
    echo -e "${RED}❌ Source file not found: $SRC_DIR/PomodoroServer.ts${NC}"
    exit 1
fi

# Compile TypeScript to JavaScript
echo -e "${YELLOW}🔨 Compiling TypeScript...${NC}"

npx tsc \
    "$SRC_DIR/PomodoroServer.ts" \
    --outDir "$BUILD_DIR" \
    --target ES2020 \
    --module commonjs \
    --moduleResolution node \
    --esModuleInterop \
    --allowSyntheticDefaultImports \
    --strict \
    --skipLibCheck \
    --forceConsistentCasingInFileNames \
    --resolveJsonModule

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Compilation successful!${NC}"
    echo -e "${GREEN}📍 Output: $BUILD_DIR/PomodoroServer.js${NC}"
    
    # Make the compiled file executable
    chmod +x "$BUILD_DIR/PomodoroServer.js"
    
    # Show file size
    if command -v du &> /dev/null; then
        FILE_SIZE=$(du -h "$BUILD_DIR/PomodoroServer.js" | cut -f1)
        echo -e "${BLUE}📊 File size: $FILE_SIZE${NC}"
    fi
    
    echo -e "${GREEN}🎉 Pomodoro MCP Server build complete!${NC}"
else
    echo -e "${RED}❌ Compilation failed!${NC}"
    exit 1
fi

# Verify the compiled file is valid JavaScript
echo -e "${YELLOW}🔍 Verifying compiled JavaScript...${NC}"

if node -c "$BUILD_DIR/PomodoroServer.js" 2>/dev/null; then
    echo -e "${GREEN}✅ JavaScript syntax is valid${NC}"
else
    echo -e "${RED}❌ JavaScript syntax error detected${NC}"
    exit 1
fi

echo -e "${GREEN}🚀 Ready to use! The Pomodoro MCP server can now be started.${NC}"
echo -e "${BLUE}💡 Usage: node $BUILD_DIR/PomodoroServer.js${NC}" 