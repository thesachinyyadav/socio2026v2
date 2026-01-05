# Socio-Copy University Fest Platform

A comprehensive platform for managing university fests and events, similar to "Book My Show" but specifically designed for college events.

## Features Implemented

### ✅ Core Functionality
- **Event Management**: Create, edit, and manage events and fests
- **User Authentication**: Secure login system with role-based access
- **Event Discovery**: Browse and search for events with filtering
- **Registration System**: Students can register for events

### ✅ New Features Added
- **Attendance Management**: Real-time attendance tracking for organizers
- **Notification System**: Event updates and reminders for users
- **Professional UI**: Enhanced user interface with consistent design

## User Types

### Students
- Browse and discover events
- Register for events (individual or team)
- Receive notifications about event updates
- View event details and schedules

### Organizers
- Create and manage events/fests
- Track registrations and participant data
- Mark attendance for participants
- Export attendance data as CSV
- Send notifications to participants

## Technical Stack

### Frontend
- **Next.js 15.3.1**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Responsive styling
- **React Hook Form**: Form management with validation

### Backend
- **Node.js + Express**: RESTful API server
- **SQLite**: Local database with better-sqlite3
- **File Upload**: Local file storage for images, banners, and PDFs
- **Authentication**: Supabase Auth (Google OAuth) with JWT verification

## Quick Setup

### Option 1: Automated Setup (Recommended)
```bash
# Clone the repository
git clone <repository-url>
cd socio-copy

# Run the automated setup script
./setup.sh  # or setup_auth_only.sh for auth-only Supabase mode

# Start the server (in one terminal)
cd server && npm run dev

# Start the client (in another terminal) 
cd client && npm run dev
```

> **For Windows Users**: Use `setup.bat` or `setup_auth_only.bat` instead
>
> **Note**: The `setup_auth_only.sh`/`setup_auth_only.bat` scripts will configure the application to use Supabase only for authentication and SQLite for all data. See [SUPABASE_AUTH_ONLY.md](SUPABASE_AUTH_ONLY.md) for more details.

### Option 2: Manual Setup

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Server Setup
1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   
   The server will:
   - Run on `http://localhost:8000`
   - Automatically create the SQLite database
   - Set up upload directories

### Client Setup
1. Navigate to the client directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   
   The client will run on `http://localhost:3000`

## API Endpoints

The server provides RESTful APIs for:

- **Users**: `/api/users`
- **Events**: `/api/events` 
- **Fests**: `/api/fests`
- **Registrations**: `/api/register`, `/api/registrations`
- **Attendance**: `/api/events/:eventId/participants`, `/api/events/:eventId/attendance`
- **Notifications**: `/api/notifications`

## Database Structure

The application uses SQLite with the following tables:
- **users**: User profiles and authentication
- **events**: Event details and metadata
- **fests**: Festival/competition information
- **registrations**: Event registrations (individual/team)
- **attendance_status**: Attendance tracking
- **notifications**: User notifications

## File Storage

Files are stored locally in the `server/uploads/` directory:
- `event-images/`: Event poster images
- `event-banners/`: Event banner images  
- `event-pdfs/`: Event documents and rules
- `fest-images/`: Festival poster images

## Development Commands

### Server
```bash
cd server
npm run dev    # Start development server with nodemon
npm start      # Start production server
```

### Client
```bash
cd client  
npm run dev    # Start Next.js development server
npm run build  # Build for production
npm start      # Start production build
```

## Key Features

### Attendance Management System
- **Real-time attendance tracking** with participant search and filtering
- **Attendance statistics** showing total, attended, absent, and pending counts
- **CSV export functionality** for attendance records
- **Status management** for each participant (registered/attended/absent)
- **Authorization checks** ensuring only event creators can manage attendance

### Notification System
- **Real-time notifications** with automatic polling every 30 seconds
- **Notification types** (info, success, warning, error) with appropriate icons
- **Bulk notification support** for event updates to all participants
- **Mark as read/unread functionality** with visual indicators
- **Event-specific notifications** with action URLs for direct navigation

### Professional UI/UX
- Consistent design with brand colors (#154CB3, #FFCC00)
- Responsive layout for mobile and desktop
- Loading states and error handling
- Intuitive navigation and user flows

## API Endpoints

### Core Endpoints
- `GET /api/events` - Get all events
- `POST /api/events` - Create new event
- `GET /api/fests` - Get all fests
- `POST /api/fests` - Create new fest

### Attendance Management
- `GET /api/events/:eventId/participants` - Get event participants
- `POST /api/events/:eventId/attendance` - Mark attendance
- `GET /api/events/:eventId/attendance/stats` - Get attendance statistics

### Notification System
- `GET /api/notifications` - Get user notifications
- `POST /api/notifications` - Create notification
- `POST /api/notifications/bulk` - Create bulk notifications
- `POST /api/notifications/:id/read` - Mark as read
- `DELETE /api/notifications/:id` - Delete notification

## Usage Guide

### For Organizers
1. **Create Events**: Use "Create Event" to add new events
2. **Manage Registrations**: View participant lists from event cards
3. **Mark Attendance**: Use "Mark Attendance" link to track attendance
4. **Export Data**: Download attendance records as CSV
5. **Send Notifications**: Automatic notifications for event updates

### For Students
1. **Discover Events**: Browse events on the discovery page
2. **Register**: Click events to view details and register
3. **Get Notified**: Receive notifications about event updates
4. **Track Events**: View registered events in profile

## Professional Implementation

This platform has been professionally implemented with:
- ✅ **Full TypeScript support** with proper type definitions
- ✅ **Professional UI/UX** consistent with modern web standards
- ✅ **Comprehensive error handling** and loading states
- ✅ **Secure authentication** and authorization
- ✅ **Scalable architecture** with modular components
- ✅ **Production-ready code** with proper build configuration

## Contributing

1. Follow existing code structure and patterns
2. Ensure TypeScript types are properly defined
3. Test all features before submitting
4. Follow established UI/UX guidelines
5. Document any new features or API endpoints"# socio2026v2" 
