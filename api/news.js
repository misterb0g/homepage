import Parser from 'rss-parser';

export default async function handler(request, response) {
  // 1. On configure le parser en mode "non-strict" pour qu'il ne plante pas
  // sur les petites erreurs XML du site distant.
  const parser = new Parser({
    xml2js: {
      strict: false, 
    },
    // On ajoute un User-Agent pour ne pas se faire bloquer comme un "bot"
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
    }
  });

  try {
    // 2. Récupérer le flux
    const feed = await parser.parseURL('https://clubigen.fr/feed/');

    // 3. Nettoyer et limiter à 4 articles
    const items = feed.items.slice(0, 4).map(item => ({
      title: item.title,
      link: item.link,
      // On s'assure qu'il y a une date, sinon on met la date du jour
      date: item.pubDate || new Date().toISOString(),
      author: item.creator
    }));

    // 4. Renvoyer le JSON
    response.setHeader('Cache-Control', 's-maxage=600'); 
    response.status(200).json(items);

  } catch (error) {
    console.error("Erreur RSS détaillée:", error);
    // En cas d'erreur, on renvoie un tableau vide pour ne pas casser la homepage
    response.status(200).json([]); 
  }
}
