// /api/calendar.js — runtime Node.js (plus robuste que Edge)
export const config = { runtime: 'nodejs' };

const ALLOWED_ORIGINS = new Set([
  'https://start.bogarts.be'
]);

// --- Décommente pour tester en local sans variables d'env ---
// const FALLBACK_ICS_URLS = [
//   "https://calendar.google.com/calendar/ical/XXXXXXXXXXXX/basic.ics",
//   "https://calendar.google.com/calendar/ical/YYYYYYYYYYYY/basic.ics"
// ];

function corsHeaders(req) {
  const origin = req.headers.get?.('origin') || '';
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://start.bogarts.be';
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
  };
}

// Parser ICS minimal
function parseICS(icsText) {
  // Dépliage des lignes (RFC5545)
  const rawLines = icsText.split(/\r?\n/);
  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (line.startsWith(' ')) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
  }

  const events = []; let cur = null;
  const flush = () => { if (cur) events.push(cur); cur = null; };

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT')   { flush(); continue; }
    if (!cur) continue;

    if (line.startsWith('DTSTART')) {
      const idx = line.indexOf(':');
      cur.startRaw = (idx > -1 ? line.slice(idx + 1) : '').trim();
    } else if (line.startsWith('DTEND')) {
      const idx = line.indexOf(':');
      cur.endRaw = (idx > -1 ? line.slice(idx + 1) : '').trim();
    } else if (line.startsWith('SUMMARY')) {
      const idx = line.indexOf(':');
      cur.summary = (idx > -1 ? line.slice(idx + 1) : '').trim();
    } else if (line.startsWith('LOCATION')) {
      const idx = line.indexOf(':');
      cur.location = (idx > -1 ? line.slice(idx + 1) : '').trim();
    }
  }

  const norm = (s) => {
    if (!s) return null;
    if (/^\d{8}$/.test(s))  // All-day
      return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T00:00:00`).toISOString();
    if (/^\d{8}T\d{6}Z$/.test(s)) return new Date(s).toISOString();
    if (/^\d{8}T\d{6}$/.test(s))  // local time
      return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(9,11)}:${s.slice(11,13)}:${s.slice(13,15)}`).toISOString();
    const d = new Date(s); return isNaN(d) ? null : d.toISOString();
  };

  return events.map(e => ({
    summary: e.summary || '(Sans titre)',
    location: e.location || '',
    start: norm(e.startRaw),
    end: norm(e.endRaw),
  })).filter(e => e.start);
}

async function fetchICS(url) {
  const r = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; HomepageICS/1.0; +https://start.bogarts.be)',
      'Accept': 'text/calendar, text/plain, */*',
      'Cache-Control': 'no-cache',
    },
  });
  if (!r.ok) throw new Error(`ICS HTTP ${r.status} for ${url}`);
  const text = await r.text();
  return parseICS(text);
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(req) });
  }
  try {
    const envUrls = [process.env.CAL1_ICS_URL, process.env.CAL2_ICS_URL].filter(Boolean);
    // @ts-ignore
    const fallbackUrls = typeof FALLBACK_ICS_URLS !== 'undefined' ? FALLBACK_ICS_URLS : [];
    const urls = envUrls.length ? envUrls : fallbackUrls;

    if (!urls.length) {
      return new Response(JSON.stringify({
        events: [],
        error: 'No ICS URLs configured',
        hint: 'Ajoute CAL1_ICS_URL / CAL2_ICS_URL (Vercel) ou dé-commente FALLBACK_ICS_URLS pour tester en local.',
      }), { headers: corsHeaders(req), status: 200 });
    }

    const arrays = await Promise.all(urls.map(fetchICS));
    const all = arrays.flat();

    const now = Date.now();
    const in14 = now + 14 * 24 * 3600 * 1000;

    const upcoming = all
      .filter(e => { const ts = e.start ? Date.parse(e.start) : 0; return ts >= now && ts <= in14; })
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .slice(0, 50);

    return new Response(JSON.stringify({ events: upcoming, count: upcoming.length }), {
      headers: corsHeaders(req), status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: String(err?.message || err),
      note: 'Souvent un blocage réseau/redirect côté ICS. Vérifie les URLs (Secret iCal) et les variables d’env.',
    }), { headers: corsHeaders(req), status: 500 });
  }
}
