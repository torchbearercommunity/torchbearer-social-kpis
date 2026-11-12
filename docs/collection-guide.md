# Weekly KPI collection guide

The reference for *where each number comes from*. The step-by-step runbook is
`.claude/skills/collect-kpis/SKILL.md`; API setup is `docs/api-setup.md`.

## The week

Weeks run **Monday–Sunday**. The reporting week is the most recent completed
one; `node scripts/preflight.mjs` prints it and says whether it is new, partially
collected (retry — fill nulls only), or done.

## Priority order — this matters

1. **Instagram** and **Substack** first. Their analytics expose only rolling
   windows (last 7/30/90 days), so a week that is not captured within a day or
   two of ending is gone forever. Everything else can be backfilled later with a
   custom date range.
2. Then X, LinkedIn, YouTube, Facebook.
3. Then Threads. Bluesky is API-only and never needs the browser.

Record each platform as soon as it is collected (`node scripts/add-week.mjs …`)
so a crash halfway through keeps what was already gathered.

## Two browsers, not one

The accounts live in two Chrome profiles, and a run needs both connected:

- **TBC profile** (signed in as the TBC accounts): X, YouTube Studio, Substack,
  Instagram, Threads.
- **Kevin's personal profile**: LinkedIn and Facebook. Those are pages administered
  from his personal logins, so the TBC profile cannot open their analytics.

Pick the browser with `select_browser` before each group. The quickest check that
you are in the right one: `x.com/i/account_analytics` shows @JoinTorchbearer.
TBC has no TikTok account; it was dropped from the dashboard in November 2026.

## Catching up after missed weeks (methods proven on 2026-11-12)

Each of these returns daily numbers for a long range in one page load, so ten
missed weeks cost about the same as one. Sum the days Monday to Sunday.

- **X**: on Account overview pick 3M, then the download icon. The CSV is built in
  the page: wrap `URL.createObjectURL` first to keep the Blob, then read its text
  (no need to open the Downloads folder). Columns include Impressions,
  Engagements, Profile visits, New follows, Unfollows. "Create Post" is not the
  number of posts published. New follows minus unfollows does not reconcile with
  the follower total (off by 7 over ten weeks), so past follower totals stay null.
- **YouTube**: advanced mode with `dimension=DAY` lists one row per day, 50 rows
  per page (use two ranges for more). Studio counts days in Pacific time and the
  end of `time_period` is exclusive, so for a last day D pass midnight Central of
  D+2. Daily "Subscribers" is the net change and reconciles exactly with the
  current total, so past subscriber totals can be rebuilt from it. Weekly CTR is
  the impression-weighted mean of the daily CTRs; watch hours are summed.
- **LinkedIn**: set the range to Last 90 days. The chart is Highcharts:
  `Highcharts.charts[0].series[0].data` holds one point per day for the metric
  chosen in the dropdown (Impressions, Clicks, Reactions, Comments, Reposts).
  Members reached cannot be summed across days, so backfilled weeks leave it
  null. The Followers tab charts new followers only, which does not rebuild totals.
- **Substack**: `/api/v1/publish-dashboard/summary-v2?range=N` (fetched from the
  dashboard page while signed in) returns `totalSubscribersStart`, the subscriber
  total N days ago. That gives every past week's total; it matched the recorded
  232 for Aug 9 exactly. `/publish/posts/published` lists each post's date, views
  and open rate for the per-post `views`, `openRate` and `posts` fields.
- **Facebook**: the insights results page only reaches back 28 days.
- **Instagram**: nothing weekly is recoverable. Record the follower total.
- **Threads**: now at `threads.com`; the extension may refuse page scripts there,
  so read the follower count from a screenshot of the profile.

## Browser prerequisites

Collection uses Kevin's real Chrome via the claude-in-chrome tools, in the two
profiles described above.

The extension only navigates domains Kevin has allowed in its site-access settings
(Claude toolbar icon → site access). Required: `x.com`, `linkedin.com`,
`studio.youtube.com` + `youtube.com`, `business.facebook.com`, `instagram.com`,
`substack.com` + `torchbearercommunity.substack.com`, `threads.com`, and `facebook.com`. A `navigate` that returns **"Navigation to this domain is not allowed"**
is a configuration problem: record it, report it in the summary, never guess the
numbers. As of 2026-09-01 only `x.com` was allowed.

Screenshots via CDP often time out for a few seconds right after a click on heavy
SPAs (LinkedIn, Meta, Substack) — wait and retry, or prefer `get_page_text`.

## Rules

- "Total" metrics (followers, subscribers) are the current total at collection
  time; everything else is the week's count.
- Record exactly what the platform reports. A metric that cannot be read is
  `null` — never estimated, never last week's value.
- Engagement rate: the platform's own figure if shown, else engagements ÷
  impressions × 100 to 1 decimal.
- Sanity-check against last week: totals rarely drop more than a few percent; a
  10× jump means re-read the page.
- A follower count reconstructed from "today's total minus reported daily
  changes" is acceptable for backfill only, and must be called out as derived.

## Three numbers added in v2.1, on every platform that shows them

- `posts`: how many posts (or videos) TBC published that week. It is the one input
  the team controls, and it turns every other number into a per-post figure. Count
  original posts and quote posts; leave out replies and plain reposts.
- `linkClicks`: X, LinkedIn, Facebook. Clicks on links in posts: the step from
  attention to the website, the DIP, or a sign-up.
