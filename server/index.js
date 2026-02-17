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
import debugRoutes from "./routes/debugRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase database connection (don't block startup)
initializeDatabase().catch(err => {
  console.error('Database initialization warning:', err.message);
});

const app = express();
app.use(express.json());

// CORS - restrict to allowed origins in production
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://socio.christuniversity.in,http://localhost:3000').split(',').map(s => s.trim());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Email');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
      chat: '/api/chat'
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
app.use("/api/debug", debugRoutes);
app.use("/api/chat", chatRoutes);

// Global error handler - ensures CORS headers are always sent
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📁 Upload directory: ${path.join(__dirname, 'uploads')}`);
  console.log(`🗄️  Database: Supabase (${process.env.SUPABASE_URL || 'https://vkappuaapscvteexogtp.supabase.co'})`);
});
