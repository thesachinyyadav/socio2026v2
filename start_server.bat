@echo off
REM Script to start the Socio-Copy platform server

echo Starting Socio-Copy Server...
echo ==============================

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [31m❌ Node.js is not installed! Please install Node.js v18 or higher.[0m
    exit /b 1
)

REM Go to server directory
cd server

REM Install dependencies if node_modules doesn't exist
if not exist node_modules (
    echo Installing server dependencies...
    call npm install
)

REM Start the server
echo Starting server on http://localhost:8000
call npm start