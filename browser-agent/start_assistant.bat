@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Run setup_windows.bat first.
  pause
  exit /b 1
)
if not exist ".env" (
  echo Run setup_windows.bat first so .env is created.
  pause
  exit /b 1
)
call .venv\Scripts\activate.bat
echo Make sure start_model_gateway.bat and start_opera_debug.bat are running.
echo Starting the local agent UI at http://127.0.0.1:8765
python assistant_app.py
pause
