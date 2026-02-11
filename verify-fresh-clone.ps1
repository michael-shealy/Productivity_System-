# Verify if repository is "fresh" enough for git-filter-repo
# A fresh clone should have no local commits, clean working directory, and minimal reflog

Write-Host "Checking if repository is fresh enough for git-filter-repo...`n" -ForegroundColor Cyan

$isFresh = $true
$issues = @()

# Check 1: Local commits ahead of origin
Write-Host "1. Checking for local commits..." -ForegroundColor Yellow
$localCommits = & git log origin/main..HEAD --oneline 2>&1 | Where-Object { $_ -ne "" }
if ($localCommits.Count -gt 0) {
    $isFresh = $false
    $issues += "Repository has $($localCommits.Count) local commit(s) ahead of origin/main"
    Write-Host "   ❌ Found local commits:" -ForegroundColor Red
    $localCommits | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
} else {
    Write-Host "   ✅ No local commits" -ForegroundColor Green
}

# Check 2: Uncommitted changes
Write-Host "`n2. Checking for uncommitted changes..." -ForegroundColor Yellow
$gitStatus = & git status --porcelain 2>&1
$hasUncommitted = $gitStatus | Where-Object { $_ -match "^\s*[MADRC]" }
if ($hasUncommitted) {
    $isFresh = $false
    $issues += "Repository has uncommitted changes"
    Write-Host "   ❌ Found uncommitted changes:" -ForegroundColor Red
    $hasUncommitted | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
} else {
    Write-Host "   ✅ Working directory is clean" -ForegroundColor Green
}

# Check 3: Reflog size
Write-Host "`n3. Checking reflog size..." -ForegroundColor Yellow
$reflogLines = (& git reflog 2>&1 | Measure-Object -Line).Lines
if ($reflogLines -gt 10) {
    $isFresh = $false
    $issues += "Repository has $reflogLines reflog entries (fresh clone should have very few)"
    Write-Host "   ⚠️  Found $reflogLines reflog entries (may indicate non-fresh clone)" -ForegroundColor Yellow
} else {
    Write-Host "   ✅ Reflog is minimal ($reflogLines entries)" -ForegroundColor Green
}

# Check 4: Packed refs
Write-Host "`n4. Checking for packed-refs..." -ForegroundColor Yellow
$hasPackedRefs = Test-Path .git\packed-refs
if ($hasPackedRefs) {
    Write-Host "   ✅ Has packed-refs file" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  No packed-refs file (may indicate non-fresh clone)" -ForegroundColor Yellow
}

# Summary
Write-Host "`n" + ("="*60) -ForegroundColor Cyan
if ($isFresh) {
    Write-Host "✅ Repository appears FRESH - git-filter-repo should work without --force" -ForegroundColor Green
} else {
    Write-Host "❌ Repository does NOT appear fresh" -ForegroundColor Red
    Write-Host "`nIssues found:" -ForegroundColor Yellow
    $issues | ForEach-Object { Write-Host "  • $_" -ForegroundColor White }
    Write-Host "`nOptions:" -ForegroundColor Cyan
    Write-Host "  1. Create a truly fresh clone:" -ForegroundColor White
    Write-Host "     git clone <remote-url> Productivity_System_clean" -ForegroundColor Gray
    Write-Host "  2. Use --force flag (if you have a backup):" -ForegroundColor White
    Write-Host "     git filter-repo --paths-from-file filter-repo-paths.txt --invert-paths --force" -ForegroundColor Gray
}
Write-Host ("="*60) -ForegroundColor Cyan
