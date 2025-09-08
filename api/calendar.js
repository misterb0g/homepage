export default async function handler(req, res) {
  // CORS
  setCors(res, req.headers.origin || '');

  // Préflight OPTIONS
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  try {
    // Récupération des URLs (CAL1_ICS_URL… ou fallback)
    const envUrls = [
      process.env.CAL1_ICS_URL,
      process.env.CAL2_ICS_URL,
      process.env.CAL3_ICS_URL,
      process.env.CAL4_ICS_URL,
      process.env.CAL5_ICS_URL,
      process.env.CAL6_ICS_URL,
      process.env.CAL7_ICS_URL,
      process.env.CAL8_ICS_URL,
    ].filter(Boolean);
    const fallbackUrls = typeof FALLBACK_ICS_URLS !== 'undefined' ? FALLBACK_ICS_URLS : [];
    const urls = envUrls.length ? envUrls : fallbackUrls;

    if (!urls.length) {
      res.status(200).json({ events: [], error: 'No iCal URLs configured', hint: 'Définis CAL_ICS_URLS ou CAL1_ICS_URL…' });
      return;
    }

    // Labels (optionnels) – par exemple Perso,Famille,Silex
    const labelList = (process.env.CAL_ICS_LABELS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    // Récupération de chaque .ics (tolérance aux erreurs individuelles)
    const results = await Promise.all(urls.map(u =>
      fetchICS(u).catch(err => ({ __ics_error: String(err) }))
    ));

    // On annote chaque évènement avec src et srcLabel
    const events = results.flatMap((r, idx) => {
      if (!Array.isArray(r)) return [];
      const label = labelList[idx] || guessLabelFromURL(urls[idx]);
      return r.map(ev => ({ ...ev, src: idx, srcLabel: label }));
    });

    // Fenêtre temporelle configurable via ?days=14 (1 ≤ days ≤ 90)
    const days = Math.max(1, Math.min(90, Number(req.query?.days) || 14));
    const now = Date.now();
    const limit = now + days * 24 * 3600 * 1000;

    const upcoming = events
      .filter(ev => {
        const ts = ev.start ? Date.parse(ev.start) : 0;
        return ts >= now && ts <= limit;
      })
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .slice(0, 400);

    const body = { events: upcoming, count: upcoming.length };
    if (req.query?.debug === '1' || req.query?.debug === 'true') {
      body.debug = {
        urlsUsed: urls,
        perUrl: results.map((r, i) => ({
          url: urls[i],
          count: Array.isArray(r) ? r.length : 0,
          error: r.__ics_error || null,
        })),
        days,
      };
    }
    res.status(200).json(body);
  } catch (err) {
    res.status(500).json({
      error: String(err?.message || err),
      note: "Erreur interne ou URL iCal inaccessible. Vérifie tes variables d'environnement et l’accessibilité des flux.",
    });
  }
}
