// /api/news.js
export default async function handler(req, res) {
  const rssUrl = 'https://www.lesoir.be/rss/81851';

  try {
    // On utilise un User-Agent pour simuler un navigateur et éviter le blocage
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP distante: ${response.status} ${response.statusText}`);
    }

    const xmlData = await response.text();

    // Headers pour indiquer que c'est du XML et gérer le cache (10 min)
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    
    // Envoi de la réponse
    res.status(200).send(xmlData);

  } catch (error) {
    console.error("ERREUR API NEWS :", error);
    res.status(500).json({ error: error.message });
  }
}
