#!/bin/bash
set -e

# NEXUS Production Build Script
# This script builds the NEXUS application for production deployment

# Environment setup
export NODE_ENV=production
export GENERATE_SOURCEMAP=false

# Build configuration from environment variables or defaults
BUILD_DIR=${BUILD_DIR:-"dist"}
PLATFORM=${PLATFORM:-"all"}
SKIP_TESTS=${SKIP_TESTS:-"false"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🏗️  Building NEXUS for production${NC}"
echo -e "${BLUE}Platform: $PLATFORM${NC}"
echo -e "${BLUE}Build directory: $BUILD_DIR${NC}"
echo -e "${BLUE}Skip tests: $SKIP_TESTS${NC}"

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed${NC}"
        exit 1
    fi
    
    node_version=$(node --version | sed 's/v//')
    major_version=$(echo $node_version | cut -d'.' -f1)
    
    if [ "$major_version" -lt 18 ]; then
        echo -e "${RED}❌ Node.js 18+ is required. Current version: v$node_version${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Node.js version: v$node_version${NC}"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ package.json not found. Run from project root.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Clean previous build
clean_build() {
    if [ -d "$BUILD_DIR" ]; then
        echo -e "${YELLOW}🧹 Cleaning previous build...${NC}"
        rm -rf "$BUILD_DIR"
    fi
    
    # Clean other temporary directories
    if [ -d "temp" ]; then
        rm -rf "temp"
    fi
}

# Install dependencies
install_dependencies() {
    echo -e "${YELLOW}📦 Installing production dependencies...${NC}"
    
    # Use npm ci for clean, fast, reliable installs
    npm ci --production=false
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
}

# Run tests
run_tests() {
    if [ "$SKIP_TESTS" = "false" ]; then
        echo -e "${YELLOW}🧪 Running tests...${NC}"
        
        if ! npm test; then
            echo -e "${RED}❌ Tests failed${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✅ All tests passed${NC}"
    else
        echo -e "${YELLOW}⚠️  Skipping tests as requested${NC}"
    fi
}

# Build application
build_application() {
    echo -e "${YELLOW}🔨 Building application...${NC}"
    
    if ! npm run build; then
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Application built successfully${NC}"
}

# Package for distribution
package_application() {
    echo -e "${YELLOW}📦 Packaging for platform: $PLATFORM${NC}"
    
    case $PLATFORM in
        "win"|"windows")
            npm run dist:win -- --publish=never
            ;;
        "mac"|"macos"|"darwin")
            npm run dist:mac -- --publish=never
            ;;
        "linux")
            npm run dist:linux -- --publish=never
            ;;
        "all")
            npm run dist -- --publish=never
            ;;
        *)
            echo -e "${RED}❌ Unknown platform: $PLATFORM${NC}"
            echo -e "${YELLOW}Valid platforms: win, mac, linux, all${NC}"
            exit 1
            ;;
    esac
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Packaging failed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Packaging completed successfully${NC}"
}

# Generate build info
generate_build_info() {
    echo -e "${YELLOW}📋 Generating build information...${NC}"
    
    build_info_file="$BUILD_DIR/build-info.json"
    mkdir -p "$BUILD_DIR"
    
    cat > "$build_info_file" << EOF
{
    "buildTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "platform": "$PLATFORM",
    "nodeVersion": "$(node --version)",
    "npmVersion": "$(npm --version)",
    "gitCommit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "gitBranch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')",
    "buildDirectory": "$BUILD_DIR"
}
EOF
    
    echo -e "${GREEN}✅ Build info generated: $build_info_file${NC}"
}

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}🧹 Performing cleanup...${NC}"
    
    # Remove temporary files
    if [ -d "temp" ]; then
        rm -rf "temp"
    fi
    
    # Reset environment variables if needed
    unset ELECTRON_BUILDER_CACHE
}

# Set trap for cleanup on script exit
trap cleanup EXIT INT TERM

# Main execution
main() {
    local start_time=$(date +%s)
    
    check_prerequisites
    clean_build
    install_dependencies
    run_tests
    build_application
    package_application
    generate_build_info
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo -e "\n${GREEN}🎉 Build completed successfully!${NC}"
    echo -e "${BLUE}Total build time: ${duration}s${NC}"
    echo -e "${BLUE}Build artifacts: $BUILD_DIR${NC}"
}

# Execute main function
main "$@" 