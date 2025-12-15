export default async function handler(req, res) {
  // L'URL du flux du Soir
  const rssUrl = 'https://www.lesoir.be/rss/81851';

  try {
    // 1. Vercel va chercher le flux (Côté serveur, donc pas de blocage CORS)
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    // 2. On récupère le texte brut (XML)
    const xmlData = await response.text();

    // 3. On le renvoie proprement à ton site
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(xmlData);

  } catch (error) {
    console.error("Erreur API News:", error);
    res.status(500).json({ error: 'Impossible de récupérer le flux' });
  }
}
