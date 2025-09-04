// /api/calendar.js — Vercel Serverless Function (Node.js)
export const config = { runtime: 'nodejs' };

const ALLOWED_ORIGINS = new Set([
  'https://start.bogarts.be',
]);

// --- (Optionnel) Test local sans variables d'env ---
// const FALLBACK_ICS_URLS = [
//   "https://calendar.google.com/calendar/ical/XXXXXXXXXXXX/basic.ics",
//   "https://calendar.google.com/calendar/ical/YYYYYYYYYYYY/basic.ics"
// ];

function setCors(res, origin = '') {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://start.bogarts.be';
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', allow);
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  res.setHeader('access-control-allow-headers', 'Content-Type');
}

function parseICS(icsText) {
  // Dépliage des lignes (RFC5545)
  const rawLines = icsText.split(/\r?\n/);
  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (line.startsWith(' ')) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
  }

  const events = [];
  let cur = null;
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
    if (/^\d{8}$/.test(s)) {
      const y = s.slice(0,4), m = s.slice(4,6), d = s.slice(6,8);
      const dt = new Date(`${y}-${m}-${d}T00:00:00`);
      return isNaN(dt) ? null : dt.toISOString();
    }
    if (/^\d{8}T\d{6}Z$/.test(s)) {
      const dt = new Date(s);
      return isNaN(dt) ? null : dt.toISOString();
    }
    if (/^\d{8}T\d{6}$/.test(s)) {
      const y = s.slice(0,4), m = s.slice(4,6), d = s.slice(6,8);
      const hh = s.slice(9,11), mm = s.slice(11,13), ss = s.slice(13,15);
      const dt = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}`);
      return isNaN(dt) ? null : dt.toISOString();
    }
    const d2 = new Date(s);
    return isNaN(d2) ? null : d2.toISOString();
  };

  return events.map(e => ({
    summary: e.summary || '(Sans titre)',
    location: e.location || '',
    start: norm(e.startRaw),
    end: norm(e.endRaw),
  })).filter(e => e.start);
}

async function fetchICS(url, { timeoutMs = 12000 } = {}) {
  // Timeout pour éviter les requêtes qui pendent
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort('timeout'), timeoutMs);

  const r = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; HomepageICS/1.0; +https://start.bogarts.be)',
      'Accept': 'text/calendar, text/plain, */*',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
    signal: ctrl.signal,
  }).catch(err => {
    clearTimeout(to);
    throw err;
  });

  clearTimeout(to);

  if (!r.ok) throw new Error(`ICS HTTP ${r.status} for ${url}`);
  const text = await r.text();
  return parseICS(text);
}

export default async function handler(req, res) {
  setCors(res, req.headers.origin || '');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const envUrls = [process.env.CAL1_ICS_URL, process.env.CAL2_ICS_URL].filter(Boolean);
    // @ts-ignore
    const fallbackUrls = typeof FALLBACK_ICS_URLS !== 'undefined' ? FALLBACK_ICS_URLS : [];
    const urls = envUrls.length ? envUrls : fallbackUrls;

    if (!urls.length) {
      res.status(200).json({
        events: [],
        error: 'No ICS URLs configured',
        hint: 'Ajoute CAL1_ICS_URL / CAL2_ICS_URL (Vercel) ou dé-commente FALLBACK_ICS_URLS pour tester.',
      });
      return;
    }

    // Récupère toutes les sources ICS en parallèle (avec timeouts)
    const arrays = await Promise.all(urls.map(u => fetchICS(u).catch(err => {
      // On loggue l’erreur d’une source mais on n’empêche pas les autres
      return { __ics_error: String(err) };
    })));

    // Aplatis + filtre erreurs
    const all = arrays.flat().filter(e => !e.__ics_error);

    const now = Date.now();
    const in14 = now + 14 * 24 * 3600 * 1000;

    const upcoming = all
      .filter(e => {
        const ts = e.start ? Date.parse(e.start) : 0;
        return ts >= now && ts <= in14;
      })
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .slice(0, 50);

    res.status(200).json({
      events: upcoming,
      count: upcoming.length,
      // debug: arrays.filter(x => x.__ics_error).map(x => x.__ics_error) // décommente si besoin
    });
  } catch (err) {
    res.status(500).json({
      error: String(err?.message || err),
      note: 'Souvent un blocage réseau/redirect ou un timeout ICS. Vérifie les URLs (Secret iCal) et les variables d’env.',
    });
  }
}