- `watchHours`: YouTube only. Watch time for the week, in hours to one decimal.

These are optional. A week without them is still a complete week; `preflight` only
asks for metrics a week already lists as `null`.

## Platforms → `data/kpi-history.json` fields

### x — @JoinTorchbearer (browser)
`https://x.com/i/account_analytics`. Calendar icon next to the 7D/2W presets →
pick Monday then Sunday → Escape. Cards: Verified followers *A / B* (B = total
followers), Impressions, Engagement rate, Engagements, Profile visits. Page-text
extraction misses the card numbers — read them from a screenshot.
Fields: `followers`, `verifiedFollowers`, `impressions`, `engagements`,
`engagementRate`, `profileVisits`, `linkClicks`, `posts`. Historical follower
counts are not shown, so backfilled weeks leave `followers` null.

### instagram — Torchbearer Community (browser, or Meta API)
`instagram.com/accounts/insights/` → Account insights, **Last 7 days** (no custom
ranges exist). Views, Viewers → `reach`, Interactions, Profile visits, Followers.
Fields: `followers`, `views`, `reach`, `interactions`, `profileVisits`,
`reachToInteractionRate` (= interactions ÷ reach × 100). Instagram is **not**
linked in the Meta Business Suite this org uses; use instagram.com directly.

### substack — torchbearercommunity.substack.com (browser only; no API)
`…/publish/stats`. Subscribers and followers from the Home overview. The Traffic
tab's custom date range fails to load ("Failed to load") every time — take
`views` as the sum of the week's posts' views from Stats → Posts, and
`uniqueVisitors` from the default 30-day Traffic view only if it can be isolated
to the week (else null). Substack has no weekly open rate; `openRate` is the
average of the week's posts' per-post engagement-rate column (Kevin's decision,
2026-07-02). Fields: `followers`, `subscribers`, `views`, `uniqueVisitors`,
`subscriberConversionRate`, `openRate`.

### linkedin — company id 109655987 (browser)
`https://www.linkedin.com/company/109655987/admin/analytics/updates/` → date
dropdown → **Custom** → type Start/End into the inputs → Update. Highlights give
impressions, reactions, comments, reposts; the Metrics dropdown gives Members
reached and Clicks. `engagements` = reactions + comments + reposts + clicks;
`engagementRate` = engagements ÷ impressions × 100. Followers from the sidebar
(current only). Fields: `followers`, `membersReached`, `impressions`,
`engagements`, `engagementRate`, `linkClicks` (the Clicks metric), `posts`.

### youtube — channel UCo1kAWa39iW5DPIHk__qvXQ (browser, or API for subscribers)
Studio → Analytics → **Advanced mode**. The URL accepts the range directly:
`…/explore?…&time_period=<startMs>%2C<endMs>` (epoch ms at local midnight,
end = next Monday) with `t_metrics=RATINGS_LIKES&t_metrics=COMMENTS&t_metrics=SHARINGS&t_metrics=EXTERNAL_VIEWS&t_metrics=SUBSCRIBERS_NET_CHANGE&t_metrics=VIDEO_THUMBNAIL_IMPRESSIONS&t_metrics=VIDEO_THUMBNAIL_IMPRESSIONS_VTR`.
Read the **Total** row. Fields: `subscribers` (current), `views`, `impressions`,
`likes`, `comments`, `engagements` (= likes + comments + shares), `impressionsCtr`,
`watchHours`, `posts` (videos and Shorts published in the week).

### facebook — Torchbearer Community page (browser, or Meta API)
The Business Suite date picker ignores automated clicks. Use
`https://business.facebook.com/latest/insights/results?asset_id=947794068426173`
— its page text exposes **daily value arrays with epoch-second timestamps** for
views, viewers, content interactions, link clicks, visits, and follows over the
last 28 days; sum the seven days of the week. Current followers from the page
itself (`facebook.com/profile.php?id=61587232704207`). Fields: `followers`,
`views`, `viewers`, `engagements` (content interactions), `viewsCtr`
(= link clicks ÷ views × 100), `linkClicks`, `posts`.

### threads — @torchbearercommunity (browser, or Threads API)
`https://www.threads.net/insights`, last 7 days. Insights are gated until the
account passes 100 followers ("Insights await") — until then only `followers`
(profile header) is available and the rest stay null. Fields: `followers`,
`views`, `interactions`, `profileVisits`.

### bluesky — jointorchbearer.bsky.social (API only)
The Monday GitHub Actions job collects it from the public API (no credentials);
`node scripts/fetch-api.mjs --week <start> --apply` does the same by hand. Fields:
`followers`, `engagements` (likes + reposts + replies + quotes on TBC's own posts
from the week; posts by others that TBC reposted are not counted), `posts`. No
browser step. Past weeks can be backfilled for `engagements` and `posts`; the
follower total cannot, so a backfill leaves it alone.

## Recording

```
node scripts/add-week.mjs 2026-09-01 instagram.followers=140 instagram.reach=310 instagram.interactions=28
node scripts/add-week.mjs 2026-09-01 substack.subscribers=241 substack.views=305 substack.openRate=null
```
Creates the week if needed, patches only the given metrics, validates, rebuilds
`index.html`. Then `git add data/kpi-history.json index.html`, commit
`KPIs for week of <start>`, push — GitHub Pages republishes within a minute.

## Maintenance

When you discover a better URL, a renamed metric, or a UI quirk, update this
file in the same commit so the next run is smoother.
