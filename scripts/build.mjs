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
const known = {}; // carry-forward audience per platform
const audienceSeries = d.weeks.map((w) => {
  for (const key of Object.keys(d.platforms)) {
    const v = w.platforms[key]?.[PRIMARY[key] ?? "followers"];
    if (v != null) known[key] = { value: v, asOf: w.start };
  }
  return { start: w.start, end: w.end, total: Object.values(known).reduce((a, x) => a + x.value, 0) };
});
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
