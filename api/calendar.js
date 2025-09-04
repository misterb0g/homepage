export const config = { runtime: 'edge' };

/**
 * ========== CONFIG ==========
 * PRODUCTION (Vercel) :
 *   - Mets tes ICS secrets dans les variables d'env :
 *       CAL1_ICS_URL, CAL2_ICS_URL
 *
 * LOCAL (test rapide) :
 *   - Dé-commente FALLBACK_ICS_URLS et colle tes URLs ICS ici.
 */

// PASTE ICS HERE (LOCAL TEST):
// const FALLBACK_ICS_URLS = [
//   "https://calendar.google.com/calendar/ical/xxxxxxxxxxxxxxxxxxxx/basic.ics",
//   "https://calendar.google.com/calendar/ical/yyyyyyyyyyyyyyyy/basic.ics"
// ];

function parseICS(icsText) {
  const events = [];
  const lines = icsText.split(/\r?\n/);
  let cur = null;

  const flush = () => { if (cur) events.push(cur); cur = null; };

  for (let raw of lines) {
    const line = raw.trim();
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { flush(); continue; }
    if (!cur) continue;

    if (line.startsWith('DTSTART')) cur.start = line.split(':')[1];
    else if (line.startsWith('DTEND')) cur.end = line.split(':')[1];
    else if (line.startsWith('SUMMARY')) cur.summary = line.split(':').slice(1).join(':');
    else if (line.startsWith('LOCATION')) cur.location = line.split(':').slice(1).join(':');
  }

  const toISO = (s) => {
    if (!s) return null;
    if (s.endsWith('Z')) return new Date(s).toISOString();
    if (/^\d{8}T\d{6}$/.test(s)) return new Date(s.replace(/^(\d{4})(\d{2})(\d{2})T/, '$1-$2-$3T') + 'Z').toISOString();
    if (/^\d{8}$/.test(s)) return new Date(s.replace(/^(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')).toISOString();
    const d = new Date(s);
    return isNaN(d) ? null : d.toISOString();
  };

  return events
    .map(e => ({
      summary: e.summary || '(Sans titre)',
      location: e.location || '',
      start: toISO(e.start),
      end: toISO(e.end),
    }))
    .filter(e => e.start);
}

async function getICS(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`ICS HTTP ${r.status}`);
  return parseICS(await r.text());
}

export default async function handler(req) {
  try {
    // 1) Vercel env
    const envUrls = [process.env.CAL1_ICS_URL, process.env.CAL2_ICS_URL].filter(Boolean);
    // 2) Local fallback (dé-commente FALLBACK_ICS_URLS pour tester)
    const fallbackUrls = (typeof FALLBACK_ICS_URLS !== 'undefined') ? FALLBACK_ICS_URLS : [];
    const urls = envUrls.length ? envUrls : fallbackUrls;

    if (!urls.length) {
      return new Response(JSON.stringify({ events: [], warning: "No ICS URLs configured" }), { headers: corsJSON() });
    }

    const arrs = await Promise.all(urls.map(getICS));
    const all = arrs.flat();

    const now = Date.now();
    const in14 = now + 14 * 24 * 3600 * 1000;

    const upcoming = all
      .filter(e => {
        const ts = e.start ? Date.parse(e.start) : 0;
        return ts >= now && ts <= in14;
      })
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .slice(0, 40);

    return new Response(JSON.stringify({ events: upcoming }), { headers: corsJSON() });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsJSON() });
  }
}

function corsJSON() {
  return {
    'content-type': 'application/json; charset=utf-8',
    // Restreins l'origine à ton domaine
    'access-control-allow-origin': 'https://start.bogarts.be',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
  };
}