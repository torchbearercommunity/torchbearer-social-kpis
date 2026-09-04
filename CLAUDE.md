# Torchbearer Community — Social KPI Dashboard

Weekly social-media KPI tracking for Torchbearer Community (TBC), an AI-safety
advocacy org. Kevin Lotto maintains it; the dashboard is public at
**https://torchbearercommunity.github.io/torchbearer-social-kpis/** (GitHub
Pages, served from `index.html` on `main` — every push republishes within a
minute). This repo is the only home for the project: the earlier
`TBCsocialMediaKPIsFable` directory and the claude.ai artifact are retired.

## What lives where

- `data/kpi-history.json` — **the single source of truth.** One entry per
  Mon–Sun week with per-platform metric objects. Missing metrics are `null`,
  never 0 and never a guess. Weeks sorted ascending by `start`.
- `src/dashboard-template.html` — dashboard markup/CSS/JS with a `/*__DATA__*/;`
  marker where the JSON is inlined at build time. Edit this, never `index.html`.
- `index.html` — **build output, but committed** because GitHub Pages serves
  it. Regenerate with `node scripts/build.mjs`; never hand-edit.
- `scripts/` — `preflight.mjs` (what mode/what is configured), `fetch-api.mjs`
  (API collectors), `add-week.mjs` (create/patch a week by hand), `validate.mjs`,
  `build.mjs`, `notify.mjs` (Discord). `merge-legacy-kpis.mjs` and
  `migrate-legacy-datajs.cjs` are the one-off importers that built the history;
  do not re-run them.
- `docs/collection-guide.md` — per-platform pages, handles, field mapping, and
  hard-won UI quirks. `docs/api-setup.md` — how to move platforms off the browser.
- `.claude/skills/collect-kpis/SKILL.md` — the weekly runbook. The scheduled
  task `weekly-social-kpis` (Mon + Tue 9am) invokes it.
- `.env` (gitignored) — Discord webhook and any API credentials. `.env.example`
  documents every key.

## The weekly run, in one line each

preflight → API pass → browser pass (Instagram and Substack first) → validate →
build → commit + push → Discord summary. Full detail in the skill file.

## Conventions that matter

- **Instagram and Substack cannot be backfilled** — their analytics only expose
  rolling windows. They are collected first, and a missed week is lost.
- Tuesday's run is a retry: if Monday left nulls, fill only the nulls.
- Account-level trends are the focus, not per-post stats.
- Follower counts derived from "today minus reported daily change" are marked
  as such in the run summary; never silently.
- The dashboard treats a platform's latest known value as current and labels
  it "as of <week>" when it is older than the newest week.
- The engagement summary tile excludes Substack (its `views` are not engagements).
- Browser collection uses Kevin's real Chrome via the claude-in-chrome tools —
  the connected browser is named "TBC Chrome" (profile "Profile 7"). The
  extension only navigates domains Kevin has allowed in its site-access
  settings; a "Navigation to this domain is not allowed" error is a
  configuration problem to report, not something to work around.
- Never guess a number. `null` plus a note in the summary beats a plausible value.
