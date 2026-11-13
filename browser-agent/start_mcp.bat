@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Run setup_windows.bat first.
  pause
  exit /b 1
)
call .venv\Scripts\activate.bat
echo Starting local MCP server at http://127.0.0.1:8766/mcp
echo It is loopback-only and not yet exposed to ChatGPT cloud.
python mcp_server.py
pause
