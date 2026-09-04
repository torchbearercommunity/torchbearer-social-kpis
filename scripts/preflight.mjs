// Pre-flight for the weekly run: everything checkable without a browser.
// Prints the reporting week + mode, which platforms can be collected by API vs
// browser, and whether notifications are configured. Exits non-zero only for
// problems that make collection pointless (invalid data file).
// Usage: node scripts/preflight.mjs [--week YYYY-MM-DD]
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { loadEnv, ROOT } from "./lib/env.mjs";

const env = loadEnv();
const lines = [];
let blocking = 0;
const ok = (m) => lines.push("  OK   " + m);
const warn = (m) => lines.push("  WARN " + m);
const bad = (m) => { lines.push("  FAIL " + m); blocking++; };

// 1. data file
try {
  execSync("node scripts/validate.mjs", { cwd: ROOT, stdio: "pipe" });
  ok("data/kpi-history.json validates");
} catch (e) {
  bad("data/kpi-history.json FAILS validation:\n" + String(e.stdout || e.stderr));
}

// 2. reporting week (most recent completed Mon..Sun)
const d = JSON.parse(readFileSync(join(ROOT, "data/kpi-history.json"), "utf8"));
const iso = (x) => x.toISOString().slice(0, 10);
const today = new Date();
const lastSunday = new Date(today);
lastSunday.setDate(today.getDate() - (today.getDay() === 0 ? 7 : today.getDay()));
const monday = new Date(lastSunday);
monday.setDate(lastSunday.getDate() - 6);
const wi = process.argv.indexOf("--week");
const start = wi !== -1 ? process.argv[wi + 1] : iso(monday);
const end = (() => { const e = new Date(start + "T00:00:00Z"); e.setUTCDate(e.getUTCDate() + 6); return iso(e); })();

let mode = "new";
const existing = d.weeks.find((w) => w.start === start);
if (existing) {
  const nulls = [];
  for (const [p, m] of Object.entries(existing.platforms)) for (const [k, v] of Object.entries(m)) if (v === null) nulls.push(`${p}.${k}`);
  const missing = Object.keys(d.platforms).filter((p) => !existing.platforms[p]);
  if (!nulls.length && !missing.length) { mode = "done"; ok(`week ${start}..${end} already fully collected — nothing to do`); }
  else { mode = "retry"; warn(`week ${start}..${end} exists with gaps — RETRY MODE: fill ${nulls.length} null metric(s)` + (missing.length ? `, missing platforms: ${missing.join(", ")}` : "")); if (nulls.length) lines.push("       " + nulls.join(", ")); }
} else ok(`week ${start}..${end} not yet collected — NEW WEEK MODE`);

// 3. collectors
const api = {
  bluesky: true,
  youtube: !!env.YOUTUBE_API_KEY,
  facebook: !!(env.META_PAGE_TOKEN && env.META_PAGE_ID),
  instagram: !!(env.META_PAGE_TOKEN && env.META_PAGE_ID),
  threads: !!env.THREADS_ACCESS_TOKEN,
};
const viaApi = Object.entries(api).filter(([, v]) => v).map(([k]) => k);
const viaBrowser = Object.keys(d.platforms).filter((p) => !api[p]);
ok(`API collection enabled: ${viaApi.join(", ") || "none"}`);
warn(`browser collection required: ${viaBrowser.join(", ")} (docs/api-setup.md shrinks this list)`);

// 4. notifications
if (env.DISCORD_WEBHOOK_URL) ok("Discord webhook configured"); else warn("DISCORD_WEBHOOK_URL not set — summary will only print to console");

// 5. git
try {
  const st = execSync("git status --porcelain", { cwd: ROOT }).toString().trim();
  if (st) warn("uncommitted changes in working tree:\n       " + st.replace(/\n/g, "\n       ")); else ok("git working tree clean");
} catch { warn("git not available"); }

console.log(`Preflight — week ${start}..${end} — mode: ${mode.toUpperCase()}`);
console.log(lines.join("\n"));
console.log(blocking ? `\n${blocking} blocking problem(s).` : "\nReady. Per-domain site access is checked in the browser step of the collect-kpis skill.");
process.exit(blocking ? 1 : 0);
