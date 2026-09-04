# API setup — shrinking the browser surface

Every platform below can be collected with a plain HTTP request instead of driving a
browser. Each one you set up removes a fragile step from the Monday run. All are free.
Put credentials in `.env` (gitignored; template in `.env.example`) and run
`node scripts/preflight.mjs` to see which collectors are enabled.

| Platform | Setup | API provides | Still browser-only |
|---|---|---|---|
| **Bluesky** | none — works today | followers, weekly engagements | — |
| **YouTube** (API key) | 10 min | subscribers | views, impressions, CTR, likes, comments |
| YouTube (+ OAuth) | 30 min | + views, likes, comments | impressions, CTR |
| **Facebook + Instagram** | 45 min | followers, views, engagements, reach, profile visits, interactions | FB viewers / CTR |
| **Threads** | 20 min (same Meta app) | followers, views, interactions | profile visits |
| X | $200/mo | — | everything (stay on browser) |
| LinkedIn | weeks (app approval) | — | everything (stay on browser) |
| Substack | no API exists | — | everything |
| TikTok | app approval | — | everything |

Do Meta first — it removes Facebook and Instagram, the two platforms whose analytics UI
fought browser automation hardest, and Instagram is one of the two platforms whose
history cannot be backfilled.

## YouTube (API key)
1. https://console.cloud.google.com — create or reuse a project → **APIs & Services → Enable APIs** → enable *YouTube Data API v3*.
2. **Credentials → Create credentials → API key**. Restrict it to the YouTube Data API.
3. `.env`: `YOUTUBE_API_KEY=...` (the channel id is already filled in).

Optional OAuth for weekly views/likes/comments: enable *YouTube Analytics API*, create an OAuth client (Desktop), complete the consent flow once with scope `https://www.googleapis.com/auth/yt-analytics.readonly`, and put the access token in `YOUTUBE_ACCESS_TOKEN`. Access tokens expire hourly, so this only pays off with a refresh-token flow — ask Claude to add one if you want it.

## Facebook + Instagram (Meta Graph API)
1. https://developers.facebook.com → **Create app** → type *Business*. Add the *Facebook Login for Business* and *Instagram Graph API* products.
2. Open **Graph API Explorer**, select the app, choose the Torchbearer Community Page under *User or Page*, add permissions `pages_read_engagement`, `read_insights`, `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, and generate a **Page access token**.
3. Exchange it for a long-lived token: `GET /oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_TOKEN`. Page tokens derived from a long-lived user token do not expire.
4. `.env`: `META_PAGE_TOKEN=...` and `META_PAGE_ID=...` (numeric Page id — `GET /me/accounts` lists it). The Instagram account must be a Business/Creator account linked to this Page.

## Threads
1. In the same Meta app, add the *Threads API* product with permissions `threads_basic` and `threads_manage_insights`.
2. Generate a Threads user token for @torchbearercommunity and exchange it for a long-lived one: `GET https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=...&access_token=...`
3. `.env`: `THREADS_ACCESS_TOKEN=...`. Threads insights only exist once the account passes 100 followers.

## Metric names
`scripts/fetch-api.mjs` requests: Facebook `page_views_total`, `page_post_engagements`; Instagram `reach`, `profile_views`, `total_interactions`, `views` (with `metric_type=total_value`); Threads `views`, `likes`, `replies`, `reposts`, `quotes`, `followers_count`. Meta renames and retires insight metrics regularly. A 400 "invalid metric" means the name changed — check the current Graph API reference and update the script; the browser fallback covers the gap meanwhile.

## Testing
```
node scripts/fetch-api.mjs --week 2026-08-24          # dry run, prints JSON
node scripts/fetch-api.mjs --week 2026-08-24 --apply  # writes into the data file
```
