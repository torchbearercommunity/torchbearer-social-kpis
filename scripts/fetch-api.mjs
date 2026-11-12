// Collect everything that can be collected WITHOUT a browser, via official APIs.
// Prints { week, collected: { platform: { metric: value } }, stillNeedBrowser, notes }.
// Platforms whose credentials are absent are skipped, not errors. Never guesses: a
// metric an API cannot provide is simply omitted so the browser step fills it.
//
// Usage: node scripts/fetch-api.mjs [--week 2026-08-24] [--apply]
//   --week    the week's Monday. Defaults to the most recent completed Mon-Sun week (UTC).
//   --apply   writes the collected values into data/kpi-history.json via add-week.mjs
//
// Running it for an OLDER week (a backfill) records only that week's activity counts.
// Follower and subscriber totals are "the value right now", so they are written only
// when --week is the most recent completed week; otherwise today's total would be
// filed under a past date.
//
// Credentials: .env.example / docs/api-setup.md. Meta and Threads rename insight
// metrics over time; on a 400 "invalid metric" see the Metric names section there.
import { execSync } from "child_process";
import { loadEnv, ROOT } from "./lib/env.mjs";

const env = loadEnv();
const iso = (d) => d.toISOString().slice(0, 10);
const lastMonday = (() => { // Monday of the most recent completed Mon-Sun week, in UTC
  const d = new Date(); d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 13 : dow + 6));
  return iso(d);
})();
const wi = process.argv.indexOf("--week");
const start = wi === -1 ? lastMonday : process.argv[wi + 1];
if (!/^\d{4}-\d{2}-\d{2}$/.test(start ?? "") || new Date(start + "T00:00:00Z").getUTCDay() !== 1) {
  console.error("--week must be a Monday as YYYY-MM-DD"); process.exit(1);
}
const isCurrent = start === lastMonday; // totals are only valid for the current week
const startMs = Date.parse(start + "T00:00:00Z");
const endMs = startMs + 7 * 864e5; // [Monday 00:00 UTC, next Monday 00:00 UTC)
const sinceSec = Math.floor(startMs / 1000), untilSec = Math.floor(endMs / 1000);
const apply = process.argv.includes("--apply");

