// Validates data/kpi-history.json. Exit 1 on any structural problem.
// Usage: node scripts/validate.mjs
import { readFileSync } from "fs";

const d = JSON.parse(readFileSync("data/kpi-history.json", "utf8"));
const errs = [];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dow = (s) => new Date(s + "T00:00:00Z").getUTCDay();

if (!DATE.test(d.updated ?? "")) errs.push(`"updated" must be YYYY-MM-DD, got ${d.updated}`);
if (!d.platforms || typeof d.platforms !== "object") errs.push(`missing "platforms" metadata`);

const weeks = d.weeks ?? [];
weeks.forEach((w, i) => {
  if (!DATE.test(w.start) || !DATE.test(w.end)) { errs.push(`weeks[${i}] bad dates ${w.start}..${w.end}`); return; }
  if (dow(w.start) !== 1) errs.push(`weeks[${i}] start ${w.start} is not a Monday`);
  if (dow(w.end) !== 0) errs.push(`weeks[${i}] end ${w.end} is not a Sunday`);
  const span = (Date.parse(w.end) - Date.parse(w.start)) / 864e5;
  if (span !== 6) errs.push(`weeks[${i}] ${w.start}..${w.end} spans ${span} days, expected 6`);
  if (i > 0 && w.start <= weeks[i - 1].start) errs.push(`weeks[${i}] ${w.start} is not after ${weeks[i - 1].start}`);
  for (const [p, m] of Object.entries(w.platforms ?? {})) {
    if (!d.platforms?.[p]) errs.push(`weeks[${i}] unknown platform "${p}"`);
    for (const [k, v] of Object.entries(m)) {
      if (v !== null && typeof v !== "number") errs.push(`weeks[${i}] ${p}.${k} must be number|null, got ${JSON.stringify(v)}`);
    }
  }
});

if (errs.length) {
  console.error("kpi-history.json validation FAILED:");
  errs.forEach((e) => console.error("  - " + e));
  process.exit(1);
}
const last = weeks[weeks.length - 1];
console.log(`kpi-history.json OK: ${weeks.length} weeks (latest ${last.start}..${last.end}), ${Object.keys(d.platforms).length} platforms, updated ${d.updated}`);
