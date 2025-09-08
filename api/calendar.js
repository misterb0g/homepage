/** api/calendar.js — CommonJS (Vercel/Node CJS)
 *  - CORS (start.bogarts.be)
 *  - CAL_ICS_URLS ou CAL1_ICS_URL…CAL8_ICS_URL
 *  - CAL_ICS_LABELS (même ordre que les URLs)
 *  - Parsing ICS robuste (VALUE=DATE, UTC Z, offset +/-HHMM, local naïf, lignes pliées)
 *  - Fenêtre ?days= (1..90, défaut 14) + ?pastDays= (0..30, défaut 0)
 *  - Debug: ?debug=1 → urlsUsed, perUrl{count,error,kept}, days, pastDays
 */

const ALLOWED_ORIGINS = new Set(['https://start.bogarts.be']);

function setCors(res, origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://start.bogarts.be';
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', allow);
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  res.setHeader('access-control-allow-headers', 'Content-Type');
}

/* ---------- Helpers (labels) ---------- */
function guessLabelFromURL(urlStr) {
  try {
    const url = new URL(urlStr);
    const parts = url.pathname.split('/');
    const id = decodeURIComponent(parts[4] || 'Agenda');
    if (id.includes('@')) {
      const [local, domain] = id.split('@');
      if ((local || '').startsWith('family')) return 'Famille';
      if (domain === 'group.calendar.google.com') return local || 'Agenda';
      return local || 'Agenda';
    }
    return id || 'Agenda';
  } catch { return 'Agenda'; }
}

