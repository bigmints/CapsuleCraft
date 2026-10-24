<#
.SYNOPSIS
    Connects CapsuleCraft MCP server to local AI clients (Antigravity, Claude Desktop, Claude Code, Cursor).
#>

param(
    [string]$VaultPath = "",
    [string]$ExePath = "",
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   CapsuleCraft - AI Agent (MCP) Zero-Friction Setup      " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# 1. Locate Executable
if (-not $ExePath) {
    $Candidates = @(
        (Join-Path $ProjectRoot "native\target\release\capsuleos-native.exe"),
        (Join-Path $ProjectRoot "native\target\debug\capsuleos-native.exe")
    )
    foreach ($c in $Candidates) {
        if (Test-Path $c) {
            $ExePath = (Resolve-Path $c).Path
            break
        }
    }
}

if (-not $ExePath -or -not (Test-Path $ExePath)) {
    Write-Host "[!] capsuleos-native.exe not found. Building debug binary first..." -ForegroundColor Yellow
    Push-Location (Join-Path $ProjectRoot "native")
    cargo build -j 1
    Pop-Location
    $ExePath = (Resolve-Path (Join-Path $ProjectRoot "native\target\debug\capsuleos-native.exe")).Path
}

Write-Host "[+] Executable: $ExePath" -ForegroundColor Green

# 2. Locate Vault
if (-not $VaultPath) {
    $LocalVault = Join-Path $ProjectRoot "vault"
    $AppDataVault = Join-Path $env:APPDATA "com.capsuleos.app\vault"

    if (Test-Path $LocalVault) {
        $VaultPath = (Resolve-Path $LocalVault).Path
    } elseif (Test-Path $AppDataVault) {
        $VaultPath = (Resolve-Path $AppDataVault).Path
    } else {
        $VaultPath = $LocalVault
        New-Item -ItemType Directory -Path $VaultPath -Force | Out-Null
    }
} else {
    if (-not (Test-Path $VaultPath)) {
        New-Item -ItemType Directory -Path $VaultPath -Force | Out-Null
    }
    $VaultPath = (Resolve-Path $VaultPath).Path
}

Write-Host "[+] Vault Path: $VaultPath" -ForegroundColor Green
Write-Host ""

# Construct MCP Server Entry
$McpEntry = [ordered]@{
    command = $ExePath
    args = @("--mcp", $VaultPath)
}

function Update-McpConfigFile([string]$Path, [string]$ClientName) {
    Write-Host "[-] Checking $ClientName ($Path)..." -ForegroundColor White

    $Dir = Split-Path -Parent $Path
    try {
        if (-not (Test-Path $Dir)) {
            New-Item -ItemType Directory -Path $Dir -Force -ErrorAction Stop | Out-Null
        }

        $JsonObj = [ordered]@{}
        if (Test-Path $Path) {
            try {
                $Raw = Get-Content -Raw -Path $Path -Encoding UTF8
                if ($Raw.Trim()) {
                    $JsonObj = $Raw | ConvertFrom-Json -AsHashtable
                }
            } catch {
                Write-Host "    [!] Warning: Failed to parse existing JSON, keeping backup." -ForegroundColor Yellow
                Copy-Item $Path "$Path.bak" -Force
            }
        }

        if (-not $JsonObj.Contains("mcpServers")) {
            $JsonObj["mcpServers"] = [ordered]@{}
        }

        $JsonObj["mcpServers"]["capsulecraft"] = $McpEntry

        $NewContent = ($JsonObj | ConvertTo-Json -Depth 10)

        if ($DryRun) {
            Write-Host "    [DRY-RUN] Would update $Path with:" -ForegroundColor Gray
            Write-Host $NewContent -ForegroundColor DarkGray
        } else {
            Set-Content -Path $Path -Value $NewContent -Encoding UTF8
            Write-Host "    [OK] Successfully configured $ClientName!" -ForegroundColor Green
        }
    } catch {
        Write-Host "    [i] $ClientName directory not present or not writable ($($_.Exception.Message))" -ForegroundColor Gray
    }
}

# 3. Targets
# A. Claude Desktop
$ClaudeDesktopConfig = Join-Path $env:APPDATA "Claude\claude_desktop_config.json"
Update-McpConfigFile -Path $ClaudeDesktopConfig -ClientName "Claude Desktop"

# B. Cursor / Windsurf in project
$CursorConfig = Join-Path $ProjectRoot ".cursor\mcp.json"
Update-McpConfigFile -Path $CursorConfig -ClientName "Cursor (Project Workspace)"

Write-Host ""
Write-Host "--- Claude Code (CLI) Integration ---" -ForegroundColor Cyan
Write-Host "Run this command in terminal to add CapsuleCraft to Claude Code:" -ForegroundColor White
Write-Host "  claude mcp add capsulecraft '$ExePath' --mcp '$VaultPath'" -ForegroundColor Yellow
Write-Host ""

Write-Host "--- Antigravity (AGY) Integration ---" -ForegroundColor Cyan
Write-Host "Add to your Antigravity agent mcp configuration:" -ForegroundColor White
$AgySnippet = [ordered]@{
    mcpServers = [ordered]@{
        capsulecraft = [ordered]@{
            command = $ExePath
            args = @("--mcp", $VaultPath)
        }
    }
} | ConvertTo-Json -Depth 5
Write-Host $AgySnippet -ForegroundColor DarkCyan

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  CapsuleCraft MCP Server setup complete!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
