/** api/calendar.js — Vercel Edge Function
 * - CORS (start.bogarts.be)
 * - CAL_ICS_URLS ou CAL1_ICS_URL…CAL8_ICS_URL
 * - CAL_ICS_LABELS (même ordre que les URLs)
 * - Parsing ICS robuste (VALUE=DATE, UTC Z, offset +/-HHMM, local naïf, lignes pliées)
 * - Fenêtre ?days= (1..90, défaut 14) + ?pastDays= (0..30, défaut 0)
 * - Debug: ?debug=1 → urlsUsed, perUrl{count,error,kept}, days, pastDays
 */

export const config = { runtime: 'edge' };

// ⚠️ Autorise UNIQUEMENT ton domaine de prod.
const ALLOWED_ORIGIN = 'https://start.bogarts.be';

function cors(headers = {}, origin = '') {
  const allow = origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allow,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...headers,
  };
}

/* ---------- Helpers (parsing ICS) ---------- */

const FIELD_REGEX = /^([A-Z-]+)(?:;([A-Z=,-]+))?:(.*)$/;
const DATE_REGEX = /^\d{8}$/;
const DATETIME_REGEX = /^(\d{8}T\d{6})(Z)?$/;
const DATETIME_OFFSET_REGEX = /^(\d{8}T\d{6})([+-]\d{4})$/;

function parseICS(ics) {
  const events = [];
  let currentEvent = null;
  const lines = ics.split('\n').map(line => line.trim());
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // Unfold lines
    while (lines[i+1] && (lines[i+1].startsWith(' ') || lines[i+1].startsWith('\t'))) {
      line += lines[i+1].trim();
      i++;
    }

    const match = line.match(FIELD_REGEX);
    if (!match) continue;

    const [, key, params, value] = match;

    if (key === 'BEGIN' && value === 'VEVENT') {
      currentEvent = {};
    } else if (key === 'END' && value === 'VEVENT' && currentEvent) {
      if (currentEvent.start && currentEvent.end) {
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      let finalValue = value;
      // Decode values
      if (finalValue.includes('\\,')) finalValue = finalValue.replace(/\\,/g, ',');
      if (finalValue.includes('\\;')) finalValue = finalValue.replace(/\\;/g, ';');
      if (finalValue.includes('\\n')) finalValue = finalValue.replace(/\\n/g, '\n');

      // Date/Time parsing
      if (key === 'DTSTART' || key === 'DTEND') {
        const paramMap = params ? Object.fromEntries(params.split(';').map(p => p.split('='))) : {};
        if (paramMap.VALUE === 'DATE' || DATE_REGEX.test(finalValue)) {
          finalValue = `${finalValue.slice(0, 4)}-${finalValue.slice(4, 6)}-${finalValue.slice(6, 8)}T00:00:00`;
        } else if (DATETIME_REGEX.test(finalValue)) {
          const [date, time] = finalValue.slice(0, -1).split('T');
          finalValue = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}Z`;
        } else if (DATETIME_OFFSET_REGEX.test(finalValue)) {
          const [, datetime, offset] = finalValue.match(DATETIME_OFFSET_REGEX);
          const [date, time] = datetime.split('T');
          finalValue = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}${offset.slice(0, 3)}:${offset.slice(3, 5)}`;
        }
      }
      
      const propKey = key.toLowerCase().replace(/^(dt|last-mod|geo|url)/, (m) => m.slice(0, m.length - 1));
      currentEvent[propKey] = finalValue;
    }
  }
  return events;
}

async function fetchICS(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/* ---------- Main Handler ---------- */

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors({}, origin) });
  }

  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: cors({}, origin) });
  }

  const { searchParams } = new URL(req.url);
  const debug = searchParams.get('debug') === '1' || searchParams.get('debug') === 'true';

  let urls = [];
  let labels = [];

  const envUrls = process.env.CAL_ICS_URLS;
  if (envUrls) {
    urls = envUrls.split(';');
    if (process.env.CAL_ICS_LABELS) {
      labels = process.env.CAL_ICS_LABELS.split(';');
    }
  } else {
    for (let i = 1; i <= 8; i++) {
      const url = process.env[`CAL${i}_ICS_URL`];
      if (url) {
        urls.push(url);
        labels.push(process.env[`CAL${i}_ICS_LABEL`] || `Agenda ${i}`);
      }
    }
  }

  if (urls.length === 0) {
    return new Response(JSON.stringify({ error: 'No calendar URLs configured.' }), {
      status: 500,
      headers: cors({ 'Content-Type': 'application/json' }, origin),
    });
  }

  const days = Math.min(Math.max(1, parseInt(searchParams.get('days') || '14', 10)), 90);
  const pastDays = Math.min(Math.max(0, parseInt(searchParams.get('pastDays') || '0', 10)), 30);
  const now = new Date();
  const fromTs = now.getTime() - pastDays * 24 * 60 * 60 * 1000;
  const horizon = now.getTime() + days * 24 * 60 * 60 * 1000;

  const results = await Promise.all(
    urls.map(u =>
      fetchICS(u)
        .then(txt => ({ url: u, events: parseICS(txt) }))
        .catch(err => ({ url: u, events: [], error: String(err?.message || err) }))
    )
  );

  const all = results.flatMap((r, i) => {
    const label = labels[i] || r.url.split('/').slice(-2, -1)[0];
    return (r.events || []).map(ev => ({ ...ev, src: i, srcLabel: label }));
  });

  const upcoming = all
    .filter(ev => {
      const ts = ev.start ? Date.parse(ev.start) : NaN;
      return !isNaN(ts) && ts >= fromTs && ts <= horizon;
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, 400);

  const body = { events: upcoming, count: upcoming.length };

  if (debug) {
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

  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: cors({ 'Content-Type': 'application/json' }, origin),
  });
}

// Helpers (labels)
function guessLabelFromURL(urlStr) {
  try {
    const url = new URL(urlStr);
    const parts = url.pathname.split('/');
    const id = decodeURIComponent(parts[parts.length - 2] || 'Agenda');
    if (id.includes('@')) {
      return id.split('@')[0];
    }
    return id.split('.').slice(-2, -1)[0] || 'Agenda';
  } catch {
    return 'Agenda';
  }
}