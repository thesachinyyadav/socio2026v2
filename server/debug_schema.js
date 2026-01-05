import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'socio-copy.db');
const db = new Database(dbPath);

console.log('=== USERS TABLE SCHEMA ===');
const usersColumns = db.pragma("table_info(users)");
usersColumns.forEach(col => {
  console.log(`${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
});

console.log('\n=== EVENTS TABLE SCHEMA ===');
const eventsColumns = db.pragma("table_info(events)");
eventsColumns.forEach(col => {
  console.log(`${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
});

console.log('\n=== TOTAL COLUMNS IN EVENTS TABLE ===');
console.log(`Total columns: ${eventsColumns.length}`);

db.close();