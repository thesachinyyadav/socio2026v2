# Commands to Run Socio-Copy Platform

This document provides the commands to run the Socio-Copy platform on Windows and Linux/Mac systems.

## Prerequisites

1. Make sure you have Node.js v18+ installed
2. Ensure you have set up the environment files:
   - `client/.env.local`
   - `server/.env`

## Setup Commands

### For Windows

```cmd
:: Clean up unnecessary files
cleanup_files.bat

:: Install dependencies for server
cd server
npm install
cd ..

:: Install dependencies for client
cd client
npm install
cd ..

:: Run the server (in a new terminal window)
cd server
npm start

:: Run the client (in a new terminal window)
cd client
npm run dev
```

### For Linux/Mac

```bash
# Clean up unnecessary files
chmod +x cleanup_files.sh
./cleanup_files.sh

# Install dependencies for server
cd server
npm install
cd ..

# Install dependencies for client
cd client
npm install
cd ..

# Run the server (in a new terminal window)
cd server
npm start

# Run the client (in a new terminal window)
cd client
npm run dev
```

## Accessing the Application

- **Client**: http://localhost:3000
- **Server API**: http://localhost:8000

## Authentication Note

This application uses Supabase only for authentication. All data operations use the SQLite database. Please ensure your Supabase environment variables are properly set up for authentication to work.

For more details, see [SUPABASE_AUTH_ONLY.md](SUPABASE_AUTH_ONLY.md).