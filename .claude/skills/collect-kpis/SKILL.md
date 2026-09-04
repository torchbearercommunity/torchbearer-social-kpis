---
name: collect-kpis
description: Weekly collection of Torchbearer Community social media KPIs — API pass, then browser pass in Kevin's logged-in Chrome, then validate, build, push to GitHub Pages, and post a Discord summary. Use when asked to collect/gather/update the social KPIs, run the weekly numbers, or retry a partial week.
---

# Weekly KPI collection — runbook

Work in `C:\Users\kevin\Programming\TBCsocialMediaKPIsClaude`. Read `CLAUDE.md`
and `docs/collection-guide.md` first; the guide has every URL, field name, and UI
quirk. **This usually runs unattended** — nobody is watching and nobody can answer
a question mid-run, so make reasonable decisions, never block on input, and put
anything that needs Kevin into the final Discord summary instead.

## 0. Preflight

```
node scripts/preflight.mjs
```
It prints the reporting week (`<start>`) and the mode:
- **NEW** — collect everything.
- **RETRY** — the week exists with nulls (Tuesday after a bad Monday, or a rerun).
  Collect **only** the listed null metrics; leave existing values alone.
- **DONE** — post `--status ok "Week <start> already fully collected"` via
  `scripts/notify.mjs` and stop.
If preflight exits non-zero (data file invalid), post `--status fail` with its
output and stop — do not touch the data file.

## 1. API pass (no browser)

```
node scripts/fetch-api.mjs --week <start> --apply
```
Bluesky always works; YouTube/Facebook/Instagram/Threads are collected here too
whenever their credentials are in `.env`. Note `stillNeedBrowser` from its output —
that is the browser to-do list.

## 2. Browser pass

1. Load the claude-in-chrome tools (ToolSearch `select:` the core set). Call
   `list_connected_browsers`; pick the one named **"TBC Chrome"** with
   `select_browser` (do not use AskUserQuestion). `tabs_context_mcp` with
   `createIfEmpty`.
2. **Site-access probe**: `navigate` to each domain still needed. Any
   "Navigation to this domain is not allowed" → add that platform to a `blocked`
   list and skip it. If *every* platform is blocked, go straight to step 4 with
   status `fail`.
3. Collect in this order, recording each platform immediately with
   `node scripts/add-week.mjs <start> platform.metric=value …` before moving on:
   **instagram, substack** (irrecoverable — always first), then **x, linkedin,
   youtube, facebook**, then **threads, tiktok**. Skip metrics the API pass
   already filled. Apply the rules in the collection guide; anything unreadable is
   `null`, never a guess. Cap effort per platform at roughly a dozen tool calls —
   if a page will not cooperate, null it, note why, move on.
4. Close the tabs you opened (`tabs_close_mcp`).

## 3. Validate, build, publish

```
node scripts/validate.mjs && node scripts/build.mjs
git add data/kpi-history.json index.html
git commit -m "KPIs for week of <start>"
git push
```
Also commit any edits you made to `docs/collection-guide.md`. If nothing at all
was collected, skip the commit. Only push what validates.

## 4. Discord summary — always, even on failure

Compose a summary and send it with `node scripts/notify.mjs --status <ok|warn|fail> "<text>"`:
- `ok` when every platform has its core metrics; `warn` when anything is null;
  `fail` when nothing was collected or preflight failed.
- Include: per-platform followers with week-over-week change and the week's
  main engagement number; any **derived** values; the `blocked` domains (tell
  Kevin to allow them in the extension's site access); and a **fill-in list** of
  exactly what is missing, as ready-to-run commands, e.g.
  `node scripts/add-week.mjs <start> substack.subscribers=… substack.views=…`.
- End with the dashboard URL: https://torchbearercommunity.github.io/torchbearer-social-kpis/

Then finish with the same summary as your final message.

## Maintenance

If you find a better URL, a renamed metric, or a new quirk, fix
`docs/collection-guide.md` in the same run. Never edit `index.html` by hand.
