$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runner = Join-Path $projectRoot "scripts\run-django-backend.mjs"

if (-not (Test-Path $runner)) {
  throw "Backend runner not found at $runner."
}

& node $runner
