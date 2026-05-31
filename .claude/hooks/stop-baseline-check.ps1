# Runs at the end of each Claude turn.
# If .ts/.tsx source files were modified, verify the test baseline hasn't regressed.

$changed = git status --porcelain 2>$null
if (-not $changed) {
    exit 0
}

$sourceChanged = $changed | Where-Object { $_ -match '\.(ts|tsx)$' }
if (-not $sourceChanged) {
    exit 0
}

Push-Location "C:\Users\jatin\code\civic-brief"
try {
    $result = & npm run test:check 2>&1
    if ($LASTEXITCODE -ne 0) {
        $output = ($result -join "`n") | Select-Object -First 50
        @{
            hookSpecificOutput = @{
                hookEventName     = "Stop"
                additionalContext = "TEST BASELINE REGRESSION: npm run test:check failed. Fix before ending this turn.`n`n$output"
            }
        } | ConvertTo-Json -Compress
        exit 2
    }
} finally {
    Pop-Location
}

exit 0
