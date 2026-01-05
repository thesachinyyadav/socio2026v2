#!/bin/bash

# Script to transition from Supabase to SQLite + Supabase Auth Only

echo "Supabase to SQLite + Supabase Auth Only Transition Script"
echo "========================================================="
echo ""
echo "This script will help transition the application to use SQLite for data"
echo "and keep Supabase only for authentication."
echo ""

# Create uploads directories if they don't exist
echo "Creating upload directories..."
mkdir -p server/uploads/fest-images
mkdir -p server/uploads/event-images
mkdir -p server/uploads/profile-images
echo "✅ Upload directories created"
echo ""

# Ensure environment variables are set
echo "Checking environment variables..."
if [ ! -f client/.env.local ]; then
  echo "⚠️ client/.env.local not found. Creating template..."
  cp client/.env.example client/.env.local
  echo "Please edit client/.env.local to add your Supabase Auth credentials"
fi

if [ ! -f server/.env ]; then
  echo "⚠️ server/.env not found. Creating template..."
  cp server/.env.example server/.env
  echo "Please edit server/.env to add your Supabase Auth verification credentials"
fi
echo "✅ Environment templates prepared"
echo ""

# Install dependencies
echo "Installing server dependencies..."
cd server
npm install
cd ..

echo "Installing client dependencies..."
cd client
npm install
cd ..

echo "✅ Dependencies installed"
echo ""

echo "Transition complete! Please remember to:"
echo "1. Configure your Supabase Auth credentials in both .env files"
echo "2. Ensure the SQLite database is properly initialized"
echo "3. Read SUPABASE_AUTH_ONLY.md for more information"
echo ""
echo "You can now run the application with:"
echo "- Client: cd client && npm run dev"
echo "- Server: cd server && npm start"