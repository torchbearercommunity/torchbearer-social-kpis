// Collect everything that can be collected WITHOUT a browser, via official APIs.
// Prints { week, collected: { platform: { metric: value } }, stillNeedBrowser, notes }.
// Platforms whose credentials are absent are skipped, not errors. Never guesses: a
// metric an API cannot provide is simply omitted so the browser step fills it.
//
// Usage: node scripts/fetch-api.mjs --week 2026-08-24 [--apply]
//   --apply   writes the collected values into data/kpi-history.json via add-week.mjs
//
// Credentials: .env.example / docs/api-setup.md. Meta and Threads rename insight
// metrics over time; on a 400 "invalid metric" see the Metric names section there.
import { execSync } from "child_process";
import { loadEnv, ROOT } from "./lib/env.mjs";

const env = loadEnv();
const wi = process.argv.indexOf("--week");
if (wi === -1) { console.error("--week YYYY-MM-DD (the week's Monday) is required"); process.exit(1); }
const start = process.argv[wi + 1];
const startMs = Date.parse(start + "T00:00:00Z");
const endMs = startMs + 7 * 864e5; // [Monday 00:00 UTC, next Monday 00:00 UTC)
const sinceSec = Math.floor(startMs / 1000), untilSec = Math.floor(endMs / 1000);
const apply = process.argv.includes("--apply");

const out = {}, notes = [], browser = [];
const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
async function getJson(url, headers = {}) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${r.status} ${url.replace(/access_token=[^&]+/, "access_token=…")}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// ---------- Bluesky (public API, no auth) ----------
try {
  const handle = env.BLUESKY_HANDLE || "jointorchbearer.bsky.social";
  const prof = await getJson(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${handle}`);
  const posts = [];
  let cursor;
  for (let i = 0; i < 5; i++) {
    const page = await getJson(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=100&filter=posts_no_replies${cursor ? "&cursor=" + cursor : ""}`);
    posts.push(...page.feed.map((f) => f.post));
    cursor = page.cursor;
    if (!cursor || posts.some((p) => Date.parse(p.indexedAt) < startMs)) break;
  }
  const inWeek = posts.filter((p) => { const t = Date.parse(p.indexedAt); return t >= startMs && t < endMs; });
  out.bluesky = {
    followers: prof.followersCount,
    engagements: sum(inWeek, (p) => (p.likeCount || 0) + (p.repostCount || 0) + (p.replyCount || 0) + (p.quoteCount || 0)),
  };
  notes.push(`bluesky: ${inWeek.length} post(s) in week, ${prof.followersCount} followers`);
} catch (e) { notes.push("bluesky FAILED: " + e.message); browser.push("bluesky"); }

// ---------- YouTube ----------
if (env.YOUTUBE_API_KEY) {
  try {
    const ch = await getJson(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${env.YOUTUBE_CHANNEL_ID}&key=${env.YOUTUBE_API_KEY}`);
    out.youtube = { subscribers: Number(ch.items[0].statistics.subscriberCount) };
    if (env.YOUTUBE_ACCESS_TOKEN) {
      const endDate = new Date(endMs - 864e5).toISOString().slice(0, 10);
      const rep = await getJson(`https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${start}&endDate=${endDate}&metrics=views,likes,comments,shares`, { authorization: `Bearer ${env.YOUTUBE_ACCESS_TOKEN}` });
      const [views = 0, likes = 0, comments = 0, shares = 0] = rep.rows?.[0] ?? [];
      Object.assign(out.youtube, { views, likes, comments, engagements: likes + comments + shares });
      browser.push("youtube (impressions, CTR — Studio only)");
    } else {
      notes.push("youtube: subscribers only; weekly views/likes/comments need YOUTUBE_ACCESS_TOKEN");
      browser.push("youtube (views, impressions, CTR, likes, comments)");
    }
  } catch (e) { notes.push("youtube FAILED: " + e.message); browser.push("youtube"); }
} else browser.push("youtube");

// ---------- Facebook + Instagram (Meta Graph API) ----------
if (env.META_PAGE_TOKEN && env.META_PAGE_ID) {
  const tok = `access_token=${env.META_PAGE_TOKEN}`;
  const g = "https://graph.facebook.com/v21.0";
  try {
    const page = await getJson(`${g}/${env.META_PAGE_ID}?fields=followers_count,instagram_business_account&${tok}`);
    out.facebook = { followers: page.followers_count };
    try {
      const ins = await getJson(`${g}/${env.META_PAGE_ID}/insights?metric=page_views_total,page_post_engagements&period=day&since=${sinceSec}&until=${untilSec}&${tok}`);
      for (const m of ins.data ?? []) {
        const v = sum(m.values ?? [], (x) => x.value);
        if (m.name === "page_views_total") out.facebook.views = v;
        if (m.name === "page_post_engagements") out.facebook.engagements = v;
      }
    } catch (e) { notes.push("facebook insights: " + e.message); }
    browser.push("facebook (viewers, views CTR)");

    const ig = page.instagram_business_account?.id;
    if (ig) {
      const prof = await getJson(`${g}/${ig}?fields=followers_count&${tok}`);
      out.instagram = { followers: prof.followers_count };
      try {
        const ins = await getJson(`${g}/${ig}/insights?metric=reach,profile_views,total_interactions,views&period=day&metric_type=total_value&since=${sinceSec}&until=${untilSec}&${tok}`);
        const field = { reach: "reach", profile_views: "profileVisits", total_interactions: "interactions", views: "views" };
        for (const m of ins.data ?? []) {
          const v = m.total_value?.value ?? sum(m.values ?? [], (x) => x.value);
          if (field[m.name]) out.instagram[field[m.name]] = v;
        }
        if (out.instagram.reach && out.instagram.interactions != null) {
          out.instagram.reachToInteractionRate = Math.round(1000 * out.instagram.interactions / out.instagram.reach) / 10;
        }
      } catch (e) { notes.push("instagram insights: " + e.message); browser.push("instagram (insights)"); }
    } else { notes.push("instagram: no instagram_business_account linked to the Page"); browser.push("instagram"); }
  } catch (e) { notes.push("meta FAILED: " + e.message); browser.push("facebook", "instagram"); }
} else browser.push("facebook", "instagram");

// ---------- Threads ----------
if (env.THREADS_ACCESS_TOKEN) {
  try {
    const t = `access_token=${env.THREADS_ACCESS_TOKEN}`;
    const ins = await getJson(`https://graph.threads.net/v1.0/me/threads_insights?metric=views,likes,replies,reposts,quotes,followers_count&since=${sinceSec}&until=${untilSec}&${t}`);
    out.threads = {};
    for (const m of ins.data ?? []) {
      const v = m.total_value?.value ?? sum(m.values ?? [], (x) => x.value);
      if (m.name === "followers_count") out.threads.followers = v;
      else if (m.name === "views") out.threads.views = v;
      else out.threads.interactions = (out.threads.interactions || 0) + v;
    }
    browser.push("threads (profile visits)");
  } catch (e) { notes.push("threads FAILED: " + e.message); browser.push("threads"); }
} else browser.push("threads");

browser.push("x", "linkedin", "substack", "tiktok");

console.log(JSON.stringify({ week: start, collected: out, stillNeedBrowser: browser, notes }, null, 2));
if (apply && Object.keys(out).length) {
  execSync(`node scripts/add-week.mjs ${start} --json ${JSON.stringify(JSON.stringify(out))}`, { cwd: ROOT, stdio: "inherit" });
}
