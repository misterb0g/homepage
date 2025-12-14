import Parser from 'rss-parser';

export default async function handler(request, response) {
  // Initialiser le parser
  const parser = new Parser();

  try {
    // 1. Récupérer le flux RSS de ClubiGen
    const feed = await parser.parseURL('https://clubigen.fr/feed/');

    // 2. Nettoyer et limiter à 4 articles
    const items = feed.items.slice(0, 4).map(item => ({
      title: item.title,
      link: item.link,
      date: item.pubDate, // Vercel gérera ça, mais on peut le formater côté front
      author: item.creator
    }));

    // 3. Renvoyer le JSON (Cache de 10 minutes pour être gentil avec leur serveur)
    response.setHeader('Cache-Control', 's-maxage=600'); 
    response.status(200).json(items);

  } catch (error) {
    console.error("Erreur RSS:", error);
    response.status(500).json({ error: 'Impossible de récupérer les news' });
  }
}