import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'socio-copy.db');
const db = new Database(dbPath);

try {
  console.log('=== DETAILED EVENTS TABLE SCHEMA ===');
  
  // Get the full schema including primary key info and constraints
  const schemaInfo = db.prepare("PRAGMA table_info(events)").all();
  
  schemaInfo.forEach(col => {
    console.log(`Column: ${col.name}`);
    console.log(`  Type: ${col.type}`);
    console.log(`  NotNull: ${col.notnull}`);
    console.log(`  DefaultValue: ${col.dflt_value}`);
    console.log(`  PrimaryKey: ${col.pk}`);
    console.log('---');
  });
  
  // Check the actual CREATE TABLE statement
  console.log('\n=== CREATE TABLE STATEMENT ===');
  const createTableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='events'").get();
  console.log(createTableInfo.sql);
  
} catch (error) {
  console.error('Error checking schema:', error);
} finally {
  db.close();
}