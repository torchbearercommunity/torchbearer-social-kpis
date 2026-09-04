// Post a message to the TBC Discord channel via webhook.
// Usage:  node scripts/notify.mjs [--status ok|warn|fail] "message text"
//         echo "message" | node scripts/notify.mjs --status warn
// Exits 0 when no webhook is configured (prints the message instead) so a missing
// webhook never blocks the data pipeline; exits 1 only on a delivery failure.
import { loadEnv } from "./lib/env.mjs";

const env = loadEnv();
const args = process.argv.slice(2);
let status = "ok";
const si = args.indexOf("--status");
if (si !== -1) { status = args[si + 1] ?? "ok"; args.splice(si, 2); }

let text = args.join(" ").trim();
if (!text && !process.stdin.isTTY) {
  text = (await new Promise((resolve) => {
    let buf = "";
    process.stdin.on("data", (c) => (buf += c)).on("end", () => resolve(buf));
  })).trim();
}
if (!text) { console.error("notify: nothing to send"); process.exit(1); }

const url = env.DISCORD_WEBHOOK_URL;
if (!url) {
  console.log("notify: DISCORD_WEBHOOK_URL not set — printing instead of posting:\n" + text);
  process.exit(0);
}

const palette = { ok: 0x2e8b57, warn: 0xe0a100, fail: 0xc0392b };
const titles = {
  ok: "📊 Weekly social KPIs — collected",
  warn: "⚠️ Weekly social KPIs — partial",
  fail: "🛑 Weekly social KPIs — FAILED",
};
const body = {
  embeds: [{
    title: titles[status] ?? "📊 Weekly social KPIs",
    description: text.slice(0, 4000),
    color: palette[status] ?? 0x2a78d6,
    url: "https://torchbearercommunity.github.io/torchbearer-social-kpis/",
    footer: { text: "torchbearercommunity.github.io/torchbearer-social-kpis" },
    timestamp: new Date().toISOString(),
  }],
};

const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
if (!res.ok) {
  console.error(`notify: Discord returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
console.log(`notify: posted to Discord (${status})`);
