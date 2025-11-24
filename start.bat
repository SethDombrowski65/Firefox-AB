@echo off
cd /d "%~dp0"
set PLAYWRIGHT_BROWSERS_PATH=%cd%\browsers
browser-manager.exe
pause
