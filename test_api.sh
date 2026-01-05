#!/bin/bash

echo "🧪 Testing Socio-Copy API Endpoints"

# Start server in background
echo "📡 Starting server..."
cd server && npm start &
SERVER_PID=$!

# Wait for server to start
sleep 3

echo "🔍 Testing API endpoints..."

# Test users endpoint
echo "Testing GET /api/users"
curl -s http://localhost:8000/api/users | head -c 100
echo ""

# Test events endpoint  
echo "Testing GET /api/events"
curl -s http://localhost:8000/api/events | head -c 100
echo ""

# Test fests endpoint
echo "Testing GET /api/fests" 
curl -s http://localhost:8000/api/fests | head -c 100
echo ""

# Test notifications endpoint
echo "Testing GET /api/notifications?email=test@example.com"
curl -s "http://localhost:8000/api/notifications?email=test@example.com" | head -c 100
echo ""

echo "✅ API tests completed!"

# Clean up
kill $SERVER_PID
echo "🛑 Server stopped"