#!/bin/bash

# Script to start the Socio-Copy platform client

echo "Starting Socio-Copy Client..."
echo "=============================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed! Please install Node.js v18 or higher."
    exit 1
fi

# Go to client directory
cd client

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing client dependencies..."
    npm install
fi

# Start the client
echo "Starting client on http://localhost:3000"
npm run dev