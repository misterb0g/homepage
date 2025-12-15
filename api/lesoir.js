export default async function handler(req, res) {
  // Flux Google News ciblant Le Soir
  const googleNewsUrl = 'https://news.google.com/rss/search?q=site:lesoir.be&hl=fr&gl=BE&ceid=BE:fr';

  try {
    const response = await fetch(googleNewsUrl);

    if (!response.ok) {
      throw new Error(`Erreur Google News: ${response.status}`);
    }

    const xmlData = await response.text();
    
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    
    res.status(200).send(xmlData);

  } catch (error) {
    console.error("ERREUR API LE SOIR :", error);
    res.status(500).json({ error: error.message });
  }
}
