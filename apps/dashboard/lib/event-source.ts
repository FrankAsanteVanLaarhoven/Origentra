import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

export const EVENTS_FILE = process.env.ORIGENTRA_LIVE_EVENTS || "/tmp/origentra-live-events.jsonl";
let attempted = false;

/** Best-effort: start the real Origentra event generator if one isn't already
 *  writing the events file. Falls back silently (the route serves reference data). */
export function ensureGenerator() {
  try {
    if (existsSync(EVENTS_FILE) && Date.now() - statSync(EVENTS_FILE).mtimeMs < 4000) return; // already live
  } catch {
    /* ignore */
  }
  if (attempted) return;
  attempted = true;

  const cwd = process.cwd();
  const candidates = [
    process.env.ORIGENTRA_EVENT_SCRIPT,
    join(cwd, "apps/dashboard/scripts/event-generator.ts"),
    join(cwd, "scripts/event-generator.ts"),
  ].filter((p): p is string => !!p);
  const script = candidates.find((p) => existsSync(p));
  if (!script) {
    console.error("[origentra] event generator not found; live stream uses reference data");
    return;
  }
  try {
    const child = spawn(process.execPath, [script], { stdio: "ignore", env: process.env });
    child.on("error", () => {});
    child.unref();
    console.error("[origentra] spawned live event generator:", script);
  } catch {
    /* ignore */
  }
}
