#!/bin/bash

# Script to start the Socio-Copy platform server

echo "Starting Socio-Copy Server..."
echo "=============================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed! Please install Node.js v18 or higher."
    exit 1
fi

# Go to server directory
cd server

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing server dependencies..."
    npm install
fi

# Start the server
echo "Starting server on http://localhost:8000"
npm start