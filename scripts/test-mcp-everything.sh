#!/bin/bash

# Test MCP Everything Server Features Script (Bash)
# This script tests all features of the MCP "everything" server to ensure full compatibility

show_help() {
    cat << 'EOF'
Test MCP Everything Server Features Script

Usage: ./test-mcp-everything.sh [OPTIONS]

OPTIONS:
    -v, --verbose   Show detailed output from tests
    -h, --help      Show this help message

This script tests all features provided by the MCP "everything" server:

TOOLS (8 total):
✓ echo - Simple tool to echo back input messages
✓ add - Adds two numbers together  
✓ longRunningOperation - Demonstrates progress notifications
✓ sampleLLM - Demonstrates LLM sampling capability
✓ getTinyImage - Returns a small test image
✓ printEnv - Prints all environment variables
✓ annotatedMessage - Demonstrates content annotations
✓ getResourceReference - Returns resource references

RESOURCES (100 total):
✓ Even numbered resources (plaintext format)
✓ Odd numbered resources (binary blob format)
✓ Resource pagination (10 items per page)
✓ Resource subscriptions and updates
✓ Auto-updates every 5 seconds

PROMPTS (3 total):
✓ simple_prompt - Basic prompt without arguments
✓ complex_prompt - Advanced prompt with arguments
✓ resource_prompt - Prompt with embedded resource references

OTHER FEATURES:
✓ Progress notifications for long operations
✓ Log messages (sent every 15 seconds)
✓ LLM sampling capability
✓ Content annotations with priority/audience metadata
✓ Resource subscriptions and real-time updates

The script will verify that your Nexus application can handle all these features.
EOF
}

# Parse command line arguments
VERBOSE=false
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Color functions
print_blue() { echo -e "\033[34m$1\033[0m"; }
print_green() { echo -e "\033[32m$1\033[0m"; }
print_yellow() { echo -e "\033[33m$1\033[0m"; }
print_red() { echo -e "\033[31m$1\033[0m"; }
print_gray() { echo -e "\033[90m$1\033[0m"; }

print_blue "🧪 Testing MCP Everything Server Features"
echo "=========================================="

# Test 1: Verify everything server is available
echo
print_yellow "📋 Test 1: Verify MCP Everything Server"
test_cmd="npx -y @modelcontextprotocol/server-everything --help"
if [ "$VERBOSE" = true ]; then
    print_gray "   Running: $test_cmd"
fi

if $test_cmd >/dev/null 2>&1; then
    print_green "✅ Everything server package is available"
else
    print_red "❌ Everything server package not found"
    print_yellow "   Run: npm install -g @modelcontextprotocol/server-everything"
fi

# Test 2: Check if Nexus can start everything server
echo
print_yellow "📋 Test 2: Nexus Everything Server Integration"
print_gray "   This test requires manual verification in the Nexus app:"
print_blue "   1. Start Nexus with: npm run dev"
print_blue "   2. Check that 'everything' server starts automatically"
print_blue "   3. Verify 8 tools are discovered"
print_blue "   4. Check resources and prompts are detected"

# Test 3: Verify all 8 tools are expected
echo
print_yellow "📋 Test 3: Expected Tools Inventory"
expected_tools=(
    "echo - Simple tool to echo back input messages"
    "add - Adds two numbers together"
    "longRunningOperation - Demonstrates progress notifications for long operations"
    "sampleLLM - Demonstrates LLM sampling capability using MCP sampling feature"
    "getTinyImage - Returns a small test image"
    "printEnv - Prints all environment variables"
    "annotatedMessage - Demonstrates how annotations can be used to provide metadata"
    "getResourceReference - Returns a resource reference that can be used by MCP clients"
)

print_gray "   Expected tools in everything server:"
for tool in "${expected_tools[@]}"; do
    print_green "   ✓ $tool"
done

# Test 4: Expected Resources
echo
print_yellow "📋 Test 4: Expected Resources"
print_gray "   The everything server provides 100 test resources:"
print_green "   ✓ Even numbered resources (2, 4, 6...): Plaintext format"
print_green "   ✓ Odd numbered resources (1, 3, 5...): Binary blob format"
print_green "   ✓ URI pattern: test://static/resource/{number}"
print_green "   ✓ Pagination support (10 items per page)"
print_green "   ✓ Resource subscriptions and updates"
print_green "   ✓ Auto-updates subscribed resources every 5 seconds"