const out = {}, notes = [], browser = [];
if (!isCurrent) notes.push(`backfill of ${start}: follower/subscriber totals skipped (they are only known for ${lastMonday})`);
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
  for (let i = 0; i < 20; i++) {
    const page = await getJson(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=100&filter=posts_no_replies${cursor ? "&cursor=" + cursor : ""}`);
    // Own posts only: the feed also returns other accounts' posts that TBC reposted
    // (marked with `reason`), and their likes are not TBC's engagement.
    posts.push(...page.feed.filter((f) => !f.reason && f.post.author.did === prof.did).map((f) => f.post));
    cursor = page.cursor;
    // stop once TBC's own posts reach back past the week (a repost of an old post must not end paging early)
    if (!cursor || posts.some((p) => Date.parse(p.record?.createdAt ?? p.indexedAt) < startMs)) break;
    if (i === 19) notes.push("bluesky: stopped paging after 2,000 feed items; older weeks may be undercounted");
  }
  const when = (p) => Date.parse(p.record?.createdAt ?? p.indexedAt);
  const inWeek = posts.filter((p) => { const t = when(p); return t >= startMs && t < endMs; });
  out.bluesky = {
    engagements: sum(inWeek, (p) => (p.likeCount || 0) + (p.repostCount || 0) + (p.replyCount || 0) + (p.quoteCount || 0)),
    posts: inWeek.length,
  };
  if (isCurrent) out.bluesky.followers = prof.followersCount;
  notes.push(`bluesky: ${inWeek.length} own post(s) in week` + (isCurrent ? `, ${prof.followersCount} followers` : ""));
} catch (e) { notes.push("bluesky FAILED: " + e.message); browser.push("bluesky"); }

// ---------- YouTube ----------
// A refresh token (YOUTUBE_CLIENT_ID + _SECRET + _REFRESH_TOKEN) is what makes the
// Analytics half work unattended: access tokens expire after an hour.
async function youtubeAccessToken() {
  if (env.YOUTUBE_REFRESH_TOKEN && env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET) {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.YOUTUBE_CLIENT_ID, client_secret: env.YOUTUBE_CLIENT_SECRET, refresh_token: env.YOUTUBE_REFRESH_TOKEN, grant_type: "refresh_token" }),
    });
    if (!r.ok) throw new Error(`token refresh ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return (await r.json()).access_token;
  }
  return env.YOUTUBE_ACCESS_TOKEN || null;
}
if (env.YOUTUBE_API_KEY || env.YOUTUBE_REFRESH_TOKEN || env.YOUTUBE_ACCESS_TOKEN) {
  try {
    out.youtube = {};
    if (env.YOUTUBE_API_KEY && isCurrent) {
      const ch = await getJson(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${env.YOUTUBE_CHANNEL_ID}&key=${env.YOUTUBE_API_KEY}`);
      out.youtube.subscribers = Number(ch.items[0].statistics.subscriberCount);
    }
    const token = await youtubeAccessToken();
    if (token) {
      const endDate = new Date(endMs - 864e5).toISOString().slice(0, 10);
      const rep = await getJson(`https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${start}&endDate=${endDate}&metrics=views,likes,comments,shares,estimatedMinutesWatched`, { authorization: `Bearer ${token}` });
      const [views = 0, likes = 0, comments = 0, shares = 0, minutes = 0] = rep.rows?.[0] ?? [];
      Object.assign(out.youtube, { views, likes, comments, engagements: likes + comments + shares, watchHours: Math.round(minutes / 6) / 10 });
      browser.push("youtube (impressions, CTR — Studio only)");
    } else {
      notes.push("youtube: subscribers only; weekly views/likes/comments need the OAuth keys (docs/api-setup.md)");
      browser.push("youtube (views, impressions, CTR, likes, comments)");
    }
    if (!Object.keys(out.youtube).length) delete out.youtube;
  } catch (e) { notes.push("youtube FAILED: " + e.message); browser.push("youtube"); }
} else browser.push("youtube");

// ---------- Facebook + Instagram (Meta Graph API) ----------
if (env.META_PAGE_TOKEN && env.META_PAGE_ID) {
  const tok = `access_token=${env.META_PAGE_TOKEN}`;
  const g = "https://graph.facebook.com/v27.0";
  const range = `since=${sinceSec}&until=${untilSec}`;
  // Each metric is requested on its own: Meta retires metric names regularly, and one
  // invalid name fails the whole request. This way a retired name costs one field.
  try {
    const page = await getJson(`${g}/${env.META_PAGE_ID}?fields=followers_count,instagram_business_account&${tok}`);
    out.facebook = isCurrent ? { followers: page.followers_count } : {};
    // Names checked against the Page Insights reference on 2026-11-12. page_media_view is the
    // "Views" number in Business Suite; page_views_total would be visits to the Page itself.
    const fbMetrics = { page_media_view: "views", page_total_media_view_unique: "viewers", page_post_engagements: "engagements" };
    for (const [metric, field] of Object.entries(fbMetrics)) {
      try {
        const ins = await getJson(`${g}/${env.META_PAGE_ID}/insights?metric=${metric}&period=day&${range}&${tok}`);
        const m = (ins.data ?? [])[0];
        if (m) out.facebook[field] = sum(m.values ?? [], (x) => (typeof x.value === "number" ? x.value : 0));
        else notes.push(`facebook ${metric}: no data returned`);
      } catch (e) { notes.push(`facebook ${metric}: ${e.message}`); }
    }
    browser.push("facebook (link clicks, views CTR)");

    const ig = page.instagram_business_account?.id;
    if (ig) {
      const prof = await getJson(`${g}/${ig}?fields=followers_count&${tok}`);
      out.instagram = isCurrent ? { followers: prof.followers_count } : {};
      // Valid account metrics per the Instagram insights reference on 2026-11-12.
      // profile_views is no longer offered, so profile visits stay a browser metric.
      const igMetrics = { reach: "reach", views: "views", total_interactions: "interactions" };
      for (const [metric, field] of Object.entries(igMetrics)) {
        try {
          const ins = await getJson(`${g}/${ig}/insights?metric=${metric}&period=day&metric_type=total_value&${range}&${tok}`);
          const m = (ins.data ?? [])[0];
          const v = m?.total_value?.value ?? (m?.values ? sum(m.values, (x) => x.value) : null);
          if (v != null) out.instagram[field] = v;
          else notes.push(`instagram ${metric}: no data returned`);
        } catch (e) { notes.push(`instagram ${metric}: ${e.message}`); }
      }
      if (out.instagram.reach && out.instagram.interactions != null) {
        out.instagram.reachToInteractionRate = Math.round(1000 * out.instagram.interactions / out.instagram.reach) / 10;
      }
      browser.push("instagram (profile visits)");
    } else { notes.push("instagram: no Instagram account is linked to the Facebook Page, so the API cannot see it"); browser.push("instagram"); }
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
      if (m.name === "followers_count") { if (isCurrent) out.threads.followers = v; }
      else if (m.name === "views") out.threads.views = v;
      else out.threads.interactions = (out.threads.interactions || 0) + v;
    }
    browser.push("threads (profile visits)");
  } catch (e) { notes.push("threads FAILED: " + e.message); browser.push("threads"); }
} else browser.push("threads");

browser.push("x", "linkedin", "substack");

for (const k of Object.keys(out)) if (!Object.keys(out[k]).length) delete out[k];
console.log(JSON.stringify({ week: start, collected: out, stillNeedBrowser: browser, notes }, null, 2));
if (apply && Object.keys(out).length) {
  execSync(`node scripts/add-week.mjs ${start} --json ${JSON.stringify(JSON.stringify(out))}`, { cwd: ROOT, stdio: "inherit" });
}
