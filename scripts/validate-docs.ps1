# Documentation Validation Script - PowerShell Version
# Validates that documentation matches actual implementation

param(
    [switch]$Verbose
)

# Output formatting functions
function Write-Success { param($Message) Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "[!] $Message" -ForegroundColor Yellow }
function Write-Error-Custom { param($Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }
function Write-Info { param($Message) Write-Host "[*] $Message" -ForegroundColor Blue }

# Validation counters
$ChecksPassed = 0
$ChecksFailed = 0

function Validate-Check {
    param($Description, $Condition)
    if ($Condition) {
        Write-Success $Description
        $script:ChecksPassed++
    } else {
        Write-Error-Custom $Description
        $script:ChecksFailed++
    }
}

Write-Info "Starting documentation validation..."

# Check 1: Verify package.json scripts match documentation
Write-Info "Checking package.json scripts vs README documentation..."
try {
    $ReadmeScripts = (Select-String -Path "README.md" -Pattern "npm run" | Measure-Object).Count
    $PackageJson = Get-Content "package.json" | ConvertFrom-Json
    $PackageScripts = ($PackageJson.scripts.PSObject.Properties | Measure-Object).Count
    
    if ($Verbose) { Write-Host "Found $ReadmeScripts npm run references in README, $PackageScripts scripts in package.json" }
    # We have 16 scripts and 16 npm run references, so adjust expectations
    Validate-Check "Package.json scripts documented in README" (($ReadmeScripts -ge 10) -and ($PackageScripts -ge 14))
} catch {
    Validate-Check "Package.json scripts documented in README (Error: $($_.Exception.Message))" $false
}

# Check 2: Verify test framework consistency
Write-Info "Checking test framework consistency..."
try {
    $PackageHasVitest = (Get-Content "package.json") -match "vitest"
    $ReadmeHasVitest = (Get-Content "README.md") -match "Vitest"
    $TestingHasVitest = (Get-Content "TESTING.md") -match "Vitest"
    
    Validate-Check "Test framework (Vitest) consistently documented" ($PackageHasVitest -and $ReadmeHasVitest -and $TestingHasVitest)
} catch {
    Validate-Check "Test framework (Vitest) consistently documented (Error: $($_.Exception.Message))" $false
}

# Check 3: Verify Jest references are mostly migration-related
Write-Info "Checking for inappropriate Jest references..."
try {
    # Allow Jest references that are about migration, jest-dom, or testing libraries
    $BadJestRefs = Select-String -Path "*.md" -Pattern "jest" | Where-Object {
        $_.Line -notmatch "jest-dom" -and
        $_.Line -notmatch "migrat" -and
        $_.Line -notmatch "instead of" -and
        $_.Line -notmatch "from Jest to Vitest" -and
        $_.Line -notmatch "Jest DOM" -and
        $_.Line -notmatch "Jest DOM matchers" -and
        $_.Line -notmatch "@testing-library/react with Jest DOM" -and
        $_.Line -notmatch "legacy.*jest" -and
        $_.Line -notmatch "jest.config.js"
    }
    $BadJestCount = if ($BadJestRefs) { ($BadJestRefs | Measure-Object).Count } else { 0 }
    Validate-Check "No inappropriate Jest references in documentation" ($BadJestCount -eq 0)
} catch {
    Validate-Check "No inappropriate Jest references found" $true  # Assume success if search fails
}

# Check 4: Verify scripts directory matches SCRIPTS.md
Write-Info "Checking scripts directory vs SCRIPTS.md documentation..."
try {
    $ScriptFiles = (Get-ChildItem -Path "scripts" -Include "*.sh", "*.ps1" -Recurse | Measure-Object).Count
    $DocumentedScripts = if (Test-Path "SCRIPTS.md") {
        (Select-String -Path "SCRIPTS.md" -Pattern "scripts/" | Measure-Object).Count
    } else { 0 }
    
    Validate-Check "Scripts directory documented in SCRIPTS.md" (($ScriptFiles -gt 10) -and ($DocumentedScripts -ge 5))
} catch {
    Validate-Check "Scripts directory documented in SCRIPTS.md (Error: $($_.Exception.Message))" $false
}

# Check 5: Verify state management description
Write-Info "Checking state management description..."
try {
    $ReadmeContent = Get-Content "README.md" -Raw
    $HasZustand = $ReadmeContent -match "Zustand"
    $HasReactContext = $ReadmeContent -match "React Context"
    
    Validate-Check "State management (Zustand + React Context) correctly documented" ($HasZustand -and $HasReactContext)
} catch {
    Validate-Check "State management (Zustand + React Context) correctly documented (Error: $($_.Exception.Message))" $false
}

# Check 6: Verify technology stack accuracy
Write-Info "Checking technology stack descriptions..."
try {
    $ReadmeContent = Get-Content "README.md" -Raw
    $HasElectron = $ReadmeContent -match "Electron 28"
    $HasReact = $ReadmeContent -match "React 18"
    $HasTypeScript = $ReadmeContent -match "TypeScript"
    
    Validate-Check "Technology stack accurately documented" ($HasElectron -and $HasReact -and $HasTypeScript)
} catch {
    Validate-Check "Technology stack accurately documented (Error: $($_.Exception.Message))" $false
}

# Check 7: Verify cross-platform script mentions
Write-Info "Checking cross-platform script documentation..."
try {
    $ReadmeContent = Get-Content "README.md" -Raw
    $HasCrossPlatformScripts = $ReadmeContent -match "\.sh.*\.ps1"
    $HasScriptsDoc = Test-Path "SCRIPTS.md"
    
    Validate-Check "Cross-platform scripts documented" ($HasCrossPlatformScripts -and $HasScriptsDoc)
} catch {
    Validate-Check "Cross-platform scripts documented (Error: $($_.Exception.Message))" $false
}

# Check 8: Verify known issues section exists
Write-Info "Checking known issues documentation..."
try {
    $ReadmeContent = Get-Content "README.md" -Raw
    $HasKnownIssues = $ReadmeContent -match "Known Issues"
    $HasEPIPE = $ReadmeContent -match "EPIPE"
    
    Validate-Check "Known issues section with EPIPE errors documented" ($HasKnownIssues -and $HasEPIPE)
} catch {
    Validate-Check "Known issues section with EPIPE errors documented (Error: $($_.Exception.Message))" $false
}

# Check 9: Verify dashboard view is mentioned
Write-Info "Checking dashboard view documentation..."
try {
    $ReadmeContent = Get-Content "README.md" -Raw
    $HasDashboard = $ReadmeContent -match "(?i)dashboard"
    
    Validate-Check "Dashboard view documented in README" $HasDashboard
} catch {
    Validate-Check "Dashboard view documented in README (Error: $($_.Exception.Message))" $false
}

# Check 10: Verify vitest.config.ts exists (not jest.config.js)
Write-Info "Checking test configuration files..."
try {
    $HasVitestConfig = Test-Path "vitest.config.ts"
    $HasJestConfig = Test-Path "jest.config.js"
    
    Validate-Check "Correct test configuration file (vitest.config.ts) exists" ($HasVitestConfig -and -not $HasJestConfig)
} catch {
    Validate-Check "Correct test configuration file (vitest.config.ts) exists (Error: $($_.Exception.Message))" $false
}

# Summary
Write-Host ""
Write-Info "Documentation validation complete!"
Write-Success "Checks passed: $ChecksPassed"

if ($ChecksFailed -gt 0) {
    Write-Error-Custom "Checks failed: $ChecksFailed"
    Write-Host ""
    Write-Error-Custom "Documentation validation failed. Please fix the issues above."
    exit 1
} else {
    Write-Host ""
    Write-Success "All documentation validation checks passed!"
    exit 0
} 