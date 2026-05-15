# Windows quick start

## 1) Installed tools
- Node.js LTS + npm
- Git for Windows
- Python venv in `backend/venv`

## 2) Environment files
- `backend/.env` created from `backend/env.example`
- `frontend/.env` created from `frontend/env.example`

## 3) Start commands (PowerShell)
- Backend: `.\run-backend.ps1`
- Frontend: `.\run-frontend.ps1`

## 4) Important note
This project path contains `&` characters, which breaks `npm run ...` on Windows CMD-based scripts.
Use the PowerShell scripts above, or move the project to a path without special characters (example: `C:\dev\m-and-m`).

## 5) Backend database
Current backend `.env` expects PostgreSQL on `localhost:5432`.
Install/start PostgreSQL and update `backend/.env` if your credentials differ.
