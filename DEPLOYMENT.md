# Deployment Guide - Socio-Copy Platform

This guide will help you deploy the Socio-Copy university fest platform to production.

## Prerequisites

- Supabase project set up with proper database schema
- Node.js hosting service
- Domain name (optional)

## Database Setup

### 1. Create Supabase Tables

Execute these SQL commands in your Supabase SQL editor:

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  is_organiser BOOLEAN DEFAULT false,
  course VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date DATE,
  event_time TIME,
  end_date DATE,
  venue VARCHAR(255),
  category VARCHAR(100),
  department_access TEXT[],
  claims_applicable BOOLEAN DEFAULT false,
  registration_fee DECIMAL(10,2),
  participants_per_team INTEGER,
  event_image_url TEXT,
  banner_url TEXT,
  pdf_url TEXT,
  rules JSONB,
  schedule JSONB,
  prizes TEXT[],
  organizer_email VARCHAR(255),
  organizer_phone VARCHAR(20),
  whatsapp_invite_link TEXT,
  organizing_dept VARCHAR(255),
  fest VARCHAR(255),
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  registration_deadline TIMESTAMP
);

-- Fests table
CREATE TABLE fests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fest_id VARCHAR(255) UNIQUE NOT NULL,
  fest_title VARCHAR(255) NOT NULL,
  description TEXT,
  opening_date DATE,
  closing_date DATE,
  fest_image_url TEXT,
  organizing_dept VARCHAR(255),
  department_access TEXT[],
  category VARCHAR(100),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  event_heads TEXT[],
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Registrations table
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id VARCHAR(255) UNIQUE NOT NULL,
  event_id VARCHAR(255) REFERENCES events(event_id),
  user_email VARCHAR(255),
  registration_type VARCHAR(20) CHECK (registration_type IN ('individual', 'team')),
  individual_name VARCHAR(255),
  individual_email VARCHAR(255),
  individual_register_number VARCHAR(50),
  team_name VARCHAR(255),
  team_leader_name VARCHAR(255),
  team_leader_email VARCHAR(255),
  team_leader_register_number VARCHAR(50),
  teammates JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Attendance status table
CREATE TABLE attendance_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES registrations(id),
  event_id VARCHAR(255) REFERENCES events(event_id),
  status VARCHAR(20) CHECK (status IN ('attended', 'absent')),
  marked_at TIMESTAMP,
  marked_by VARCHAR(255),
  UNIQUE(registration_id)
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(20) CHECK (type IN ('info', 'success', 'warning', 'error')),
  event_id VARCHAR(255),
  event_title VARCHAR(255),
  action_url TEXT,
  recipient_email VARCHAR(255) NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Set up Storage Buckets

Create these buckets in Supabase Storage:
- `event-images` - for event images
- `event-banners` - for event banners  
- `event-pdfs` - for event PDF files
- `fest-images` - for fest images

Make sure to set appropriate permissions for public access.

## Environment Variables

### Server (.env)
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
PORT=8000
NODE_ENV=production
```

### Client Environment Variables
For Next.js deployment, set these in your hosting platform:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_public_key
```

## Deployment Options

### General Deployment Setup

1. **Prepare for Deployment:**
   ```bash
   cd client
   npm run build
   ```
   
2. **Deploy to Your Hosting Platform:**
   - Connect your GitHub repository to your chosen hosting platform
   - Set the required environment variables
   - Configure build settings as needed
   - Deploy both client and server components

### Custom Server Setup

1. **Prepare Server:**
   ```bash
   # Install PM2 for process management
   npm install -g pm2
   
   # Build client
   cd client
   npm run build
   
   # Set up server
   cd ../server
   npm install
   ```

2. **Configure Reverse Proxy (Nginx):**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
       
       location /api {
           proxy_pass http://localhost:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

3. **Start Services:**
   ```bash
   # Start server
   cd server
   pm2 start npm --name "socio-server" -- start
   
   # Start client
   cd client
   pm2 start npm --name "socio-client" -- start
   ```

## Post-Deployment Setup

### 1. Create Admin User
- Sign up through the application
- Manually set `is_organiser = true` in the users table for admin accounts

### 2. Test Core Features
- [ ] User authentication works
- [ ] Event creation and editing
- [ ] Event registration
- [ ] Attendance marking
- [ ] Notification system
- [ ] File uploads (images, PDFs)

### 3. Configure Email/SMS (Optional)
- Set up email service for notifications
- Configure SMS service for important alerts

## Monitoring and Maintenance

### 1. Set up Monitoring
- Use analytics tools appropriate for your hosting platform
- Monitor API response times
- Set up error tracking tools (Sentry, LogRocket, etc.)

### 2. Database Maintenance
- Regular backups of Supabase data
- Monitor storage usage
- Clean up old notifications periodically

### 3. Performance Optimization
- Enable CDN for static assets
- Optimize images and files
- Monitor bundle sizes
- Set up caching where appropriate

## Security Checklist

- [ ] Environment variables are secure
- [ ] Database RLS (Row Level Security) is configured
- [ ] CORS is properly configured
- [ ] File upload limits are set
- [ ] API rate limiting is in place
- [ ] HTTPS is enabled
- [ ] Authentication tokens are secure

## Troubleshooting

### Common Issues

1. **Build Errors:**
   - Check TypeScript compilation
   - Verify all dependencies are installed
   - Ensure environment variables are set

2. **Database Connection:**
   - Verify Supabase URLs and keys
   - Check database schema is created
   - Test connection from server

3. **Authentication Issues:**
   - Verify Supabase auth settings
   - Check redirect URLs
   - Ensure email domain restrictions if any

4. **File Upload Problems:**
   - Check storage bucket permissions
   - Verify file size limits
   - Test storage bucket accessibility

## Support

For deployment issues:
1. Check application logs
2. Verify environment variables
3. Test database connections
4. Review API endpoint responses
5. Check browser developer tools for client issues

## Scaling Considerations

As your platform grows:
- Consider implementing Redis for caching
- Set up database read replicas
- Use CDN for static assets
- Implement proper logging and monitoring
- Consider microservices architecture for larger scale