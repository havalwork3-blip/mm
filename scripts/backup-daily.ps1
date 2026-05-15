<#
.SYNOPSIS
  Daily backup of the POS backend database (PostgreSQL or SQLite) and optional media files.

.DESCRIPTION
  Reads `backend/.env` for DJANGO_USE_SQLITE and database settings, writes under `backups/`
  by default, and deletes old backup files past -RetentionDays.

  Schedule daily (Windows Task Scheduler):
  - Program: powershell.exe
  - Arguments: -NoProfile -ExecutionPolicy Bypass -File "FULL_PATH_TO\run-backup-daily.ps1"
  - Start in: project root (folder containing `backend`, `scripts`, and `run-backup-daily.ps1`)

  Requires on PATH when using PostgreSQL: pg_dump (PostgreSQL client tools).

.PARAMETER BackupDir
  Directory to store backups (default: `<project>/backups`).

.PARAMETER RetentionDays
  Delete backup files older than this many days (default: 7). Only files matching `mm-backup-*`.

.PARAMETER IncludeMedia
  Also archive `backend/media` (can be large; may take a while).

.EXAMPLE
  .\scripts\backup-daily.ps1
  .\scripts\backup-daily.ps1 -IncludeMedia -RetentionDays 14
#>

[CmdletBinding()]
param(
  [string] $BackupDir = "",
  [int] $RetentionDays = 7,
  [switch] $IncludeMedia
)

$ErrorActionPreference = "Stop"

function Read-DotEnv {
  param([string] $FilePath)
  $map = @{}
  if (-not (Test-Path -LiteralPath $FilePath)) { return $map }
  Get-Content -LiteralPath $FilePath -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    if ($val.Length -ge 2) {
      $q = $val[0]
      if (($q -eq '"' -or $q -eq "'") -and $val.EndsWith([string]$q)) {
        $val = $val.Substring(1, $val.Length - 2)
      }
    }
    $map[$key] = $val
  }
  $map
}

function Test-Trueish {
  param([string] $Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return $false }
  $v = $Value.Trim().ToLowerInvariant()
  return $v -eq "1" -or $v -eq "true" -or $v -eq "yes"
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $projectRoot "backend"
$envPath = Join-Path $backendDir ".env"

if (-not (Test-Path -LiteralPath $backendDir)) {
  throw "Backend folder not found: $backendDir"
}

$envMap = Read-DotEnv $envPath
$useSqlite = Test-Trueish $envMap["DJANGO_USE_SQLITE"]

if ([string]::IsNullOrWhiteSpace($BackupDir)) {
  $BackupDir = Join-Path $projectRoot "backups"
}
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$stamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
$prefix = Join-Path $BackupDir "mm-backup-$stamp"

Write-Host "Backup started at $stamp"
Write-Host "Project: $projectRoot"
Write-Host "Mode: $(if ($useSqlite) { 'SQLite' } else { 'PostgreSQL' })"

if ($useSqlite) {
  $dbFile = Join-Path $backendDir "db.sqlite3"
  if (-not (Test-Path -LiteralPath $dbFile)) {
    throw "SQLite database not found: $dbFile (enable DJANGO_USE_SQLITE and run migrations first?)"
  }
  $zipSqlite = "$prefix.sqlite.zip"
  $tempDir = Join-Path $env:TEMP "mm-backup-sqlite-$stamp"
  New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
  try {
    Copy-Item -LiteralPath $dbFile -Destination (Join-Path $tempDir "db.sqlite3") -Force
    Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $zipSqlite -Force
  }
  finally {
    Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
  }
  Write-Host "Wrote: $zipSqlite"
}
else {
  $pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
  if (-not $pgDump) {
    throw "pg_dump not found on PATH. Install PostgreSQL client tools or add their bin folder to PATH."
  }
  $db = if ($envMap["POSTGRES_DB"]) { $envMap["POSTGRES_DB"] } else { "pos_system" }
  $user = if ($envMap["POSTGRES_USER"]) { $envMap["POSTGRES_USER"] } else { "postgres" }
  $pass = if ($envMap["POSTGRES_PASSWORD"]) { $envMap["POSTGRES_PASSWORD"] } else { "postgres" }
  $pgHost = if ($envMap["POSTGRES_HOST"]) { $envMap["POSTGRES_HOST"] } else { "localhost" }
  $port = if ($envMap["POSTGRES_PORT"]) { $envMap["POSTGRES_PORT"] } else { "5432" }
  $dumpPath = "$prefix.postgres.dump"
  $oldPwd = $env:PGPASSWORD
  try {
    $env:PGPASSWORD = $pass
    & pg_dump.exe --no-owner --no-acl -h $pgHost -p $port -U $user -d $db -Fc -f $dumpPath
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }
  }
  finally {
    if ($null -eq $oldPwd) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $oldPwd }
  }
  Write-Host "Wrote: $dumpPath"
}

if ($IncludeMedia) {
  $mediaDir = Join-Path $backendDir "media"
  if (-not (Test-Path -LiteralPath $mediaDir)) {
    Write-Warning "Media folder missing, skipping: $mediaDir"
  }
  else {
    $items = @(Get-ChildItem -LiteralPath $mediaDir -Force -ErrorAction SilentlyContinue)
    if ($items.Count -eq 0) {
      Write-Warning "Media folder is empty; skipping media archive."
    }
    else {
      $zipMedia = "$prefix.media.zip"
      Compress-Archive -LiteralPath ($items | ForEach-Object { $_.FullName }) -DestinationPath $zipMedia -Force
      Write-Host "Wrote: $zipMedia"
    }
  }
}

$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -LiteralPath $BackupDir -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like "mm-backup-*" -and $_.LastWriteTime -lt $cutoff } |
  ForEach-Object {
    Write-Host "Removing old backup: $($_.FullName)"
    Remove-Item -LiteralPath $_.FullName -Force
  }

Write-Host "Backup finished OK."
