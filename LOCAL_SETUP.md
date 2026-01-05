# 🚀 Quick Start Guide - Socio-Copy Local Setup

## What Changed?
This application has been converted from using Supabase (cloud database) to a **local SQLite database** for easy development and deployment.

## ⚡ Quick Start (Recommended)

1. **Run the setup script:**
   ```bash
   ./setup.sh
   ```

2. **Start the server (Terminal 1):**
   ```bash
   cd server
   npm run dev
   ```
   
3. **Start the client (Terminal 2):**
   ```bash
   cd client  
   npm run dev
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000

## 📁 File Locations

- **Database**: `server/data/socio-copy.db` (SQLite file)
- **Uploads**: `server/uploads/` (Images, PDFs, etc.)
- **Server Config**: `server/.env` (Port, database path)

## 🔄 Key Changes Made

### ✅ Database Migration
- ❌ Removed: Supabase PostgreSQL
- ✅ Added: SQLite with better-sqlite3
- ✅ All tables converted and working

### ✅ File Storage Migration  
- ❌ Removed: Supabase Storage buckets
- ✅ Added: Local file system storage
- ✅ Files served statically from `/uploads`

### ✅ Authentication Simplified
- ❌ Removed: Supabase Auth complexity
- ✅ Added: Simplified user management
- ✅ Ready for custom auth implementation

## 🛠️ Development Workflow

### Adding Sample Data
```bash
# Server provides APIs to create:
# - Users via POST /api/users
# - Events via POST /api/events  
# - Fests via POST /api/fests
# - Registrations via POST /api/register
```

### Database Management
```bash
# View database 
sqlite3 server/data/socio-copy.db

# Common commands:
.tables                    # List all tables
.schema events            # Show events table structure
SELECT * FROM users;      # Query users
```

### File Uploads
- Event images → `server/uploads/event-images/`
- Event banners → `server/uploads/event-banners/`
- Event PDFs → `server/uploads/event-pdfs/`
- Fest images → `server/uploads/fest-images/`

## 🚨 Troubleshooting

### Server won't start?
- Check Node.js version: `node --version` (need v18+)
- Install dependencies: `cd server && npm install`

### Database issues?
- Database is auto-created on first run
- Delete `server/data/socio-copy.db` to reset

### File upload issues?
- Upload directories are auto-created
- Check permissions on `server/uploads/`

## 🎯 Next Steps

1. **Test the APIs** using tools like Postman or curl
2. **Add sample data** through the API endpoints
3. **Customize authentication** as needed
4. **Deploy** using any Node.js hosting service

No more Supabase setup required! 🎉