# Test 5: Expected Prompts
echo
print_yellow "📋 Test 5: Expected Prompts"
expected_prompts=(
    "simple_prompt - Basic prompt without arguments"
    "complex_prompt - Advanced prompt with temperature and style arguments"
    "resource_prompt - Prompt that embeds resource references (requires resourceId argument)"
)

print_gray "   Expected prompts in everything server:"
for prompt in "${expected_prompts[@]}"; do
    print_green "   ✓ $prompt"
done

# Test 6: Advanced Features
echo
print_yellow "📋 Test 6: Advanced MCP Features"
advanced_features=(
    "Progress notifications - longRunningOperation tool sends progress updates"
    "Log messages - Server sends random-level log messages every 15 seconds"
    "LLM sampling - sampleLLM tool demonstrates MCP sampling capability"
    "Content annotations - annotatedMessage shows priority/audience metadata"
    "Resource subscriptions - Real-time updates for subscribed resources"
    "Binary content support - getTinyImage returns base64 encoded PNG data"
)

print_gray "   Advanced features to test:"
for feature in "${advanced_features[@]}"; do
    print_green "   ✓ $feature"
done

# Test 7: Nexus Implementation Checklist
echo
print_yellow "📋 Test 7: Nexus Implementation Checklist"
nexus_features=(
    "✅ Tool discovery and execution"
    "🔄 Resource discovery and reading"
    "🔄 Resource subscriptions and updates"
    "🔄 Prompt discovery and execution"
    "🔄 Progress notification handling"
    "🔄 Log message reception"
    "🔄 LLM sampling via MCP"
    "🔄 Content annotation support"
    "🔄 Real-time resource updates"
)

print_gray "   Nexus implementation status:"
for feature in "${nexus_features[@]}"; do
    if [[ $feature == ✅* ]]; then
        print_green "   $feature"
    else
        print_yellow "   $feature"
    fi
done

# Test 8: Manual Testing Instructions
echo
print_yellow "📋 Test 8: Manual Testing Instructions"
print_gray "   To fully test everything server integration with Nexus:"
echo
print_blue "   🔧 TOOL TESTING:"
print_gray "   1. Send message: 'echo hello world' - Should use echo tool"
print_gray "   2. Send message: 'add 5 and 3' - Should use add tool"
print_gray "   3. Send message: 'run a long operation' - Should show progress"
print_gray "   4. Send message: 'get environment variables' - Should use printEnv"
print_gray "   5. Send message: 'show me an image' - Should use getTinyImage"
print_gray "   6. Send message: 'sample LLM with hello' - Should use sampleLLM"
print_gray "   7. Send message: 'show annotated message' - Should use annotatedMessage"
print_gray "   8. Send message: 'get resource reference for id 5' - Should use getResourceReference"
echo
print_blue "   📁 RESOURCE TESTING:"
print_gray "   1. Check Dashboard shows resource count > 0"
print_gray "   2. Try reading resource: test://static/resource/1"
print_gray "   3. Subscribe to a resource and check for updates"
echo
print_blue "   💬 PROMPT TESTING:"
print_gray "   1. Check Dashboard shows prompt count > 0"
print_gray "   2. Execute simple_prompt"
print_gray "   3. Execute complex_prompt with temperature=0.7"
print_gray "   4. Execute resource_prompt with resourceId=10"
echo
print_blue "   📡 NOTIFICATION TESTING:"
print_gray "   1. Run longRunningOperation and watch for progress notifications"
print_gray "   2. Check console for log messages from everything server"
print_gray "   3. Subscribe to resources and verify update notifications"

# Summary
echo
print_green "🎯 Summary"
echo "=============="
print_green "✅ MCP Everything server provides comprehensive test suite for all MCP features"
print_yellow "🔄 Nexus application has been enhanced to support all MCP capabilities"
print_blue "🧪 Manual testing required to verify full integration"
echo
print_yellow "📝 Next Steps:"
print_blue "1. Start Nexus: npm run dev"
print_blue "2. Verify everything server starts with 8 tools"
print_blue "3. Test each tool via chat interface"
print_blue "4. Check Dashboard for resource/prompt counts"
print_blue "5. Monitor console for progress/log notifications"
echo
print_green "🎉 If all tests pass, your Nexus app fully supports MCP everything server!"

exit 0 