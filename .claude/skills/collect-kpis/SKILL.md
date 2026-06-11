---
name: collect-kpis
description: Weekly collection of Torchbearer Community social media KPIs. Opens each platform's analytics page in the user's logged-in Chrome browser, records followers, views/impressions, engagements, engagement rate, and profile views into data/kpis.json, then publishes the dashboard to GitHub Pages. Use when the user asks to collect/gather/update social media KPIs or run the weekly numbers.
---

# Weekly KPI Collection

Collect this week's numbers for all 9 Torchbearer Community accounts, append them to `data/kpis.json`, validate, and publish.

## Reporting week

Weeks run **Monday–Sunday**. The week-ending date is the most recent **Sunday** (if today is Sunday, use today). Compute it first; it becomes the new entry in the `weeks` array. If that date is already the last entry in `weeks`, this week was already collected — ask the user whether to overwrite it.

## Setup

1. Load the Claude in Chrome tools via ToolSearch (query `Claude_in_Chrome`, max_results 30). Call `list_connected_browsers` / `tabs_context_mcp` to confirm the extension is connected. If it isn't, ask the user to open Chrome with the Claude extension enabled, then continue.
2. Read `data/kpis.json` to know the platforms, their exact metric names, and last week's values (for sanity-checking new numbers).

## Account handles

<!-- Fill in / correct these on the first run, then update this file so future runs don't have to rediscover them. -->
- X: handle TBD — analytics at https://x.com/i/account_analytics
- Instagram: handle TBD — Meta Business Suite insights at https://business.facebook.com/latest/insights/overview (or instagram.com professional dashboard)
- Bluesky: handle TBD — profile at https://bsky.app/profile/HANDLE
- Threads: handle TBD — insights at https://www.threads.net/insights
- YouTube: channel TBD — https://studio.youtube.com → Analytics
- Substack: publication TBD — https://PUBLICATION.substack.com/publish/stats
- TikTok: handle TBD — https://www.tiktok.com/tiktokstudio/analytics
- Facebook: page TBD — Meta Business Suite insights (same as Instagram)
- LinkedIn: page TBD — https://www.linkedin.com/company/SLUG/admin/analytics/

## Collection, platform by platform

For each platform: open the analytics page in a tab (`tabs_create_mcp` + `navigate`), **set the date range to the last 7 days / the reporting week** where the UI allows it, and read the numbers with `get_page_text` or `read_page`. Record into the existing metric names in `data/kpis.json`:

| Platform | Metrics to capture (kpis.json names) | Where |
|---|---|---|
| X | Followers, Verified Followers, Impressions, Engagements, Engagement Rate %, Profile Visits | Account analytics overview, 7-day range |
| Instagram | Followers, Views, Accounts Reached, Interactions, Profile Visits | Business Suite → Insights → Instagram, last 7 days |
| Bluesky | Followers, Engagements | Profile header for followers; sum likes+reposts+replies on the week's posts for Engagements |
| Threads | Followers, Views, Interactions, Profile Visits | Threads insights, last 7 days |
| YouTube | Subscribers, Views, Impressions, CTR % | Studio → Analytics, last 7 days (CTR = impressions click-through rate) |
| Substack | Subscribers, Views, Open Rate % | Publish → Stats, last 7 days |
| TikTok | Followers, Views, Engagements, Profile Views | TikTok Studio → Analytics, last 7 days (Engagements = likes+comments+shares) |
| Facebook | Followers, Views, Viewers, Interactions | Business Suite → Insights → Facebook, last 7 days |
| LinkedIn | Followers, Impressions, Engagements, Engagement Rate % | Page admin → Analytics (followers + content), last 7 days |

Rules:
- "Total" metrics (Followers/Subscribers) are the **current total**; everything else is **this week's count**.
- Engagement rate: use the platform's own figure if shown; otherwise compute engagements ÷ impressions (or views) × 100, rounded to 1 decimal.
- A metric you can't get this week is `null` — never guess, never reuse last week's value.
- Sanity-check against last week: totals should rarely drop more than a few percent; if a number looks off by 10x, re-read the page before recording.
- If a page won't load or the account is logged out, note it, move on, and at the end ask the user for just those numbers (they may enter them or say skip).

## Record and publish

1. Edit `data/kpis.json`: append the week-ending date to `weeks`, append exactly one value (number or null) to **every** metric array of **every** platform, and set `updated` to today (YYYY-MM-DD).
2. Run `node scripts/validate.mjs` — must pass before continuing.
3. Commit and push:
   ```
   git add data/kpis.json
   git commit -m "KPIs for week ending <date>"
   git push
   ```
4. GitHub Pages redeploys automatically (takes ~1 minute). Confirm with `gh api repos/:owner/:repo/pages --jq .status` or just tell the user the URL.
5. Finish with a short summary table: per platform, followers (with weekly change) and the week's views + engagements, plus anything that couldn't be collected.

## Maintenance

If you discover a better analytics URL, a renamed metric, or a new account handle during a run, update this SKILL.md so the next run is smoother. If a platform adds a metric worth tracking, add it to `data/kpis.json` as a new array (backfill with nulls) — the dashboard picks it up automatically.
