# Torchbearer Community — Social Media KPI Dashboard

Public weekly dashboard of social media KPIs for the Torchbearer Community
volunteer group: X, LinkedIn, YouTube, Facebook, Instagram, Substack, Bluesky,
and Threads. Weekly history since November 2025.

**Live dashboard:** https://torchbearercommunity.github.io/torchbearer-social-kpis/

## How it works

- [`data/kpi-history.json`](data/kpi-history.json) — all the data. One object per
  Monday–Sunday week with per-platform metrics; `null` means not collected.
- [`src/dashboard-template.html`](src/dashboard-template.html) — the dashboard.
  `node scripts/build.mjs` inlines the data into [`index.html`](index.html), which
  GitHub Pages serves. `index.html` is generated — edit the template instead.
- [`.github/workflows/weekly-api.yml`](.github/workflows/weekly-api.yml): every
  Monday GitHub collects the platforms that have an API and republishes. No
  computer, browser, or volunteer involved.
- [`docs/embedding.md`](docs/embedding.md): put the numbers on another site: an
  iframe (`?embed=summary`) or the JSON feed at `data/summary.json`.
- [`scripts/`](scripts/) — `preflight`, `fetch-api` (Bluesky today; YouTube, Meta,
  Threads once credentials exist — see [`docs/api-setup.md`](docs/api-setup.md)),
  `add-week` (record or patch a week by hand), `validate`, `build`, `notify`
  (Discord).
- [`.claude/skills/collect-kpis/`](.claude/skills/collect-kpis/SKILL.md) — the
  weekly runbook. A scheduled Claude Code task runs it Monday and Tuesday mornings;
  Tuesday is a retry that fills only what Monday missed.
- [`docs/collection-guide.md`](docs/collection-guide.md) — per-platform sources,
  handles, field mapping, and UI quirks.

## Weekly routine

Automatic: the Monday run collects, commits, pushes, and posts a summary to
Discord. If the summary lists gaps, fill them:

```
node scripts/add-week.mjs 2026-09-01 substack.subscribers=241 substack.views=305
git add data/kpi-history.json index.html && git commit -m "KPIs for week of 2026-09-01" && git push
```

Manual run: open Claude Code in this folder and say "run the weekly KPI collection".

## Setup (one time)

- Copy `.env.example` to `.env` and fill in the Discord webhook and any API keys.
- In Chrome, allow the Claude extension on every platform domain (list in the
  collection guide) so unattended runs can navigate.
