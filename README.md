# Torchbearer Community — Social Media KPI Dashboard

Public weekly dashboard of social media KPIs for the Torchbearer Community volunteer group, covering X (Twitter), Instagram, Bluesky, Threads, YouTube, Substack, TikTok, Facebook, and LinkedIn.

**Live dashboard:** https://torchbearercommunity.github.io/torchbearer-social-kpis/

## How it works

- [`index.html`](index.html) — static dashboard (Chart.js). No build step; it fetches `data/kpis.json` at load.
- [`data/kpis.json`](data/kpis.json) — all the data. `weeks` is a list of week-ending dates (Sundays); every platform metric is an array aligned to it (`null` = not collected that week).
- [`scripts/validate.mjs`](scripts/validate.mjs) — checks the data file's shape after each update (`node scripts/validate.mjs`).
- `.claude/skills/collect-kpis/` — the weekly collection workflow, run via Claude Code (`/collect-kpis`). Claude reads each platform's analytics page in a logged-in browser, appends the week's numbers, validates, and pushes — which republishes the dashboard.

## Weekly routine

1. Be logged into each platform in Chrome (with the Claude extension connected).
2. In Claude Code, run `/collect-kpis`.
3. Review the summary, done — the live URL updates within a minute of the push.

## Metrics tracked

Per platform, where available: total followers/subscribers, weekly views/impressions, weekly engagements/interactions, engagement rate (or click-through rate), and profile views.
