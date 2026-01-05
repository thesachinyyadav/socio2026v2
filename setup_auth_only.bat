@echo off
echo Supabase to SQLite + Supabase Auth Only Transition Script
echo =========================================================
echo.
echo This script will help transition the application to use SQLite for data
echo and keep Supabase only for authentication.
echo.

REM Create uploads directories if they don't exist
echo Creating upload directories...
if not exist server\uploads\fest-images mkdir server\uploads\fest-images
if not exist server\uploads\event-images mkdir server\uploads\event-images
if not exist server\uploads\profile-images mkdir server\uploads\profile-images
echo ✅ Upload directories created
echo.

REM Ensure environment variables are set
echo Checking environment variables...
if not exist client\.env.local (
  echo ⚠️ client\.env.local not found. Creating template...
  copy client\.env.example client\.env.local
  echo Please edit client\.env.local to add your Supabase Auth credentials
)

if not exist server\.env (
  echo ⚠️ server\.env not found. Creating template...
  copy server\.env.example server\.env
  echo Please edit server\.env to add your Supabase Auth verification credentials
)
echo ✅ Environment templates prepared
echo.

REM Install dependencies
echo Installing server dependencies...
cd server
call npm install
cd ..

echo Installing client dependencies...
cd client
call npm install
cd ..

echo ✅ Dependencies installed
echo.

echo Transition complete! Please remember to:
echo 1. Configure your Supabase Auth credentials in both .env files
echo 2. Ensure the SQLite database is properly initialized
echo 3. Read SUPABASE_AUTH_ONLY.md for more information
echo.
echo You can now run the application with:
echo - Client: cd client ^&^& npm run dev
echo - Server: cd server ^&^& npm start