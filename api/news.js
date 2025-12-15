export default async function handler(req, res) {
  // L'URL magique : On demande à Google News les articles venant UNIQUEMENT de "macg.co"
  // On utilise gl=FR car c'est un site français (donne souvent de meilleurs résultats que BE pour les sites tech fr)
  const googleNewsUrl = 'https://news.google.com/rss/search?q=site:macg.co&hl=fr&gl=FR&ceid=FR:fr';

  try {
    const response = await fetch(googleNewsUrl);

    if (!response.ok) {
      throw new Error(`Erreur Google News: ${response.status}`);
    }

    const xmlData = await response.text();

    if (!xmlData.includes('<rss') && !xmlData.includes('<feed')) {
         throw new Error("Le contenu reçu n'est pas un flux RSS valide.");
    }
    
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    
    res.status(200).send(xmlData);

  } catch (error) {
    console.error("ERREUR API NEWS :", error);
    res.status(500).json({ error: error.message });
  }
}
