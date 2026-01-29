import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from 'url';
import { initializeDatabase } from "./config/database.js";

// API Routes
import userRoutes from "./routes/userRoutes.js";
import eventRoutes from "./routes/eventRoutes_secured.js";  // Using secured routes
import festRoutes from "./routes/festRoutes.js";
import registrationRoutes from "./routes/registrationRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import debugRoutes from "./routes/debugRoutes.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase database connection
await initializeDatabase();

const app = express();

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet: Set secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: false, // Let the client handle CSP
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false, // Allow cross-origin resources
}));

// Rate limiting - General API
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per 15 minutes per IP
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting - Strict for auth/sensitive endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per 15 minutes
  message: { error: 'Too many attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting - Very strict for registration (prevent spam)
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 registrations per hour per IP
  message: { error: 'Registration limit reached. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting - Contact form (prevent spam)
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 contact messages per hour
  message: { error: 'Too many messages sent. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiter to all routes
app.use(generalLimiter);

// CORS: Allow all origins (flexible for any deployment)
// Add CLIENT_URL to env if you want to restrict in production
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-user-email', 'x-user-id'],
}));

// Body parser with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'SOCIO API Server',
    status: 'running',
    version: '2.0',
    endpoints: {
      users: '/api/users',
      events: '/api/events',
      fests: '/api/fests',
      registrations: '/api/registrations',
      attendance: '/api/attendance',
      notifications: '/api/notifications',
      contact: '/api/contact',
      supportMessages: '/api/support/messages'
    }
  });
});

// Apply specific rate limiters to routes
app.use("/api/users", strictLimiter, userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/fests", festRoutes);
app.use("/api/register", registrationLimiter); // Strict limit for registrations
app.use("/api", registrationRoutes);
app.use("/api", attendanceRoutes);
app.use("/api", notificationRoutes);
app.use("/api", uploadRoutes);
app.use("/api/contact", contactLimiter); // Strict limit for contact form
app.use("/api", contactRoutes);

// Debug routes - ONLY available in development or with specific env flag
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEBUG_ROUTES === 'true') {
  app.use("/api/debug", debugRoutes);
  console.log('⚠️  Debug routes enabled');
} else {
  app.use("/api/debug", (req, res) => {
    res.status(404).json({ error: 'Debug routes disabled in production' });
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📁 Upload directory: ${path.join(__dirname, 'uploads')}`);
  console.log(`🗄️  Database: Supabase (${process.env.SUPABASE_URL || 'https://vkappuaapscvteexogtp.supabase.co'})`);
  console.log(`🔒 Security: Helmet, Rate Limiting, CORS configured`);
});
