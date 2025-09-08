// api/calendar.js – handler iCal robuste (safe parsing + labels + src)
export const config = { runtime: 'nodejs' };

/* ================= CORS ================= */
const ALLOWED_ORIGINS = new Set([
  'https://start.bogarts.be',
]);

function setCors(res, origin = '') {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://start.bogarts.be';
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', allow);
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  res.setHeader('access-control-allow-headers', 'Content-Type');
}

/* ============== Helpers (labels, parse) ============== */
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

// Convertit divers formats iCal vers ISO, sans throw
function toISO(val) {
  if (!val) return null;

  // YYYYMMDD (journée entière)
  if (/^\d{8}$/.test(val)) {
    const y = val.slice(0, 4), m = val.slice(4, 6), d = val.slice(6, 8);
    const dt = new Date(`${y}-${m}-${d}T00:00:00`);
    return isNaN(dt) ? null : dt.toISOString();
  }

  // YYYYMMDDTHHMMSSZ (UTC)
  if (/^\d{8}T\d{6}Z$/.test(val)) {
    const dt = new Date(val);
    return isNaN(dt) ? null : dt.toISOString();
  }

  // YYYYMMDDTHHMMSS+/-HHMM (offset explicite)
  if (/^\d{8}T\d{6}[+-]\d{4}$/.test(val)) {
    const y = val.slice(0, 4), m = val.slice(4, 6), d = val.slice(6, 8);
    const hh = val.slice(9, 11), mm = val.slice(11, 13), ss = val.slice(13, 15);
    const offSign = val.slice(15, 16) === '-' ? -1 : 1;
    const offH = parseInt(val.slice(16, 18), 10) * offSign;
    const offM = parseInt(val.slice(18, 20), 10) * offSign;
    // Construire en UTC = heure locale - offset
    const dt = new Date(Date.UTC(
      parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10),
      parseInt(hh, 10) - offH, parseInt(mm, 10) - offM, parseInt(ss, 10)
    ));
    return isNaN(dt) ? null : dt.toISOString();
  }

  // YYYYMMDDTHHMMSS (naïf, on suppose local)
  if (/^\d{8}T\d{6}$/.test(val)) {
    const y = val.slice(0, 4), m = val.slice(4, 6), d = val.slice(6, 8);
    const hh = val.slice(9, 11), mm = val.slice(11, 13), ss = val.slice(13, 15);
    const dt = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}`);
    return isNaN(dt) ? null : dt.toISOString();
  }

  // Dernier filet de sécurité (libre), mais sans throw
  const dt = new Date(val);
  return isNaN(dt) ? null : dt.toISOString();
}

// --- remplace ta fonction parseICS par celle-ci ---
function parseICS(icsText) {
  const raw = icsText.split(/\r?\n/);
  const lines = [];
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    if (/^[ \t]/.test(line) && lines.length) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
  }

  const events = [];
  let cur = null;

  // stats debug
  const dbg = {
    totalVEVENT: 0,
    startSeen: 0,
    endSeen: 0,
    byType: { allDay: 0, utcZ: 0, offset: 0, naiveLocal: 0, other: 0 },
    examples: { allDay: [], utcZ: [], offset: [], naiveLocal: [], other: [] },
  };

  const rxStart = /^DTSTART(?:;[^:]*)?:(.+)$/;
  const rxEnd   = /^DTEND(?:;[^:]*)?:(.+)$/;
  const rxSum   = /^SUMMARY:(.*)$/;
  const rxLoc   = /^LOCATION:(.*)$/;

  for (const l of lines) {
    if (l === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (l === 'END:VEVENT')   { if (cur) { events.push(cur); dbg.totalVEVENT++; } cur = null; continue; }
    if (!cur) continue;

    let m;
    if ((m = l.match(rxStart))) {
      cur.startRaw = m[1].trim();
      dbg.startSeen++;
    } else if ((m = l.match(rxEnd))) {
      cur.endRaw = m[1].trim();
      dbg.endSeen++;
    } else if ((m = l.match(rxSum))) {
      cur.summary = m[1].trim();
    } else if ((m = l.match(rxLoc))) {
      cur.location = m[1].trim();
    }
  }

  function toISOtyped(val) {
    if (!val) return { iso: null, type: 'other' };

    // YYYYMMDD (all-day)
    if (/^\d{8}$/.test(val)) {
      const y = val.slice(0, 4), m = val.slice(4, 6), d = val.slice(6, 8);
      const dt = new Date(`${y}-${m}-${d}T00:00:00`);
      return { iso: isNaN(dt) ? null : dt.toISOString(), type: 'allDay' };
    }

    // YYYYMMDDTHHMMSSZ (UTC)
    if (/^\d{8}T\d{6}Z$/.test(val)) {
      const dt = new Date(val);
      return { iso: isNaN(dt) ? null : dt.toISOString(), type: 'utcZ' };
    }

    // YYYYMMDDTHHMMSS+/-HHMM (offset explicite)
    if (/^\d{8}T\d{6}[+-]\d{4}$/.test(val)) {
      const y = val.slice(0, 4), m = val.slice(4, 6), d = val.slice(6, 8);
      const hh = val.slice(9, 11), mm = val.slice(11, 13), ss = val.slice(13, 15);
      const sign = val[15] === '-' ? -1 : 1;
      const offH = parseInt(val.slice(16, 18), 10) * sign;
      const offM = parseInt(val.slice(18, 20), 10) * sign;
      const dt = new Date(Date.UTC(+y, +m - 1, +d, +hh - offH, +mm - offM, +ss));
      return { iso: isNaN(dt) ? null : dt.toISOString(), type: 'offset' };
    }

    // YYYYMMDDTHHMMSS (naïf local ; souvent TZID=…:)
    if (/^\d{8}T\d{6}$/.test(val)) {
      const y = val.slice(0, 4), m = val.slice(4, 6), d = val.slice(6, 8);
      const hh = val.slice(9, 11), mm = val.slice(11, 13), ss = val.slice(13, 15);
      const dt = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}`);
      return { iso: isNaN(dt) ? null : dt.toISOString(), type: 'naiveLocal' };
    }

    // fallback
    const dt = new Date(val);
    return { iso: isNaN(dt) ? null : dt.toISOString(), type: 'other' };
  }

  const out = [];
  for (const e of events) {
    const s = toISOtyped(e.startRaw);
    const en = toISOtyped(e.endRaw);
    if (s.iso) {
      // stats par type
      if (dbg.byType[s.type] != null) dbg.byType[s.type]++; else dbg.byType.other++;
      const bucket = dbg.examples[s.type] || dbg.examples.other;
      if (bucket.length < 3) bucket.push({ raw: e.startRaw, iso: s.iso });

      out.push({
        summary: e.summary || '(Sans titre)',
        location: e.location || '',
        start: s.iso,
        end: en.iso || null,
      });
    }
  }

  // attache les stats pour debug
  out._debugStats = dbg;
  return out;
}

  // Normalisation sans throw
  const out = [];
  for (const e of events) {
    const start = toISO(e.startRaw);
    const end   = toISO(e.endRaw);
    if (!start) continue; // on ignore les évènements sans date valide
    out.push({
      summary: e.summary || '(Sans titre)',
      location: e.location || '',
      start, end,
    });
  }
  return out;
}

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
  } finally {
    clearTimeout(timer);
  }
}

