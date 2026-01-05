import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'socio-copy.db');
const db = new Database(dbPath);

try {
  console.log('=== Checking recent events in database ===');
  
  const events = db.prepare("SELECT event_id, title, created_at FROM events ORDER BY created_at DESC LIMIT 5").all();
  
  console.log('Recent events:');
  events.forEach((event, index) => {
    console.log(`${index + 1}. ID: ${event.event_id}`);
    console.log(`   Title: ${event.title}`);
    console.log(`   Created: ${event.created_at}`);
    console.log(`   ID Length: ${event.event_id.length}`);
    console.log(`   ID Type: ${typeof event.event_id}`);
    console.log('---');
  });
  
} catch (error) {
  console.error('Error checking events:', error);
} finally {
  db.close();
}