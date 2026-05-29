# HarnessKit CLI installer for Windows — downloads the latest `hk` binary
# to ~/.local/bin. Re-run to update to the latest version.
#
# Usage:
#   irm https://raw.githubusercontent.com/RealZST/HarnessKit/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

# Ensure TLS 1.2 (required by GitHub, not default on PowerShell 5.1)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo = "RealZST/HarnessKit"
$Binary = "hk-cli-windows-x64.exe"
$InstallDir = Join-Path $env:USERPROFILE ".local\bin"

# Get latest release tag
$Headers = @{ "User-Agent" = "HarnessKit-Installer" }
$Release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest" -Headers $Headers
$Tag = $Release.tag_name
if (-not $Tag) {
    Write-Error "Failed to fetch latest release"
    exit 1
}

$Url = "https://github.com/$Repo/releases/download/$Tag/$Binary"
$ChecksumUrl = "$Url.sha256"

Write-Host "Installing HarnessKit CLI $Tag..."

# Download and verify
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$OutPath = Join-Path $InstallDir "hk.exe"
$TempPath = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
$ChecksumPath = "$TempPath.sha256"
Invoke-WebRequest -Uri $Url -OutFile $TempPath -UseBasicParsing
Invoke-WebRequest -Uri $ChecksumUrl -OutFile $ChecksumPath -UseBasicParsing
$ExpectedHash = ((Get-Content $ChecksumPath -Raw).Trim() -split "\s+")[0].ToLowerInvariant()
if (-not $ExpectedHash) {
    Write-Error "Release checksum is empty"
    exit 1
}
$ActualHash = (Get-FileHash -Algorithm SHA256 $TempPath).Hash.ToLowerInvariant()
if ($ActualHash -ne $ExpectedHash) {
    Remove-Item -Force $TempPath, $ChecksumPath -ErrorAction SilentlyContinue
    Write-Error "Checksum verification failed for $Binary"
    exit 1
}
Move-Item -Force $TempPath $OutPath
Remove-Item -Force $ChecksumPath -ErrorAction SilentlyContinue

Write-Host "Installed hk to $OutPath"

# Add to PATH if needed
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$InstallDir;$UserPath", "User")
    Write-Host "Added $InstallDir to your PATH."
    Write-Host ""
    Write-Host "Restart your terminal for PATH changes to take effect."
}

Write-Host ""
Write-Host "Verify with: hk status"
