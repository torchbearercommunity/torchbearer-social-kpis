// Inline data/kpi-history.json into src/dashboard-template.html -> index.html.
// index.html IS committed: GitHub Pages serves it straight from the repo root.
// Usage: node scripts/build.mjs
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = readFileSync(join(root, "data/kpi-history.json"), "utf8").trim();
const template = readFileSync(join(root, "src/dashboard-template.html"), "utf8");
const MARKER = "/*__DATA__*/;";
if (!template.includes(MARKER)) throw new Error("Data marker not found in template");

const TITLE = "Torchbearer Social KPIs";
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITLE}</title>
</head>
<body>
${template.replace(MARKER, data + ";")}
</body>
</html>
`;
writeFileSync(join(root, "index.html"), page);
console.log(`Built index.html (${(page.length / 1024).toFixed(0)} KB)`);

// data/summary.json — a small, stable feed for other sites (the TBC community
// dashboard) to read the headline numbers without parsing the full history.
// Contract is documented in docs/embedding.md; add fields, never rename them.
const d = JSON.parse(data);
const PRIMARY = { youtube: "subscribers", substack: "subscribers" }; // everything else: followers
const ENGAGE = { instagram: "interactions", threads: "interactions", substack: null }; // else: engagements
const latest = d.weeks[d.weeks.length - 1];
// Audience per week: a platform's value runs on a straight line between two reports
// and is carried forward after its last one (same rule as the dashboard chart).
const T = (w) => Date.parse(w.start);
const audienceSeries = d.weeks.map((w) => ({ start: w.start, end: w.end, total: 0 }));
for (const key of Object.keys(d.platforms)) {
  const metric = PRIMARY[key] ?? "followers";
  const known = d.weeks.map((w, i) => (w.platforms[key]?.[metric] != null ? i : -1)).filter((i) => i >= 0);
  d.weeks.forEach((w, i) => {
    const before = known.filter((k) => k <= i).pop(), after = known.find((k) => k >= i);
    if (before === undefined) return;
    const a = d.weeks[before].platforms[key][metric];
    if (before === i || after === undefined) { audienceSeries[i].total += a; return; }
    const b = d.weeks[after].platforms[key][metric];
    audienceSeries[i].total += Math.round(a + (b - a) * (T(w) - T(d.weeks[before])) / (T(d.weeks[after]) - T(d.weeks[before])));
  });
}
const platforms = {};
for (const [key, meta] of Object.entries(d.platforms)) {
  const metric = PRIMARY[key] ?? "followers";
  const pts = d.weeks.filter((w) => w.platforms[key]?.[metric] != null).map((w) => ({ start: w.start, value: w.platforms[key][metric] }));
  if (!pts.length) continue;
  const cur = pts[pts.length - 1], prev = pts[pts.length - 2];
  const em = key in ENGAGE ? ENGAGE[key] : "engagements";
  const ew = em ? [...d.weeks].reverse().find((w) => w.platforms[key]?.[em] != null) : null;
  platforms[key] = {
    name: meta.name, handle: meta.handle ?? null, url: meta.url ?? null,
    audience: cur.value, audienceMetric: metric, asOf: cur.start,
    change: prev ? cur.value - prev.value : null, changeSince: prev ? prev.start : null,
    weeklyEngagements: ew ? ew.platforms[key][em] : null, engagementsWeek: ew ? ew.start : null,
  };
}
const summary = {
  organization: d.organization, updated: d.updated,
  dataThrough: { start: latest.start, end: latest.end },
  totalAudience: audienceSeries[audienceSeries.length - 1].total,
  platforms, audienceSeries,
  dashboardUrl: "https://torchbearercommunity.github.io/torchbearer-social-kpis/",
};
writeFileSync(join(root, "data/summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(`Built data/summary.json (total audience ${summary.totalAudience}, through ${latest.end})`);
