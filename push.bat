@echo off
REM Auto Git Push Script with Timestamp
cd /d "%~dp0"

REM Get current date and time
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set datetime=%datetime:~0,8%-%datetime:~8,6%

REM Add all changes
git add .

REM Commit with timestamp
git commit -m "Update %datetime%"

REM Push to main branch
git push origin main

echo.
echo ✅ Code pushed successfully with timestamp: %datetime%
pause
