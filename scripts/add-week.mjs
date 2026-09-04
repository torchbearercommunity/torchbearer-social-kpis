// Create or patch a week by hand — the fallback whenever automation cannot reach a platform.
// Usage:
//   node scripts/add-week.mjs 2026-08-24 x.followers=480 x.engagements=210 linkedin.impressions=260
//   node scripts/add-week.mjs 2026-08-24 --json "{\"substack\":{\"subscribers\":240,\"views\":300}}"
// The date is the week's Monday. Only the metrics you pass change; everything else is left
// alone. Values may be numbers or null. Runs validate + build afterwards.
import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { ROOT } from "./lib/env.mjs";

const [start, ...rest] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}$/.test(start ?? "")) {
  console.error("first argument must be the week's Monday as YYYY-MM-DD");
  process.exit(1);
}
const file = join(ROOT, "data/kpi-history.json");
const d = JSON.parse(readFileSync(file, "utf8"));

const patch = {};
const ji = rest.indexOf("--json");
if (ji !== -1) Object.assign(patch, JSON.parse(rest[ji + 1]));
for (const a of rest) {
  const m = a.match(/^([a-z]+)\.([A-Za-z]+)=(null|-?\d+(?:\.\d+)?)$/);
  if (m) (patch[m[1]] ??= {})[m[2]] = m[3] === "null" ? null : Number(m[3]);
}
if (!Object.keys(patch).length) {
  console.error("nothing to apply — pass platform.metric=value pairs or --json");
  process.exit(1);
}

let week = d.weeks.find((w) => w.start === start);
if (!week) {
  const e = new Date(start + "T00:00:00Z"); e.setUTCDate(e.getUTCDate() + 6);
  week = { start, end: e.toISOString().slice(0, 10), platforms: {} };
  d.weeks.push(week);
  d.weeks.sort((a, b) => a.start.localeCompare(b.start));
  console.log(`created week ${start}..${week.end}`);
}
const changes = [];
for (const [p, metrics] of Object.entries(patch)) {
  if (!d.platforms[p]) { console.error(`unknown platform "${p}" — known: ${Object.keys(d.platforms).join(", ")}`); process.exit(1); }
  week.platforms[p] ??= {};
  for (const [k, v] of Object.entries(metrics)) {
    changes.push(`${p}.${k}: ${JSON.stringify(week.platforms[p][k] ?? null)} -> ${JSON.stringify(v)}`);
    week.platforms[p][k] = v;
  }
}
d.updated = new Date().toISOString().slice(0, 10);
writeFileSync(file, JSON.stringify(d, null, 2) + "\n");
console.log(changes.join("\n"));
execSync("node scripts/validate.mjs", { cwd: ROOT, stdio: "inherit" });
execSync("node scripts/build.mjs", { cwd: ROOT, stdio: "inherit" });
console.log("Next: git add data/kpi-history.json index.html && git commit -m \"KPIs for week of " + start + "\" && git push");
