@echo off
REM Script to start the Socio-Copy platform client

echo Starting Socio-Copy Client...
echo ==============================

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [31m❌ Node.js is not installed! Please install Node.js v18 or higher.[0m
    exit /b 1
)

REM Go to client directory
cd client

REM Install dependencies if node_modules doesn't exist
if not exist node_modules (
    echo Installing client dependencies...
    call npm install
)

REM Start the client
echo Starting client on http://localhost:3000
call npm run dev