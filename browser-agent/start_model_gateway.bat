@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Run setup_windows.bat first.
  pause
  exit /b 1
)
if not exist ".env" (
  echo Copy .env.example to .env and set LITELLM_MASTER_KEY first.
  pause
  exit /b 1
)
for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
  if not "%%A"=="" set "%%A=%%B"
)
call .venv\Scripts\activate.bat
echo Starting the model gateway at http://127.0.0.1:4000
echo Do not expose this port to the public Internet.
litellm --config litellm_config.yaml --host 127.0.0.1 --port 4000
pause
