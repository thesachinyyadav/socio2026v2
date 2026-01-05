#!/bin/bash

echo "🚀 Setting up Socio-Copy Local Development Environment"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "📦 Installing server dependencies..."
cd server
npm install

echo "🗄️ Database is automatically created when server starts"

echo "📁 Creating upload directories..."
mkdir -p uploads/event-images uploads/event-banners uploads/event-pdfs uploads/fest-images

echo "⚙️ Setting up environment variables..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file from .env.example"
    echo "ℹ️ You can edit .env if needed, but defaults should work for local development"
else
    echo "ℹ️ .env file already exists"
fi

cd ..

echo "📦 Installing client dependencies..."
cd client
npm install
cd ..

echo "✅ Setup complete!"
echo ""
echo "🔥 To start the application:"
echo "   1. Start the server: cd server && npm run dev"
echo "   2. Start the client: cd client && npm run dev"
echo ""
echo "🌐 Server will run on: http://localhost:8000"
echo "🌐 Client will run on: http://localhost:3000"
echo ""
echo "📊 Database file: server/data/socio-copy.db"
echo "📁 Uploads folder: server/uploads/"