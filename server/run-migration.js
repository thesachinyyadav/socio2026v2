import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("run-migration.js is deprecated. Running new migration pipeline...");

const runnerPath = path.join(__dirname, "scripts", "migrate.js");
const result = spawnSync(process.execPath, [runnerPath, "up"], { stdio: "inherit" });

process.exit(result.status ?? 1);
