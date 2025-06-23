#!/bin/bash

# MCP Setup Verification Script (Bash/macOS/Linux)
# This script verifies that the system is properly configured for MCP server functionality

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 NEXUS MCP Setup Verification${NC}"
echo "========================================"

# Check Node.js
echo -e "\n${YELLOW}Checking Node.js...${NC}"
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js found: $NODE_VERSION${NC}"
    
    # Check if version is adequate (v16+)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -ge 16 ]; then
        echo -e "${GREEN}✅ Node.js version is compatible (v16+)${NC}"
    else
        echo -e "${RED}❌ Node.js version is too old. Please upgrade to v16 or higher.${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Node.js not found. Please install Node.js from https://nodejs.org${NC}"
    exit 1
fi

# Check npm
echo -e "\n${YELLOW}Checking npm...${NC}"
if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✅ npm found: v$NPM_VERSION${NC}"
else
    echo -e "${RED}❌ npm not found. Please install npm.${NC}"
    exit 1
fi

# Check npx
echo -e "\n${YELLOW}Checking npx...${NC}"
if command -v npx >/dev/null 2>&1; then
    NPX_VERSION=$(npx --version)
    echo -e "${GREEN}✅ npx found: v$NPX_VERSION${NC}"
else
    echo -e "${RED}❌ npx not found. Please update npm or install npx.${NC}"
    exit 1
fi

# Test npx functionality
echo -e "\n${YELLOW}Testing npx functionality...${NC}"
if npx --help >/dev/null 2>&1; then
    echo -e "${GREEN}✅ npx is working correctly${NC}"
else
    echo -e "${RED}❌ npx is not working properly${NC}"
    exit 1
fi

# Check PATH
echo -e "\n${YELLOW}Checking PATH environment...${NC}"
if echo $PATH | grep -q "$(dirname $(which node))"; then
    echo -e "${GREEN}✅ Node.js is in PATH${NC}"
else
    echo -e "${YELLOW}⚠️ Node.js directory might not be properly in PATH${NC}"
fi

# Test MCP package availability
echo -e "\n${YELLOW}Testing MCP package availability...${NC}"
if npx --yes @modelcontextprotocol/server-filesystem --help >/dev/null 2>&1; then
    echo -e "${GREEN}✅ MCP filesystem server package is accessible${NC}"
else
    echo -e "${RED}❌ Cannot access MCP filesystem server package${NC}"
    echo -e "${YELLOW}This might be due to network restrictions or package registry issues.${NC}"
fi

# Check permissions
echo -e "\n${YELLOW}Checking permissions...${NC}"
if npm config get prefix >/dev/null 2>&1; then
    PREFIX=$(npm config get prefix)
    echo -e "${GREEN}✅ npm prefix: $PREFIX${NC}"
    
    if [ -w "$PREFIX" ] || [ -w "$HOME/.npm" ]; then
        echo -e "${GREEN}✅ npm has write permissions${NC}"
    else
        echo -e "${YELLOW}⚠️ npm might not have write permissions. Consider using 'npm config set prefix ~/.npm'${NC}"
    fi
else
    echo -e "${RED}❌ Cannot determine npm configuration${NC}"
fi

echo -e "\n${GREEN}🎉 MCP setup verification completed!${NC}"
echo -e "${BLUE}If you encountered any issues, please refer to the troubleshooting guide.${NC}" 