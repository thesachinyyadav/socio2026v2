#!/usr/bin/env node

import fs from "fs";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import { Client } from "pg";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(SERVER_ROOT, "migrations");
const LOCK_KEY = "socio_db_migrations_lock";

function getConnectionString() {
  return (
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    null
  );
}

function getDbClient() {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error(
      "Missing SUPABASE_DB_URL (or DATABASE_URL). Add it to server/.env before running migrations."
    );
  }

  const useSsl = (process.env.DB_SSL || "true").toLowerCase() !== "false";
  return new Client({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });
}

function ensureMigrationsDir() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  }
}

function getMigrationFiles() {
  ensureMigrationsDir();
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

function checksum(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function sanitizeMigrationName(name) {
  return (name || "new_migration")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function timestamp() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const h = String(now.getUTCHours()).padStart(2, "0");
  const mi = String(now.getUTCMinutes()).padStart(2, "0");
  const s = String(now.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}${h}${mi}${s}`;
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function lock(client) {
  await client.query("SELECT pg_advisory_lock(hashtext($1));", [LOCK_KEY]);
}

async function unlock(client) {
  await client.query("SELECT pg_advisory_unlock(hashtext($1));", [LOCK_KEY]);
}

async function getAppliedMigrations(client) {
  const res = await client.query(
    "SELECT filename, checksum, applied_at FROM public.schema_migrations ORDER BY filename ASC;"
  );
  const map = new Map();
  for (const row of res.rows) {
    map.set(row.filename, row);
  }
  return map;
}

async function runStatus(client) {
  const files = getMigrationFiles();
  const applied = await getAppliedMigrations(client);

  if (files.length === 0) {
    console.log("No migration files found in server/migrations.");
    return;
  }

  console.log("Migration status:\n");
  for (const file of files) {
    const fullPath = path.join(MIGRATIONS_DIR, file);
    const fileChecksum = checksum(fs.readFileSync(fullPath, "utf8"));
    const appliedRow = applied.get(file);
    if (!appliedRow) {
      console.log(`[PENDING] ${file}`);
      continue;
    }
    const changed = appliedRow.checksum !== fileChecksum ? " (checksum mismatch)" : "";
    console.log(`[APPLIED] ${file} @ ${appliedRow.applied_at}${changed}`);
  }
}

async function runUp(client) {
  const files = getMigrationFiles();
  if (files.length === 0) {
    console.log("No migration files to apply.");
    return;
  }

  const applied = await getAppliedMigrations(client);
  const pending = files.filter((file) => !applied.has(file));

  if (pending.length === 0) {
    console.log("No pending migrations.");
    return;
  }

  for (const file of pending) {
    const fullPath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(fullPath, "utf8");
    const fileChecksum = checksum(sql);

    console.log(`Applying migration: ${file}`);

    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO public.schema_migrations (filename, checksum) VALUES ($1, $2);",
        [file, fileChecksum]
      );
      await client.query("COMMIT");
      console.log(`Applied: ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Failed migration ${file}: ${error.message}`);
    }
  }
}

function runCreate(nameArg) {
  ensureMigrationsDir();

  const name = sanitizeMigrationName(nameArg);
  const fileName = `${timestamp()}_${name}.sql`;
  const fullPath = path.join(MIGRATIONS_DIR, fileName);

  const template = `-- Migration: ${fileName}
-- Created at: ${new Date().toISOString()}

-- Write forward-only SQL here.
-- Example:
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS example_column TEXT;
`;

  fs.writeFileSync(fullPath, template, "utf8");
  console.log(`Created migration: server/migrations/${fileName}`);
}

async function main() {
  const command = (process.argv[2] || "up").toLowerCase();
  const commandArg = process.argv[3];

  if (command === "create") {
    runCreate(commandArg);
    return;
  }

  const client = getDbClient();
  await client.connect();

  try {
    await ensureMigrationsTable(client);
    await lock(client);

    if (command === "status") {
      await runStatus(client);
    } else if (command === "up") {
      await runUp(client);
      await runStatus(client);
    } else {
      throw new Error(`Unsupported command: ${command}. Use: up | status | create <name>`);
    }
  } finally {
    try {
      await unlock(client);
    } catch {
      // ignore unlock errors
    }
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
