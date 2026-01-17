import mysql from 'mysql2/promise';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbType = 'mysql'; // Default to MySQL
let pool = null;
let sqliteDb = null;

// Try to initialize MySQL first, fallback to SQLite if needed
export async function initializeDatabase() {
  console.log('🚀 Initializing database...');
  
  try {
    // Try MySQL first
    await initializeMySQL();
    dbType = 'mysql';
    console.log('✅ Using MySQL database');
  } catch (mysqlError) {
    console.warn('⚠️  MySQL connection failed:', mysqlError.message);
    console.log('🔄 Falling back to SQLite...');
    
    try {
      initializeSQLite();
      dbType = 'sqlite';
      console.log('✅ Using SQLite database (fallback)');
    } catch (sqliteError) {
      console.error('❌ Both MySQL and SQLite failed:', sqliteError.message);
      throw new Error('Database initialization failed');
    }
  }
}

async function initializeMySQL() {
  // Create connection pool
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'socio_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Test connection
  const connection = await pool.getConnection();
  await connection.ping();
  connection.release();

  // Create database if it doesn't exist
  const setupConnection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  await setupConnection.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'socio_db'}\``);
  await setupConnection.end();

  // Create MySQL tables
  await createMySQLTables();
}

function initializeSQLite() {
  const dbPath = path.join(__dirname, '..', 'data', 'socio-copy.db');
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('foreign_keys = ON');
  createSQLiteTables();
}

async function createMySQLTables() {
  // Users table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      auth_uuid VARCHAR(255) UNIQUE,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255),
      avatar_url TEXT,
      is_organiser BOOLEAN DEFAULT FALSE,
      course VARCHAR(255),
      register_number VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_email (email),
      INDEX idx_auth_uuid (auth_uuid)
    )
  `);

  // Events table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS events (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      event_id VARCHAR(255) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      event_date DATE,
      event_time TIME,
      end_date DATE,
      venue VARCHAR(255),
      category VARCHAR(100),
      department_access JSON,
      claims_applicable BOOLEAN DEFAULT FALSE,
      registration_fee DECIMAL(10,2),
      participants_per_team INTEGER,
      max_participants INTEGER,
      event_image_url TEXT,
      banner_url TEXT,
      pdf_url TEXT,
      contact_email VARCHAR(255),
      contact_phone VARCHAR(20),
      event_heads JSON,
      created_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_event_id (event_id),
      INDEX idx_category (category),
      INDEX idx_event_date (event_date)
    )
  `);

  // Other tables...
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS registrations (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      registration_id VARCHAR(255) UNIQUE NOT NULL,
      event_id VARCHAR(255),
      user_email VARCHAR(255),
      registration_type ENUM('individual', 'team'),
      individual_name VARCHAR(255),
      individual_email VARCHAR(255),
      individual_register_number VARCHAR(100),
      team_name VARCHAR(255),
      team_leader_name VARCHAR(255),
      team_leader_email VARCHAR(255),
      team_leader_register_number VARCHAR(100),
      teammates JSON,
      qr_code_data TEXT,
      qr_code_generated_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_registration_id (registration_id),
      INDEX idx_event_id (event_id),
      FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
    )
  `);

  // Attendance status table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS attendance_status (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      registration_id VARCHAR(255),
      event_id VARCHAR(255),
      status ENUM('attended', 'absent') DEFAULT 'absent',
      marked_at TIMESTAMP,
      marked_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_attendance (registration_id),
      INDEX idx_event_id (event_id),
      FOREIGN KEY (registration_id) REFERENCES registrations(registration_id) ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
    )
  `);

  console.log('✅ MySQL tables created successfully');
}

function createSQLiteTables() {
  // Users table
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      auth_uuid TEXT UNIQUE,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      avatar_url TEXT,
      is_organiser BOOLEAN DEFAULT 0,
      course TEXT,
      register_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Events table
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      event_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      event_date DATE,
      event_time TIME,
      end_date DATE,
      venue TEXT,
      category TEXT,
      department_access TEXT,
      claims_applicable BOOLEAN DEFAULT 0,
      registration_fee REAL,
      participants_per_team INTEGER,
      max_participants INTEGER,
      event_image_url TEXT,
      banner_url TEXT,
      pdf_url TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      event_heads TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Registrations table
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      registration_id TEXT UNIQUE NOT NULL,
      event_id TEXT,
      user_email TEXT,
      registration_type TEXT CHECK (registration_type IN ('individual', 'team')),
      individual_name TEXT,
      individual_email TEXT,
      individual_register_number TEXT,
      team_name TEXT,
      team_leader_name TEXT,
      team_leader_email TEXT,
      team_leader_register_number TEXT,
      teammates TEXT,
      qr_code_data TEXT,
      qr_code_generated_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(event_id)
    )
  `);

  // Attendance status table
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS attendance_status (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      registration_id TEXT,
      event_id TEXT,
      status TEXT CHECK (status IN ('attended', 'absent')),
      marked_at DATETIME,
      marked_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(registration_id),
      FOREIGN KEY (registration_id) REFERENCES registrations(registration_id),
      FOREIGN KEY (event_id) REFERENCES events(event_id)
    )
  `);

  console.log('✅ SQLite tables created successfully');
}

// Helper functions that work with both databases
export async function executeQuery(query, params = []) {
  if (dbType === 'mysql') {
    const [results] = await pool.execute(query, params);
    return results;
  } else {
    // Convert MySQL query syntax to SQLite if needed
    const sqliteQuery = query.replace(/`/g, '').replace(/JSON/gi, 'TEXT');
    const stmt = sqliteDb.prepare(sqliteQuery);
    
    if (query.trim().toUpperCase().startsWith('SELECT')) {
      return stmt.all(...params);
    } else {
      return stmt.run(...params);
    }
  }
}

export async function queryOne(query, params = []) {
  if (dbType === 'mysql') {
    const [results] = await pool.execute(query, params);
    return results[0] || null;
  } else {
    const sqliteQuery = query.replace(/`/g, '').replace(/JSON/gi, 'TEXT');
    const stmt = sqliteDb.prepare(sqliteQuery);
    return stmt.get(...params) || null;
  }
}

export async function queryAll(query, params = []) {
  if (dbType === 'mysql') {
    const [results] = await pool.execute(query, params);
    return results;
  } else {
    const sqliteQuery = query.replace(/`/g, '').replace(/JSON/gi, 'TEXT');
    const stmt = sqliteDb.prepare(sqliteQuery);
    return stmt.all(...params);
  }
}

// Function to close the connection
export async function closeDatabase() {
  try {
    if (dbType === 'mysql' && pool) {
      await pool.end();
      console.log('MySQL connection pool closed');
    } else if (dbType === 'sqlite' && sqliteDb) {
      sqliteDb.close();
      console.log('SQLite database closed');
    }
  } catch (error) {
    console.error('Error closing database:', error);
  }
}

export { dbType };
export default dbType === 'mysql' ? pool : sqliteDb;