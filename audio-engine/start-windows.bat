@echo off
setlocal
cd /d "%~dp0"
title Geed Hardwin - Local Voice Engine

echo.
echo ============================================
echo   GEED HARDWIN - LOCAL VOICE ENGINE
echo   VieNeu-TTS v3 Turbo (Apache-2.0)
echo ============================================
echo.
echo This service runs on this computer only.
echo First start downloads the model files once.
echo.

where py >nul 2>nul
if errorlevel 1 (
  echo Python Launcher was not found. Install Python 3.10 or newer first.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo [1/3] Creating the Python environment...
  py -3 -m venv .venv
  if errorlevel 1 (
    echo Could not create the environment. Check your Python installation.
    pause
    exit /b 1
  )
)

echo [2/3] Installing or checking required packages...
".venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 (
  echo Could not update pip.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
  echo Package installation failed.
  pause
  exit /b 1
)

echo.
echo [3/3] Configure the Geed website origin.
echo Example: https://your-project.pages.dev
echo Enter only scheme and host; do not include /audio.html.
set /p GEED_AUDIO_ORIGINS=Geed website origin: 
if "%GEED_AUDIO_ORIGINS%"=="" (
  echo An exact website origin is required for browser security.
  pause
  exit /b 1
)

set HOST=127.0.0.1
set PORT=8000
echo.
echo Starting local speech service at http://127.0.0.1:8000
echo Keep this window open while generating voices. Press Ctrl+C to stop.
echo.
".venv\Scripts\python.exe" server.py
pause
