// api/calendar.js – Handler iCal robuste avec CORS, labels et sources
export const config = { runtime: 'nodejs' };

/* ======================== */
/* 1. CORS                   */
/* ======================== */

const ALLOWED_ORIGINS = new Set([
  'https://start.bogarts.be',
  // ajoute ici d’autres domaines si nécessaire
]);

function setCors(res, origin = '') {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://start.bogarts.be';
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', allow);
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  res.setHeader('access-control-allow-headers', 'Content-Type');
}

/* ======================== */
/* 2. Helpers (labels, parseICS) */
/* ======================== */

function guessLabelFromURL(urlStr) {
  try {
    const url = new URL(urlStr);
    const parts = url.pathname.split('/');
    const id = decodeURIComponent(parts[4] || 'Agenda');
    if (id.includes('@')) {
      const [local, domain] = id.split('@');
      if (local.startsWith('family')) return 'Famille';
      if (domain === 'group.calendar.google.com') return local;
      return local;
    }
    return id;
  } catch {
    return 'Agenda';
  }
}

function parseICS(ics) {
  // dépliage des lignes (RFC 5545)
  const lines = [];
  ics.split(/\r?\n/).reduce((prev, line) => {
    if (line.startsWith(' ')) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
  }, '');

  const events = [];
  let current = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { current = {}; continue; }
    if (line === 'END:VEVENT')   { events.push(current); current = null; continue; }
    if (!current) continue;
    if (line.startsWith('DTSTART')) {
      current.startRaw = line.split(':')[1].trim();
    } else if (line.startsWith('DTEND')) {
      current.endRaw = line.split(':')[1].trim();
    } else if (line.startsWith('SUMMARY')) {
      current.summary = line.split(':')[1].trim();
    } else if (line.startsWith('LOCATION')) {
      current.location = line.split(':')[1].trim();
    }
  }

  // normalisation des dates en ISO 8601
  const normalize = (val) => {
    if (!val) return null;
    if (/^\d{8}$/.test(val)) {
      const y = val.slice(0,4), m = val.slice(4,6), d = val.slice(6,8);
      return new Date(`${y}-${m}-${d}T00:00:00`).toISOString();
    }
    if (/^\d{8}T\d{6}Z$/.test(val)) return new Date(val).toISOString();
    if (/^\d{8}T\d{6}$/.test(val)) {
      const y = val.slice(0,4), m = val.slice(4,6), d = val.slice(6,8);
      const hh = val.slice(9,11), mm = val.slice(11,13), ss = val.slice(13,15);
      return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}`).toISOString();
    }
    return new Date(val).toISOString();
  };

  return events
    .map(e => ({
      summary: e.summary || '(Sans titre)',
      location: e.location || '',
      start: normalize(e.startRaw),
      end: normalize(e.endRaw),
    }))
    .filter(ev => ev.start);
}

async function fetchICS(url, { timeoutMs = 12000 } = {}) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort('timeout'), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (HomepageICS)',
        'Accept': 'text/calendar, text/plain, */*',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`ICS HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(timeout);
  }
}

/* ======================== */
/* 3. Handler principal      */
/* ======================== */

export default async function handler(req, res) {
  setCors(res, req.headers.origin || '');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  try {
    // Lire la liste des URLs (CAL_ICS_URLS ou CAL1_ICS_URL…)
    const urlsFromList = (process.env.CAL_ICS_URLS || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    const urlsFromIndexed = [
      process.env.CAL1_ICS_URL, process.env.CAL2_ICS_URL,
      process.env.CAL3_ICS_URL, process.env.CAL4_ICS_URL,
      process.env.CAL5_ICS_URL, process.env.CAL6_ICS_URL,
      process.env.CAL7_ICS_URL, process.env.CAL8_ICS_URL,
    ].filter(Boolean);

    const urls = urlsFromList.length ? urlsFromList : urlsFromIndexed;
    if (!urls.length) {
      res.status(200).json({ events: [], error: 'No iCal URLs configured' });
      return;
    }

    // Labels (séparés par des virgules), pour chaque agenda.
    const labels = (process.env.CAL_ICS_LABELS || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    // Paramètre days (1..90). Par défaut 14 jours.
    const days = Math.max(1, Math.min(90, parseInt(req.query.days) || 14));
    const now = Date.now();
    const horizon = now + days * 24 * 3600 * 1000;

    // Récupérer chaque flux .ics (tolérance aux erreurs individuelles)
    const results = await Promise.all(
      urls.map(u =>
        fetchICS(u)
          .then(text => ({ url: u, events: parseICS(text) }))
          .catch(err => ({ url: u, error: err.message }))
      )
    );

    // Aplatir les événements et annotez-les
    const allEvents = results.flatMap((res, idx) => {
      if (!Array.isArray(res.events)) return [];
      const label = labels[idx] || guessLabelFromURL(res.url);
      return res.events.map(ev => ({
        ...ev,
        src: idx,
        srcLabel: label,
      }));
    });

    // Filtrer sur la fenêtre temporelle
    const upcoming = allEvents
      .filter(ev => {
        const ts = ev.start ? Date.parse(ev.start) : 0;
        return ts >= now && ts <= horizon;
      })
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .slice(0, 400);

    const body = { events: upcoming, count: upcoming.length };
    if (req.query.debug === '1' || req.query.debug === 'true') {
      body.debug = {
        urlsUsed: urls,
        perUrl: results.map((res, i) => ({
          url: urls[i],
          count: Array.isArray(res.events) ? res.events.length : 0,
          error: res.error || null,
        })),
        days,
      };
    }
    res.status(200).json(body);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}
