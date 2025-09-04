// /api/calendar.js — Vercel Serverless Function (Node.js) propre & robuste
export const config = { runtime: 'nodejs' };

/**
 * Points clés
 * - Agrège plusieurs agendas via variables d'env :
 *     • CAL_ICS_URLS = "url1,url2,..."  (option recommandée et scalable)
 *     • ET/OU CAL1_ICS_URL … CAL8_ICS_URL
 * - CORS : autorise ton domaine (prod) et OPTIONS.
 * - Fetch avec timeout + User-Agent (Google ICS est parfois capricieux).
 * - Parsing ICS robuste (dépliage RFC5545).
 * - Fenêtre par défaut 14 jours (modifiable via ?days=30).
 * - Mode debug : ?debug=1 renvoie le détail par URL (count / error).
 * - Chaque évènement inclut : src (index) et srcLabel (libellé).
 */

const ALLOWED_ORIGINS = new Set([
  'https://start.bogarts.be',
]);

/* ---------- Utils CORS ---------- */
function setCors(res, origin = '') {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://start.bogarts.be';
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', allow);
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  res.setHeader('access-control-allow-headers', 'Content-Type');
}

/* ---------- Helpers ---------- */
function guessLabelFromURL(u) {
  try {
    const url = new URL(u);
    const segs = url.pathname.split('/'); // /calendar/ical/<id>/private-.../basic.ics
    const id = decodeURIComponent(segs[4] || 'agenda'); // ex: direction@lesilex.be
    if (id.includes('@')) {
      const [local, domain] = id.split('@');
      if ((local || '').startsWith('family')) return 'Famille';
      if (domain === 'group.calendar.google.com') return local || 'Agenda';
      return local || 'Agenda';
    }
    return id.slice(0, 12) || 'Agenda';
  } catch { return 'Agenda'; }
}

/* ---------- Parsing ICS minimal & robuste ---------- */
function parseICS(icsText) {
  // 1) Dépliage (RFC5545)
  const raw = icsText.split(/\r?\n/);
  const lines = [];
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    if (line.startsWith(' ')) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
  }

  // 2) Extraction VEVENT
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

  // 3) Normalisation dates
  const norm = (s) => {
    if (!s) return null;
    if (/^\d{8}$/.test(s)) { // All-day
      const y = s.slice(0,4), m = s.slice(4,6), d = s.slice(6,8);
      const dt = new Date(`${y}-${m}-${d}T00:00:00`);
      return isNaN(dt) ? null : dt.toISOString();
    }
    if (/^\d{8}T\d{6}Z$/.test(s)) { // UTC
      const dt = new Date(s);
      return isNaN(dt) ? null : dt.toISOString();
    }
    if (/^\d{8}T\d{6}$/.test(s)) { // Local
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

/* ---------- Fetch ICS avec timeout & UA ---------- */
async function fetchICS(url, { timeoutMs = 12000 } = {}) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort('timeout'), timeoutMs);
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HomepageICS/1.0; +https://start.bogarts.be)',
        'Accept': 'text/calendar, text/plain, */*',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`ICS HTTP ${r.status}`);
    const text = await r.text();
    return { url, events: parseICS(text) };
  } finally {
    clearTimeout(to);
  }
}

/* ---------- Handler ---------- */
export default async function handler(req, res) {
  setCors(res, req.headers.origin || '');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  const debug = req.query && (req.query.debug === '1' || req.query.debug === 'true');
  const days = Math.max(1, Math.min(90, Number(req.query?.days) || 14)); // 1..90 jours

  try {
    // URLs depuis l'env (liste + fixes)
    const listEnvUrls = (process.env.CAL_ICS_URLS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const fixedEnvUrls = [
      process.env.CAL1_ICS_URL,
      process.env.CAL2_ICS_URL,
      process.env.CAL3_ICS_URL,
      process.env.CAL4_ICS_URL,
      process.env.CAL5_ICS_URL,
      process.env.CAL6_ICS_URL,
      process.env.CAL7_ICS_URL,
      process.env.CAL8_ICS_URL,
    ].filter(Boolean);
    const urls = (listEnvUrls.length ? listEnvUrls : fixedEnvUrls);

    // Labels optionnels alignés par index
    const labelList = (process.env.CAL_ICS_LABELS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (!urls.length) {
      return res.status(200).json({
        events: [],
        error: 'No ICS URLs configured',
        hint: 'Définis CAL_ICS_URLS (liste séparée par des virgules) ou CAL1_ICS_URL…CAL8_ICS_URL en Production.',
      });
    }

    // Récupérer chaque source (tolérant aux erreurs individuelles)
    const results = await Promise.all(urls.map(u =>
      fetchICS(u).catch(err => ({ url: u, error: String(err && err.message ? err.message : err) }))
    ));

    const perUrl = results.map(r => ({
      url: r.url,
      count: Array.isArray(r.events) ? r.events.length : 0,
      error: r.error || null,
    }));

    // Aplatir + annoter source
    const all = results.flatMap((r, idx) => {
      if (!Array.isArray(r.events)) return [];
      const label = labelList[idx] || guessLabelFromURL(urls[idx]);
      return r.events.map(ev => ({ ...ev, src: idx, srcLabel: label }));
    });

    // Filtre par fenêtre
    const now = Date.now();
    const horizon = now + days * 24 * 3600 * 1000;

    const upcoming = all
      .filter(e => {
        const ts = e.start ? Date.parse(e.start) : 0;
        return ts >= now && ts <= horizon;
      })
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .slice(0, 200);

    const body = { events: upcoming, count: upcoming.length };
    if (debug) body.debug = { urlsUsed: urls, perUrl, days };

    res.status(200).json(body);
  } catch (err) {
    res.status(500).json({
      error: String(err?.message || err),
      note: 'Vérifie les variables d’env (Production) et la validité des URLs (Secret iCal).',
    });
  }
}
