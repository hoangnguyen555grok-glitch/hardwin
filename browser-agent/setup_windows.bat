@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo Python launcher not found. Install Python 3.11 or newer first.
  pause
  exit /b 1
)
py -3.11 -m venv .venv
if errorlevel 1 (
  echo Could not create the virtual environment. Check that Python 3.11 is installed.
  pause
  exit /b 1
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 (
  echo Dependency installation failed.
  pause
  exit /b 1
)
echo.
echo Setup complete. Install Ollama separately, then run:
echo   ollama pull llama3.1:8b
echo.
echo Next: run start_opera_debug.bat, then start_assistant.bat.
pause
