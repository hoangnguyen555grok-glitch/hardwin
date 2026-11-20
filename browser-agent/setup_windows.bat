@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo Python launcher not found. Install Python 3.11 or newer first.
  pause
  exit /b 1
)
py -3 -m venv .venv
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
if not exist ".env" copy ".env.example" ".env" >nul
if not exist "data" mkdir "data"
echo Setup complete.
echo 1. Edit .env and set a private LITELLM_MASTER_KEY.
echo 2. Install and start Ollama, then run: ollama pull llama3.1:8b
echo 3. Run start_model_gateway.bat in one terminal.
echo 4. Run start_opera_debug.bat in another terminal.
echo 5. Run start_assistant.bat, then open http://127.0.0.1:8765.
echo.
echo Cloud provider keys are optional; add them to .env to enable automatic fallback.
pause
