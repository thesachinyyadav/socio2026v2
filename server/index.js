import express from "express";
import dotenv from "dotenv";
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
import chatRoutes from "./routes/chatRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import statuscheckRoutes from "./routes/statuscheckRoutes.js";
import approvalRoutes from "./routes/approvalRoutes.js";
import serviceRequestRoutes from "./routes/serviceRequestRoutes.js";
import venueRoutes from "./routes/venueRoutes.js";
import venueBookingRoutes from "./routes/venueBookingRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import hodAnalyticsRoutes from "./routes/hodAnalyticsRoutes.js";
import deanAnalyticsRoutes from "./routes/deanAnalyticsRoutes.js";
import cateringRoutes from "./routes/cateringRoutes.js";
import stallBookingRoutes from "./routes/stallBookingRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import volunteerRoutes from "./routes/volunteerRoutes.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase database connection (don't block startup)
initializeDatabase().catch(err => {
  console.error('Database initialization warning:', err.message);
});

const app = express();
app.use(express.json());

// Prevent stale API payloads from being cached by browsers or intermediary caches.
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

const DEFAULT_ALLOWED_ORIGINS = [
  'https://socio.christuniversity.in',
  'https://sociov2.vercel.app',
  'https://sociodev.vercel.app',
  'https://live.withsocio.com',
  'https://gated.withsocio.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const DEFAULT_ALLOWED_ORIGIN_PATTERNS = [
  '^https://.*\\.vercel\\.app$',
  '^https://.*\\.christuniversity\\.in$'
];

const parseCsvEnv = (value) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const compileOriginPatterns = (patterns) => {
  const compiled = [];

  for (const pattern of patterns) {
    try {
      compiled.push(new RegExp(pattern));
    } catch (error) {
      console.error(`Invalid ALLOWED_ORIGIN_PATTERNS entry skipped: ${pattern}`);
    }
  }

  return compiled;
};

// CORS - allow explicit origins plus vetted wildcard patterns
const ALLOWED_ORIGINS = Array.from(
  new Set([
    ...DEFAULT_ALLOWED_ORIGINS,
    ...parseCsvEnv(process.env.ALLOWED_ORIGINS)
  ])
);

const ALLOWED_ORIGIN_PATTERNS = compileOriginPatterns([
  ...DEFAULT_ALLOWED_ORIGIN_PATTERNS,
  ...parseCsvEnv(process.env.ALLOWED_ORIGIN_PATTERNS)
]);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((regex) => regex.test(origin));
};

const setCorsHeaders = (req, res) => {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin');
  } else if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Email, Accept, Origin');
};

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!isOriginAllowed(origin)) {
    return res.status(403).json({ error: 'CORS origin not allowed' });
  }
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve public files (Google verification, robots.txt, etc.)
app.use(express.static(path.join(__dirname, '../public')));

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'SOCIO API Server',
    status: 'running',
    version: '2.0.1',
    timestamp: new Date().toISOString(),
    endpoints: {
      users: '/api/users',
      events: '/api/events',
      fests: '/api/fests',
      registrations: '/api/registrations',
      attendance: '/api/attendance',
      notifications: '/api/notifications',
      contact: '/api/contact',
      supportMessages: '/api/support/messages',
      chat: '/api/chat',
      report: '/api/report',
      analytics: '/api/analytics/*'
    }
  });
});

app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/fests", festRoutes);
app.use("/api", registrationRoutes);
app.use("/api", attendanceRoutes);
app.use("/api", notificationRoutes);
app.use("/api", uploadRoutes);
app.use("/api", contactRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api", reportRoutes);
app.use("/api", approvalRoutes);
app.use("/api", serviceRequestRoutes);
app.use("/api", venueRoutes);
app.use("/api", venueBookingRoutes);
app.use("/api", cateringRoutes);
app.use("/api", stallBookingRoutes);
app.use("/api", feedbackRoutes);
app.use("/api/statuscheck", statuscheckRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/hod-analytics", hodAnalyticsRoutes);
app.use("/api/dean-analytics", deanAnalyticsRoutes);
app.use("/api/volunteer", volunteerRoutes);

// Global error handler - ensures CORS headers are always sent
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  setCorsHeaders(req, res);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

const PORT = process.env.PORT || 8000;
const isVercelRuntime = process.env.VERCEL === '1';

if (!isVercelRuntime) {
  app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
    console.log(`📁 Upload directory: ${path.join(__dirname, 'uploads')}`);
    console.log(`🗄️  Database: Supabase (${process.env.SUPABASE_URL || 'https://vkappuaapscvteexogtp.supabase.co'})`);
  });
}

export default app;
