// Utilisation de la syntaxe compatible Node.js standard (CommonJS)
module.exports = async (req, res) => {
  const rssUrl = 'https://www.lesoir.be/rss/81851';

  try {
    // Requête vers le flux RSS avec un User-Agent de navigateur pour éviter le blocage
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Erreur distante: ${response.status} ${response.statusText}`);
    }

    const xmlData = await response.text();

    // On renvoie le XML proprement
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    // Cache-Control pour éviter de spammer le serveur du Soir (cache de 10 minutes)
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    
    res.status(200).send(xmlData);

  } catch (error) {
    console.error("ERREUR API NEWS :", error); // Ceci apparaîtra dans les logs Vercel
    res.status(500).json({ error: error.message });
  }
};
