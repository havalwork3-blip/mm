$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodePath = "C:\Program Files\nodejs\node.exe"
$viteCli = Join-Path $projectRoot "frontend\node_modules\vite\bin\vite.js"

if (-not (Test-Path $nodePath)) {
  throw "Node.js was not found at $nodePath. Reinstall Node.js LTS."
}

if (-not (Test-Path $viteCli)) {
  throw "Vite CLI not found. Run npm install inside frontend first."
}

& $nodePath $viteCli
