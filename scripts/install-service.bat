@echo off
echo ============================================
echo  ONPE Auto-Scraper - Windows Service Setup
echo ============================================
echo.
echo Installing scraper as automatic Windows service...
echo This will scrape ONPE data every 30 seconds automatically.
echo.

REM Create log directory
if not exist "%~dp0logs" mkdir "%~dp0logs"

REM Install as Windows Task Scheduler task (runs every 30s)
schtasks /create /tn "ONPE-Scraper-Service" /tr "node.exe \"%~dp0scraper-service.js\"" /sc minute /mo 1 /ru %USERNAME% /f 2>nul
if %errorlevel%==0 (
    echo SUCCESS: Auto-scraping service installed!
    echo It will run every 30 seconds automatically.
    echo.
    echo To view logs: type "%~dp0logs\scraper.log"
    echo To stop: schtasks /delete /tn "ONPE-Scraper-Service" /f
    echo.
    echo Starting scraper now...
    start /B node "%~dp0scraper-service.js"
) else (
    echo Fallback: Starting scraper in background...
    start /B node "%~dp0scraper-service.js"
    echo Scraper is now running in background.
    echo To stop it, close the Node.js window or use Task Manager.
)

echo.
echo ============================================
pause
