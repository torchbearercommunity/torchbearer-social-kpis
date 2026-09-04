// One-off: merge the parallel-array data/kpis.json (older project format) into
// data/kpi-history.json (week objects). Existing values in kpi-history.json win;
// legacy values only fill gaps. Prints a report of what was added and any conflicts.
// Usage: node scripts/merge-legacy-kpis.mjs
import { readFileSync, writeFileSync } from "fs";

const legacy = JSON.parse(readFileSync("data/kpis.json", "utf8"));
const hist = JSON.parse(readFileSync("data/kpi-history.json", "utf8"));

// legacy metric label -> our field name, per platform
const MAP = {
  x: { "Followers": "followers", "Verified Followers": "verifiedFollowers", "Impressions": "impressions",
       "Engagements": "engagements", "Engagement Rate %": "engagementRate", "Profile Visits": "profileVisits" },
  instagram: { "Followers": "followers", "Views": "views", "Accounts Reached": "reach",
               "Interactions": "interactions", "Profile Visits": "profileVisits" },
  bluesky: { "Followers": "followers", "Engagements": "engagements" },
  threads: { "Followers": "followers", "Views": "views", "Interactions": "interactions", "Profile Visits": "profileVisits" },
  youtube: { "Subscribers": "subscribers", "Views": "views", "Impressions": "impressions", "CTR %": "impressionsCtr" },
  substack: { "Subscribers": "subscribers", "Views": "views", "Open Rate %": "openRate" },
  tiktok: { "Followers": "followers", "Views": "views", "Engagements": "engagements", "Profile Views": "profileVisits" },
  facebook: { "Followers": "followers", "Views": "views", "Viewers": "viewers", "Interactions": "engagements" },
  linkedin: { "Followers": "followers", "Impressions": "impressions", "Engagements": "engagements", "Engagement Rate %": "engagementRate" },
};

const iso = (d) => d.toISOString().slice(0, 10);
const startOf = (weekEnding) => { const d = new Date(weekEnding + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 6); return iso(d); };

const byStart = new Map(hist.weeks.map((w) => [w.start, w]));
let added = 0, filled = 0, conflicts = [], newWeeks = [];

legacy.weeks.forEach((weekEnding, i) => {
  const start = startOf(weekEnding);
  let week = byStart.get(start);
  if (!week) {
    week = { start, end: weekEnding, platforms: {} };
    hist.weeks.push(week); byStart.set(start, week); newWeeks.push(start);
  }
  for (const [plat, p] of Object.entries(legacy.platforms)) {
    const map = MAP[plat]; if (!map) continue;
    for (const [label, values] of Object.entries(p.metrics)) {
      const field = map[label]; if (!field) { console.warn(`unmapped ${plat}.${label}`); continue; }
      const v = values[i]; if (v == null) continue;
      week.platforms[plat] ??= {};
      const cur = week.platforms[plat][field];
      if (cur == null) { week.platforms[plat][field] = v; filled++; }
      else if (cur !== v) conflicts.push(`${start} ${plat}.${field}: ours=${cur} legacy=${v} (kept ours)`);
    }
  }
});

hist.weeks.sort((a, b) => a.start.localeCompare(b.start));
// make sure every tracked platform has metadata
hist.platforms.tiktok ??= { name: "TikTok", handle: "@torchbearercommunity" };
hist.platforms.bluesky.handle ??= "jointorchbearer.bsky.social";
hist.platforms.threads.handle ??= "@torchbearercommunity";
hist.updated = iso(new Date());
writeFileSync("data/kpi-history.json", JSON.stringify(hist, null, 2) + "\n");

console.log(`weeks now: ${hist.weeks.length} (new from legacy: ${newWeeks.join(", ") || "none"})`);
console.log(`values filled from legacy: ${filled}`);
console.log(`conflicts (ours kept): ${conflicts.length}`);
conflicts.forEach((c) => console.log("  " + c));