/* ================= Handler ================= */
export default async function handler(req, res) {
  setCors(res, req.headers.origin || '');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  try {
    // URLs via liste ou indexées
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

    // Labels optionnels (ex: "Perso,Famille,Silex")
    const labels = (process.env.CAL_ICS_LABELS || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    // Fenêtre (par défaut 14j), bornée 1..90j
    const days = Math.max(1, Math.min(90, parseInt(req.query.days) || 14));
    const now = Date.now();
    const horizon = now + days * 24 * 3600 * 1000;

    // Fetch + parse tolérant (aucun throw vers l’extérieur)
    const results = await Promise.all(
      urls.map(u =>
        fetchICS(u)
          .then(txt => ({ url: u, events: parseICS(txt) }))
          .catch(err => ({ url: u, events: [], error: String(err?.message || err) }))
      )
    );

    // Annote chaque évènement par source
    const all = results.flatMap((r, i) => {
      const label = labels[i] || guessLabelFromURL(r.url);
      return (r.events || []).map(ev => ({ ...ev, src: i, srcLabel: label }));
    });

    // Filtre temps futur (tu peux élargir via ?days=30)
    const upcoming = all
      .filter(ev => {
        const ts = ev.start ? Date.parse(ev.start) : NaN;
        return !isNaN(ts) && ts >= now && ts <= horizon;
      })
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .slice(0, 400);

 // --- et dans ton handler, juste avant res.status(200).json(body) ---
const body = { events: upcoming, count: upcoming.length };
if (req.query.debug === '1' || req.query.debug === 'true') {
  body.debug = {
    urlsUsed: urls,
    perUrl: results.map((r, i) => ({
      url: urls[i],
      count: (r.events || []).length,
      error: r.error || null,
      // nouvelles métriques
      parsedStats: r.events && r.events._debugStats ? r.events._debugStats : null,
      kept: upcoming.filter(ev => ev.src === i).length,
    })),
    days,
  };
}
res.status(200).json(body);
    res.status(200).json(body);
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
}
