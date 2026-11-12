# Showing the social numbers on another site

Two ways for the TBC community dashboard (dashboard.torchbearer.community) or any
other page to show these numbers. Both read from GitHub Pages, which is public and
sends `Access-Control-Allow-Origin: *`, so no login, key, or proxy is involved.

## 1. Embed the dashboard (no code beyond an iframe)

```html
<iframe id="tbc-social" title="Social media"
  src="https://torchbearercommunity.github.io/torchbearer-social-kpis/?embed=summary"
  style="width:100%;border:0" height="640" loading="lazy"></iframe>
<script>
  // optional: let the frame size itself
  addEventListener("message", (e) => {
    if (e.origin === "https://torchbearercommunity.github.io" && e.data?.type === "tbc-social-kpis:height")
      document.getElementById("tbc-social").height = e.data.height;
  });
</script>
```

| URL | Shows |
|---|---|
| `?embed=summary` | the four headline tiles, total audience by platform, weekly engagements |
| `?embed=1` | the whole dashboard without its masthead and footer |
| `&range=12` or `&range=26` | start on the last 12 or 26 weeks |
| `&theme=dark` | dark theme (embeds default to light, white cards, `#ddd` borders) |

In embed mode the page background is transparent, so it sits on whatever the host
page uses. A line at the bottom links to the full dashboard.

If the host site sends a Content-Security-Policy, it needs
`frame-src https://torchbearercommunity.github.io`.

## 2. Read the numbers and draw them natively

`https://torchbearercommunity.github.io/torchbearer-social-kpis/data/summary.json`
is rebuilt with every data update:

```json
{
  "updated": "2026-11-11",
  "dataThrough": { "start": "2026-11-02", "end": "2026-11-08" },
  "totalAudience": 1234,
  "platforms": {
    "x": { "name": "X / Twitter", "handle": "@JoinTorchbearer", "url": "https://x.com/JoinTorchbearer",
           "audience": 500, "audienceMetric": "followers", "asOf": "2026-11-02",
           "change": 4, "changeSince": "2026-10-26",
           "weeklyEngagements": 210, "engagementsWeek": "2026-11-02" }
  },
  "audienceSeries": [ { "start": "2025-11-03", "end": "2025-11-09", "total": 67 } ],
  "dashboardUrl": "https://torchbearercommunity.github.io/torchbearer-social-kpis/"
}
```

(The values above are placeholders that show the shape.) Dates are the Monday of a
Monday to Sunday week. `asOf` is the week a platform last reported, which can be
older than `dataThrough`; show it when it is. `audienceSeries` carries each
platform forward from its last report, so the total never dips because one report
was skipped. Fields may be added; existing ones will not be renamed.

The full history, every metric for every week, is at `data/kpi-history.json` in
the same place.

A Social media section on the community dashboard's Analytics page fits its
existing pattern: three stat tiles (total audience, weekly engagements, new
audience over 12 weeks) and one "by month" line chart from `audienceSeries`.
