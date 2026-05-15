/**
 * Run Django on 0.0.0.0:8000 without shell "cd … && …" (breaks when repo path contains & on Windows).
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')
const backendDir = path.join(repoRoot, 'backend')
const managePy = path.join(backendDir, 'manage.py')

const winPython = path.join(backendDir, 'venv', 'Scripts', 'python.exe')
const unixPython = path.join(backendDir, 'venv', 'bin', 'python3')
const unixPythonAlt = path.join(backendDir, 'venv', 'bin', 'python')

let python = winPython
if (!fs.existsSync(winPython)) {
  python = fs.existsSync(unixPython) ? unixPython : unixPythonAlt
}

if (!fs.existsSync(python)) {
  console.error(
    'Backend venv not found. From the repo root run:\n' +
      '  python -m venv backend/venv\n' +
      '  backend\\venv\\Scripts\\pip install -r backend\\requirements.txt',
  )
  process.exit(1)
}

if (!fs.existsSync(managePy)) {
  console.error(`manage.py not found at ${managePy}`)
  process.exit(1)
}

const env = { ...process.env }
if (!env.DJANGO_USE_SQLITE) env.DJANGO_USE_SQLITE = 'true'

const child = spawn(python, [managePy, 'runserver', '0.0.0.0:8000'], {
  cwd: backendDir,
  env,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) process.exit(1)
  process.exit(code ?? 0)
})
