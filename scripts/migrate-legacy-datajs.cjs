// One-time migration: parse the legacy free-text data.js from TBCsocialMediaKPIs
// into structured data/kpi-history.json for this project.
// Usage: node scripts/migrate.js
const fs = require('fs');
const path = require('path');

const LEGACY = path.resolve(__dirname, '..', '..', 'TBCsocialMediaKPIs', 'data.js');
const OUT = path.resolve(__dirname, '..', 'data', 'kpi-history.json');

const src = fs.readFileSync(LEGACY, 'utf8');
const m = src.match(/`([\s\S]*)`/);
if (!m) throw new Error('Could not find RAW_DATA template literal');
const raw = m[1];

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

// A number possibly with commas; XX means "not recorded"
function num(s) {
  if (s == null) return null;
  s = String(s).trim();
  if (/^x+$/i.test(s)) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Extract "<number-or-XX>" immediately before any of the given phrases.
function metricBefore(line, phrases) {
  for (const p of phrases) {
    const re = new RegExp('([\\d,.]+|XX+)\\s+(?:' + p + ')', 'i');
    const mm = line.match(re);
    if (mm) return num(mm[1]);
  }
  return null;
}

// Extract "<number-or-XX>%" (or XX.X%) immediately before any of the given phrases.
function pctBefore(line, phrases) {
  for (const p of phrases) {
    const re = new RegExp('([\\d.]+|XX(?:\\.X+)?)\\s*%\\s*(?:' + p + ')', 'i');
    const mm = line.match(re);
    if (mm) return num(mm[1].replace(/^XX(\.X+)?$/i, 'XX'));
  }
  return null;
}

function parseWeekHeader(header) {
  // Reported date, if any
  let reported = null;
  const rep = header.match(/Reported\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (rep) reported = { m: +rep[1], d: +rep[2], y: +rep[3] };

  const core = header.replace(/\(.*?\)/g, '').replace(/^Week of/i, '').trim();
  // Tokens like: "Aug 17-23 2026" | "July 27-Aug 2 2026" | "May 25 - 31 2026" |
  // "April 27- May 3" | "Mar Apr 13-19" (typo: last month wins) | "Dec 22-28"
  const yearM = core.match(/(20\d{2})\s*$/);
  let year = yearM ? +yearM[1] : null;
  const body = yearM ? core.slice(0, yearM.index).trim() : core;

  const re = /([A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(\d{1,2})\s*-\s*(?:([A-Za-z]+)\s+)?(\d{1,2})/;
  const mm = body.match(re);
  if (!mm) throw new Error('Unparseable week header: ' + header);
  const startMonthWords = mm[1].trim().split(/\s+/);
  const m1 = MONTHS[startMonthWords[startMonthWords.length - 1].toLowerCase()];
  const d1 = +mm[2];
  const m2 = mm[3] ? MONTHS[mm[3].toLowerCase()] : m1;
  const d2 = +mm[4];
  if (!m1 || !m2) throw new Error('Unknown month in header: ' + header);

  if (year == null) {
    if (reported) {
      // Week ends at/just before the reported date; handle Dec->Jan boundary.
      year = m2 > reported.m ? reported.y - 1 : reported.y;
    } else {
      year = 2026; // all undated entries in this file fall in 2026
    }
  }
  const endYear = m2 < m1 ? year + 1 : year;
  const pad = (n) => String(n).padStart(2, '0');
  return {
    start: `${year}-${pad(m1)}-${pad(d1)}`,
    end: `${endYear}-${pad(m2)}-${pad(d2)}`,
  };
}

const PLATFORM_PARSERS = {
  x: {
    match: /^X Account:/i,
    parse(line) {
      // "148 (+2.7%) verified of 475 followers" | "220 followers" | "67 followers"
      let verified = null, followers = null;
      const v = line.match(/([\d,]+)\s*(?:\([^)]*\))?\s*verified of\s+([\d,]+)\s+followers/i);
      if (v) { verified = num(v[1]); followers = num(v[2]); }
      else followers = metricBefore(line, ['followers']);
      return {
        verifiedFollowers: verified,
        followers,
        engagements: metricBefore(line, ['wkly engagements', 'weekly engagements', 'engagements']),
        engagementRate: pctBefore(line, ['engagement rate']),
      };
    },
  },
  linkedin: {
    match: /^LinkedIn Account:/i,
    parse(line) {
      return {
        followers: metricBefore(line, ['followers', '\\(\\+?[\\d.]+%\\)\\s*followers']),
        membersReached: metricBefore(line, ['Members Reached']),
        impressions: metricBefore(line, ['Impressions']),
        engagements: metricBefore(line, ['wkly engagements', 'weekly engagements']),
        engagementRate: pctBefore(line, ['engagement rate']),
      };
    },
  },
  youtube: {
    match: /^YouTube Account:/i,
    parse(line) {
      return {
        subscribers: metricBefore(line, ['Subscribers', 'subscribers']),
        views: metricBefore(line, ['Views']),
        impressions: metricBefore(line, ['Impressions']),
        engagements: metricBefore(line, ['wkly engagements']),
        likes: metricBefore(line, ['Likes']),
        comments: metricBefore(line, ['Comments?']),
        impressionsCtr: pctBefore(line, ['Impressions Click-Through Rate']),
      };
    },
  },
  facebook: {
    match: /^Facebook Account:/i,
    parse(line) {
      return {
        followers: metricBefore(line, ['Followers']),
        views: metricBefore(line, ['Views']),
        viewers: metricBefore(line, ['Viewers']),
        engagements: metricBefore(line, ['wkly engagements', 'Interactions']),
        viewsCtr: pctBefore(line, ['Views Click-Through Rate']),
      };
    },
  },
  instagram: {
    match: /^Instagram(?:\s+Account)?:/i,
    parse(line) {
      return {
        followers: metricBefore(line, ['Followers']),
        views: metricBefore(line, ['Views', 'views']),
        reach: metricBefore(line, ['Accounts Reached', 'Viewers']),
        interactions: metricBefore(line, ['Interactions']),
        profileVisits: metricBefore(line, ['Profile Visits']),
        reachToInteractionRate: pctBefore(line, ['Reach-to-Interaction Rate']),
      };
    },
  },
  substack: {
    match: /^Substack Account:/i,
    parse(line) {
      return {
        followers: metricBefore(line, ['followers']),
        subscribers: metricBefore(line, ['subscribers']),
        views: metricBefore(line, ['Views']),
        uniqueVisitors: metricBefore(line, ['Unique Visitors']),
        subscriberConversionRate: pctBefore(line, ['Subscriber Conversion Rate']),
      };
    },
  },
  bluesky: { match: /^Bluesky(?:\s+Account)?:/i, parse: () => ({}) },
  threads: { match: /^Threads(?:\s+Account)?:/i, parse: () => ({}) },
};

const lines = raw.split(/\r?\n/);
const weeks = [];
let current = null;
for (const rawLine of lines) {
  const line = rawLine.trim();
  if (!line) continue;
  if (/^Week of/i.test(line)) {
    const { start, end } = parseWeekHeader(line);
    current = { start, end, platforms: {} };
    weeks.push(current);
    continue;
  }
  if (!current) continue;
  for (const [key, { match, parse }] of Object.entries(PLATFORM_PARSERS)) {
    if (match.test(line)) {
      current.platforms[key] = parse(line);
      break;
    }
  }
}

weeks.sort((a, b) => a.start.localeCompare(b.start));

const out = {
  organization: 'Torchbearer Community',
  updated: new Date().toISOString().slice(0, 10),
  platforms: {
    x: { name: 'X / Twitter', handle: '@JoinTorchbearer' },
    linkedin: { name: 'LinkedIn' },
    youtube: { name: 'YouTube' },
    facebook: { name: 'Facebook' },
    instagram: { name: 'Instagram' },
    substack: { name: 'Substack' },
    bluesky: { name: 'Bluesky' },
    threads: { name: 'Threads' },
  },
  weeks,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`Wrote ${weeks.length} weeks to ${OUT}`);
// Quick sanity report
for (const w of weeks) {
  const plats = Object.keys(w.platforms).join(',');
  console.log(w.start, '->', w.end, '|', plats);
}
