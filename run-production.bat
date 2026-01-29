@echo off
setlocal

where npm >nul 2>nul
if errorlevel 1 (
  echo npm not found. Install Node.js from https://nodejs.org and try again.
  pause
  exit /b 1
)

echo Installing dependencies...
call npm install
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)

echo Building for production...
call npm run build
if errorlevel 1 (
  echo npm run build failed.
  pause
  exit /b 1
)

echo Starting production preview server...
call npm run preview
pause
