<#
  Wrapper: run from project root (same idea as run-backend.ps1).
  Schedule in Task Scheduler: powershell.exe -NoProfile -ExecutionPolicy Bypass -File "...\run-backup-daily.ps1"
#>
[CmdletBinding()]
param(
  [string] $BackupDir = "",
  [int] $RetentionDays = 7,
  [switch] $IncludeMedia
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $projectRoot "scripts\backup-daily.ps1"

if (-not (Test-Path -LiteralPath $script)) {
  throw "Backup script not found at $script."
}

& $script @PSBoundParameters
