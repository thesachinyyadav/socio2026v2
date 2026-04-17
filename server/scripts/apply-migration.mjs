/**
 * Migration runner — tries three methods in order:
 *  1. Supabase Management API  (api.supabase.com)
 *  2. PostgREST /pg/query      (Supabase Studio internal endpoint)
 *  3. supabase-js RPC          (exec_sql function if it exists)
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SUPABASE_URL    = process.env.SUPABASE_URL;
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF     = "wvebxdbvoinylwecmisv";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ─── SQL execution methods ────────────────────────────────────────────────

async function tryManagementApi(sql) {
  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      }
    );
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true };
    return { ok: false, error: body?.message || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function tryPgQuery(sql) {
  try {
    const res = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true };
    return { ok: false, error: body?.message || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function tryRpc(sql) {
  const { error } = await supabase.rpc("exec_sql", { query: sql });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function execSql(sql) {
  let r = await tryManagementApi(sql);
  if (r.ok) return { ok: true, method: "management-api" };

  r = await tryPgQuery(sql);
  if (r.ok) return { ok: true, method: "pg-query" };

  r = await tryRpc(sql);
  if (r.ok) return { ok: true, method: "rpc" };

  return { ok: false, error: r.error };
}

// ─── bootstrap exec_sql via management API ────────────────────────────────

async function bootstrapExecSql() {
  const ddl = `
    CREATE OR REPLACE FUNCTION public.exec_sql(query text)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN EXECUTE query; END; $$;
    REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
  `;
  const r = await tryManagementApi(ddl);
  if (r.ok) console.log("  ℹ Created exec_sql helper via Management API");
  return r.ok;
}

// ─── SQL splitter (handles $$ dollar-quote blocks) ─────────────────────────

function splitStatements(sql) {
  const statements = [];
  let current = "";
  let inDollar = false;
  let tag = "";
  let i = 0;

  while (i < sql.length) {
    if (!inDollar) {
      const m = sql.slice(i).match(/^\$([A-Za-z_]*)\$/);
      if (m) { inDollar = true; tag = m[0]; current += tag; i += tag.length; continue; }
    } else if (sql.slice(i).startsWith(tag)) {
      current += tag; i += tag.length; inDollar = false; tag = ""; continue;
    }

    if (!inDollar && sql[i] === ";") {
      const t = current.trim();
      if (t) statements.push(t);
      current = ""; i++; continue;
    }
    current += sql[i++];
  }

  const tail = current.trim();
  if (tail) statements.push(tail);

  return statements.filter(s =>
    s.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").trim().length > 0
  );
}

// ─── migrations tracker ───────────────────────────────────────────────────

async function ensureMigrationsTable() {
  const ddl = `CREATE TABLE IF NOT EXISTS public.schema_migrations (
    id BIGSERIAL PRIMARY KEY, filename TEXT UNIQUE NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await execSql(ddl);
}

async function getApplied() {
  const { data } = await supabase.from("schema_migrations").select("filename");
  return new Set((data || []).map(r => r.filename));
}

async function markApplied(filename) {
  await supabase.from("schema_migrations").upsert({ filename }, { onConflict: "filename" });
}

// ─── main ─────────────────────────────────────────────────────────────────

const FILES = ["034_create_departments_table.sql"];

console.log(`\n🚀 Applying migrations → ${SUPABASE_URL}\n`);

// Probe which method works
console.log("🔍 Probing SQL execution method…");
const probe = await execSql("SELECT 1");
if (!probe.ok) {
  console.log("  ℹ Direct methods unavailable, trying to bootstrap exec_sql…");
  await bootstrapExecSql();
  const probe2 = await execSql("SELECT 1");
  if (!probe2.ok) {
    console.log(`\n❌ Cannot execute SQL via any available method.`);
    console.log(`   Please paste the migration SQL directly in the Supabase SQL editor:`);
    console.log(`   https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new\n`);
    const sql034 = readFileSync(
      path.resolve(__dirname, "../migrations/034_create_departments_table.sql"), "utf8"
    );
    console.log("─".repeat(60));
    console.log(sql034);
    console.log("─".repeat(60));
    process.exit(1);
  }
  console.log(`  ✓ Using ${probe2.method}`);
} else {
  console.log(`  ✓ Using ${probe.method}\n`);
}

await ensureMigrationsTable();
const applied = await getApplied();

for (const filename of FILES) {
  if (applied.has(filename)) {
    console.log(`⏭  ${filename} — already applied`);
    continue;
  }

  const filePath = path.resolve(__dirname, "../migrations", filename);
  const sql = readFileSync(filePath, "utf8");
  const stripped = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const statements = splitStatements(stripped);

  console.log(`📄 ${filename}  (${statements.length} statements)\n`);

  // Try full batch first
  const batch = await execSql(sql);
  if (batch.ok) {
    await markApplied(filename);
    console.log(`✅ ${filename} applied (batch)\n`);
    continue;
  }

  console.log(`  ℹ Batch mode failed — running statement-by-statement…`);
  let failed = false;
  for (let i = 0; i < statements.length; i++) {
    const s = statements[i];
    const preview = s.replace(/\s+/g, " ").slice(0, 72);
    process.stdout.write(`  [${i+1}/${statements.length}] ${preview}… `);
    const r = await execSql(s);
    if (r.ok) { console.log(`✓`); }
    else { console.log(`\n    ⚠ ${r.error}`); failed = true; }
  }

  if (!failed) {
    await markApplied(filename);
    console.log(`\n✅ ${filename} applied\n`);
  } else {
    console.log(`\n❌ ${filename} had errors\n`);
  }
}

console.log("Done.\n");
