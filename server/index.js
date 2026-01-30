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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase database connection
await initializeDatabase();

const app = express();
app.use(express.json());

// Simple CORS - allow everything
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
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

app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/fests", festRoutes);
app.use("/api", registrationRoutes);
app.use("/api", attendanceRoutes);
app.use("/api", notificationRoutes);
app.use("/api", uploadRoutes);
app.use("/api", contactRoutes);
app.use("/api/debug", debugRoutes);

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
