@echo off
setlocal
set "OPERA_EXE="
for %%P in ("%LOCALAPPDATA%\Programs\Opera\opera.exe" "%LOCALAPPDATA%\Programs\Opera\launcher.exe" "%ProgramFiles%\Opera\launcher.exe" "%ProgramFiles%\Opera\opera.exe" "%ProgramFiles(x86)%\Opera\launcher.exe" "%ProgramFiles(x86)%\Opera\opera.exe") do (
  if exist "%%~P" if not defined OPERA_EXE set "OPERA_EXE=%%~P"
)
if not defined OPERA_EXE (
  echo Could not locate Opera. Edit this file and set OPERA_EXE to your Opera executable.
  pause
  exit /b 1
)
set "PROFILE=%LOCALAPPDATA%\GeedHardwinAgent\OperaProfile"
if not exist "%PROFILE%" mkdir "%PROFILE%"
echo Starting an isolated Opera profile with CDP on 127.0.0.1:9222.
echo Sign in to Geed Hardwin in this separate profile if required.
start "" "%OPERA_EXE%" --remote-debugging-port=9222 --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check "https://geed-hardwin.vercel.app/"
echo.
echo To verify CDP, open http://127.0.0.1:9222/json/version in this profile.
pause
