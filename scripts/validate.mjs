// Validates data/kpis.json after a weekly update.
// Fails (exit 1) if any metric array is misaligned with the weeks list,
// week dates are malformed/out of order, or values have the wrong type.
import { readFileSync } from "fs";

const data = JSON.parse(readFileSync("data/kpis.json", "utf8"));
const errors = [];

if (!data.updated || !/^\d{4}-\d{2}-\d{2}$/.test(data.updated)) {
  errors.push(`'updated' must be a YYYY-MM-DD date, got: ${data.updated}`);
}

const weeks = data.weeks ?? [];
weeks.forEach((w, i) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(w)) errors.push(`weeks[${i}] is not YYYY-MM-DD: ${w}`);
  if (i > 0 && weeks[i] <= weeks[i - 1]) errors.push(`weeks[${i}] (${w}) is not after weeks[${i - 1}] (${weeks[i - 1]})`);
});

for (const [key, p] of Object.entries(data.platforms ?? {})) {
  if (!p.name || !p.color) errors.push(`${key}: missing name or color`);
  for (const [metric, values] of Object.entries(p.metrics ?? {})) {
    if (!Array.isArray(values)) {
      errors.push(`${key}.${metric}: not an array`);
      continue;
    }
    if (values.length !== weeks.length) {
      errors.push(`${key}.${metric}: ${values.length} values but ${weeks.length} weeks — every metric must have one entry per week (use null for unknown)`);
    }
    values.forEach((v, i) => {
      if (v !== null && typeof v !== "number") errors.push(`${key}.${metric}[${i}]: expected number or null, got ${JSON.stringify(v)}`);
    });
  }
}

if (errors.length) {
  console.error("kpis.json validation FAILED:");
  errors.forEach(e => console.error("  - " + e));
  process.exit(1);
}
const last = weeks[weeks.length - 1];
console.log(`kpis.json OK: ${weeks.length} weeks (latest ${last}), ${Object.keys(data.platforms).length} platforms, updated ${data.updated}`);
