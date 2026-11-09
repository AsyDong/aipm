@echo off
rem English Adventure dev startup: learning API (port 8788) + Vite dev server (port 5173).
start "English Adventure - learning API" cmd /k python "%~dp0scripts\learning_server.py"
cd /d "%~dp0"
pnpm dev
