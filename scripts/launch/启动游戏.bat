@echo off
rem HuoRenGan 2079 Windows launcher: local static server + Chrome app window.
rem Usage: double-click, or pass "?auto=1" / "?dev=1" as first argument.
cd /d "%~dp0..\.."
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install Node.js 20.19 or newer from https://nodejs.org/
  pause
  exit /b 1
)
start "hrg2079-server" /min node scripts\serve.mjs
ping -n 3 127.0.0.1 >nul
set CHROME="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
start "" %CHROME% --app="http://127.0.0.1:2079/index.html%~1" --start-fullscreen --autoplay-policy=no-user-gesture-required
echo Game: http://127.0.0.1:2079/index.html
