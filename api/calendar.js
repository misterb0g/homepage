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
  // CORS (garde ton setCors existant si tu l'as déjà)
  const ALLOWED_ORIGINS = new Set(['https://start.bogarts.be']);
  const allow = ALLOWED_ORIGINS.has(req.headers.origin || '') ? req.headers.origin : 'https://start.bogarts.be';
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', allow);
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  res.setHeader('access-control-allow-headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  const debug = (req.query && (req.query.debug === '1' || req.query.debug === 'true'));

  try {
    // === LECTURE DES URLS ICS ===
    // Option A : plusieurs variables fixes
    const fixedEnvUrls = [
      process.env.CAL1_ICS_URL,
      process.env.CAL2_ICS_URL,
      process.env.CAL3_ICS_URL,
      process.env.CAL4_ICS_URL,
      process.env.CAL5_ICS_URL,
    ].filter(Boolean);

    // Option B : une seule variable "CAL_ICS_URLS" séparée par des virgules
    const listEnvUrls = (process.env.CAL_ICS_URLS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const envUrls = (listEnvUrls.length ? listEnvUrls : fixedEnvUrls);

    // (Facultatif) Fallback local commenté
    // const FALLBACK_ICS_URLS = [...];

    const urls = envUrls /* .concat(FALLBACK_ICS_URLS || []) */;

    if (!urls.length) {
      const body = { events: [], error: 'No ICS URLs configured', hint: 'Ajoute CAL1_ICS_URL/CAL2_ICS_URL ou CAL_ICS_URLS en Production et redeploy.' };
      return res.status(200).json(debug ? { ...body, debug: { envUrls } } : body);
    }

    // === FETCH AVEC TIMEOUT + USER-AGENT ===
    const fetchICS = async (url, { timeoutMs = 12000 } = {}) => {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort('timeout'), timeoutMs);
      try {
        const r = await fetch(url, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; HomepageICS/1.0; +https://start.bogarts.be)',
            'Accept': 'text/calendar, text/plain, */*',
            'Cache-Control': 'no-cache',
          },
          signal: ctrl.signal,
        });
        if (!r.ok) throw new Error(`ICS HTTP ${r.status}`);
        const text = await r.text();
        return { url, events: parseICS(text) };
      } finally {
        clearTimeout(to);
      }
    };

    // === RÉCUPÈRE CHAQUE SOURCE ET COMPTE ===
    const results = await Promise.all(urls.map(u =>
      fetchICS(u).catch(err => ({ url: u, error: String(err && err.message ? err.message : err) }))
    ));

    const perUrl = results.map(r => ({
      url: r.url,
      count: Array.isArray(r.events) ? r.events.length : 0,
      error: r.error || null,
    }));

    // Aplatis les évènements valides
    const all = results.flatMap(r => Array.isArray(r.events) ? r.events : []);

    // === FENÊTRE : 30 jours (temporaire pour tester) ===
    const now = Date.now();
    const inDays = 30; // passe à 14 ensuite si tu veux
    const horizon = now + inDays * 24 * 3600 * 1000;

    const upcoming = all
      .filter(e => {
        const ts = e.start ? Date.parse(e.start) : 0;
        return ts >= now && ts <= horizon;
      })
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .slice(0, 80);

    const body = { events: upcoming, count: upcoming.length };

    // En mode debug, renvoyer le détail par URL (très utile pour savoir lequel “ne parle pas”)
    return res.status(200).json(debug ? { ...body, debug: { urlsUsed: urls, perUrl } } : body);

  } catch (err) {
    return res.status(500).json({
      error: String(err?.message || err),
      note: 'Vérifie les variables d’env (Production), la validité des URLs ICS, et réessaie.',
    });
  }
}
