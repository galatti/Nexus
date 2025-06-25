#!/bin/bash
# Bash script to configure UTF-8 encoding for Nexus development
# This ensures proper console output encoding on Unix-like systems

echo "[*] Configuring UTF-8 encoding for bash/zsh..."

# Set locale to UTF-8 if not already set
if [[ -z "$LC_ALL" ]] || [[ "$LC_ALL" != *"UTF-8"* ]]; then
    export LC_ALL=en_US.UTF-8
    export LANG=en_US.UTF-8
    export LANGUAGE=en_US.UTF-8
    echo "[✓] UTF-8 locale configured"
    echo "    LC_ALL: $LC_ALL"
    echo "    LANG: $LANG"
else
    echo "[✓] UTF-8 encoding already configured"
    echo "    LC_ALL: $LC_ALL"
    echo "    LANG: $LANG"
fi

# Test encoding with sample Unicode characters
echo ""
echo "[*] Testing Unicode character support:"
echo "    Checkmarks: ✓ ✔ ☑"
echo "    Arrows: → ← ↑ ↓"
echo "    Symbols: ★ ☆ ♠ ♣ ♥ ♦"
echo ""

# Check if terminal supports colors
if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && tput setaf 1 >/dev/null 2>&1; then
    GREEN=$(tput setaf 2)
    YELLOW=$(tput setaf 3)
    BLUE=$(tput setaf 4)
    MAGENTA=$(tput setaf 5)
    RESET=$(tput sgr0)
    
    echo "${BLUE}[*] Color support detected${RESET}"
    echo "${GREEN}    This is green text${RESET}"
    echo "${YELLOW}    This is yellow text${RESET}"
    echo "${MAGENTA}    This is magenta text${RESET}"
else
    echo "[*] Basic terminal detected (no color support)"
fi

echo "" 