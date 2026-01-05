# Supabase Integration - Authentication Only Mode

This project uses Supabase **only for authentication** and user sessions. All data operations are performed using a local SQLite database.

## Architecture Overview

- **Authentication**: Google OAuth via Supabase Auth
- **Database**: Local SQLite
- **File Storage**: Local file system
- **Security**: Application-level authorization based on user claims

## Integration Points

### Client Side
- Uses `createClientComponentClient` from Supabase only for authentication operations
- All data CRUD operations go through the server API
- File uploads use server API endpoints

### Server Side
- Verifies JWT tokens from Supabase Auth
- All data is stored and retrieved from SQLite database
- Files are stored locally in the server's filesystem

## Environment Variables

### Client (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Server (.env)
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=your_jwt_secret
```

## Important Notes

1. Do NOT use Supabase for data operations (e.g., supabase.from(...).select(), etc.)
2. Do NOT use Supabase Storage for file uploads (use the local file API routes)
3. Keep authentication flow using Supabase OAuth
4. All security checks are now handled at the application level

## Implementation Details

- JWT tokens from Supabase are verified server-side
- User permissions (is_organiser) are checked at the application level
- File uploads use multer middleware for local storage