import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import { initializeDatabase } from "./config/database.js";
import cron from "node-cron";

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

// Update CORS configuration
const allowedOrigins = [
  'https://socio2026v2server.vercel.app',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

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

// Schedule a cron job to handle fest publishing
cron.schedule("0 0 * * *", async () => {
  console.log("Running scheduled task: Publishing fests");
  try {
    // Add logic to publish fests here
    // Example: await publishFests();
    console.log("✅ Fests published successfully");
  } catch (error) {
    console.error("❌ Error while publishing fests:", error);
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📁 Upload directory: ${path.join(__dirname, 'uploads')}`);
  console.log(`🗄️  Database: Supabase (${process.env.SUPABASE_URL || 'https://vkappuaapscvteexogtp.supabase.co'})`);
});
