#!/bin/bash
# Complete Fix Script for Registration Issues

echo "🔧 COMPREHENSIVE REGISTRATION FIX"
echo "=================================="
echo ""

echo "📊 Step 1: Checking current registrations..."
node check-registrations.js
echo ""

echo "⚠️  CRITICAL ISSUES FOUND:"
echo "1. Server needs restart to load new code"
echo "2. Client needs restart to load new code"
echo "3. All 7 registrations have NULL names/emails"
echo ""

echo "✅ FIXES TO APPLY:"
echo "1. Restart backend server (loads fixed registration code)"
echo "2. Restart frontend client (loads fixed payload)"
echo "3. Test new registration"
echo ""

echo "🚀 ACTION REQUIRED:"
echo ""
echo "TERMINAL 1 - Backend:"
echo "  cd server"
echo "  npm start"
echo ""
echo "TERMINAL 2 - Frontend:"
echo "  cd client"
echo "  npm run dev"
echo ""
echo "TERMINAL 3 - Test:"
echo "  1. Open http://localhost:3000"
echo "  2. Sign in"
echo "  3. Register for any event"
echo "  4. Check: node check-registrations.js"
echo ""
echo "Expected Result: New registration should have:"
echo "  ✓ individual_name filled"
echo "  ✓ individual_email filled"
echo "  ✓ individual_register_number filled"
echo ""