/* ---------- Dates: parser tolérant ---------- */
function toISO(val) {
  if (!val) return null;

  // YYYYMMDD (all-day)
  if (/^\d{8}$/.test(val)) {
    const y = val.slice(0, 4), m = val.slice(4, 6), d = val.slice(6, 8);
    const dt = new Date(`${y}-${m}-${d}T00:00:00`);
    return isNaN(dt) ? null : dt.toISOString();
  }

  // UTC: YYYYMMDDTHHMMSSZ
  if (/^\d{8}T\d{6}Z$/.test(val)) {
    const dt = new Date(val);
    return isNaN(dt) ? null : dt.toISOString();
  }

  // Offset: YYYYMMDDTHHMMSS+/-HHMM
  if (/^\d{8}T\d{6}[+-]\d{4}$/.test(val)) {
    const y = +val.slice(0, 4), m = +val.slice(4, 6), d = +val.slice(6, 8);
    const hh = +val.slice(9, 11), mm = +val.slice(11, 13), ss = +val.slice(13, 15);
    const sign = val[15] === '-' ? -1 : 1;
    const offH = +val.slice(16, 18) * sign;
    const offM = +val.slice(18, 20) * sign;
    const dt = new Date(Date.UTC(y, m - 1, d, hh - offH, mm - offM, ss));
    return isNaN(dt) ? null : dt.toISOString();
  }

  // Local naïf: YYYYMMDDTHHMMSS (souvent après TZID=…:)
  if (/^\d{8}T\d{6}$/.test(val)) {
    const y = val.slice(0, 4), m = val.slice(4, 6), d = val.slice(6, 8);
    const hh = val.slice(9, 11), mm = val.slice(11, 13), ss = val.slice(13, 15);
    const dt = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}`);
    return isNaN(dt) ? null : dt.toISOString();
  }

  // fallback (éviter les throws)
  const dt = new Date(val);
  return isNaN(dt) ? null : dt.toISOString();
}

/* ---------- ICS: dépliage + extraction ---------- */
function parseICS(icsText) {
  // Dépliage RFC 5545: continuation via espace OU tabulation
  const raw = icsText.split(/\r?\n/);
  const lines = [];
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    if (/^[ \t]/.test(line) && lines.length) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
  }

  const events = [];
  let cur = null;

  // Attrape DTSTART/DTEND avec/sans paramètres (ex: ;VALUE=DATE, ;TZID=Europe/Brussels)
  const rxStart = /^DTSTART(?:;[^:]*)?:(.+)$/;
  const rxEnd   = /^DTEND(?:;[^:]*)?:(.+)$/;
  const rxSum   = /^SUMMARY:(.*)$/;
  const rxLoc   = /^LOCATION:(.*)$/;

  for (const l of lines) {
    if (l === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (l === 'END:VEVENT')   { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;

    let m;
    if ((m = l.match(rxStart))) cur.startRaw = m[1].trim();
    else if ((m = l.match(rxEnd))) cur.endRaw = m[1].trim();
    else if ((m = l.match(rxSum))) cur.summary = m[1].trim();
    else if ((m = l.match(rxLoc))) cur.location = m[1].trim();
  }

  const out = [];
  for (const e of events) {
    const start = toISO(e.startRaw);
    const end = toISO(e.endRaw);
    if (!start) continue; // on ignore les évènements sans date valide
    out.push({
      summary: e.summary || '(Sans titre)',
      location: e.location || '',
      start, end,
    });
  }
  return out;
}

/* ---------- Fetch ICS (tolérant) ---------- */
async function fetchICS(url, { timeoutMs = 12000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort('timeout'), timeoutMs);
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
  } finally { clearTimeout(timer); }
}

/* ---------- Handler (CJS) ---------- */
async function handler(req, res) {
  setCors(res, req.headers.origin || '');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  try {
    // URLs via liste ou indexées (CAL_ICS_URLS prioritaire)
    const urlsFromList = (process.env.CAL_ICS_URLS || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    const urlsFromIdx = [
      process.env.CAL1_ICS_URL, process.env.CAL2_ICS_URL,
      process.env.CAL3_ICS_URL, process.env.CAL4_ICS_URL,
      process.env.CAL5_ICS_URL, process.env.CAL6_ICS_URL,
      process.env.CAL7_ICS_URL, process.env.CAL8_ICS_URL,
    ].filter(Boolean);
    const urls = urlsFromList.length ? urlsFromList : urlsFromIdx;

    if (!urls.length) { res.status(200).json({ events: [], error: 'No iCal URLs configured' }); return; }

    // Labels (ex: "Perso,Famille,Silex") — doivent suivre le même ordre que urls
    const labels = (process.env.CAL_ICS_LABELS || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    // Fenêtre: futur days (1..90, défaut 14) + option pastDays (0..30)
    const days = Math.max(1, Math.min(90, parseInt(req.query.days, 10) || 14));
    const pastDays = Math.max(0, Math.min(30, parseInt(req.query.pastDays, 10) || 0));
    const now = Date.now();
    const fromTs = now - pastDays * 24 * 3600 * 1000;
    const horizon = now + days * 24 * 3600 * 1000;

    // Récupérer et parser chaque ICS (tolérant aux erreurs)
    const results = await Promise.all(
      urls.map(u =>
        fetchICS(u)
          .then(txt => ({ url: u, events: parseICS(txt) }))
          .catch(err => ({ url: u, events: [], error: String(err?.message || err) }))
      )
    );

    // Aplatir + annoter la source
    const all = results.flatMap((r, i) => {
      const label = labels[i] || guessLabelFromURL(r.url);
      return (r.events || []).map(ev => ({ ...ev, src: i, srcLabel: label }));
    });

    // Filtre temporel
    const upcoming = all
      .filter(ev => {
        const ts = ev.start ? Date.parse(ev.start) : NaN;
        return !isNaN(ts) && ts >= fromTs && ts <= horizon;
      })
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .slice(0, 400);

    const body = { events: upcoming, count: upcoming.length };
    if (req.query.debug === '1' || req.query.debug === 'true') {
      body.debug = {
        urlsUsed: urls,
        perUrl: results.map((r, i) => ({
          url: urls[i],
          count: (r.events || []).length,
          error: r.error || null,
          kept: upcoming.filter(ev => ev.src === i).length,
        })),
        days,
        pastDays,
      };
    }
    res.status(200).json(body);
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
}

module.exports = handler;
// Optionnel: préciser un runtime si besoin
// module.exports.config = { runtime: 'nodejs18.x' };
