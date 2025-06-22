#!/bin/bash
set -e

# NEXUS MVP Development Server Script
# This script starts the development environment for the NEXUS application

# Environment setup
export NODE_ENV=development
export ELECTRON_IS_DEV=1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure the chosen Vite dev port is free before we start
DEV_PORT="${DEV_PORT:-5173}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${SCRIPT_DIR}/kill-port.sh" "${DEV_PORT}" >/dev/null 2>&1 || true

echo -e "${GREEN}🚀 Starting NEXUS MVP Development Server${NC}"

# Check Node.js version
node_version=$(node --version 2>/dev/null || echo "not found")
if [[ "$node_version" == "not found" ]]; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js version: $node_version${NC}"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found. Make sure you're in the project root directory.${NC}"
    exit 1
fi

# Start development server
echo -e "${GREEN}🔧 Starting development server...${NC}"
npm run dev

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up development server...${NC}"
    # Kill any background processes if needed
    jobs -p | xargs -r kill
}

# Set trap for cleanup on script exit
trap cleanup EXIT INT TERM 