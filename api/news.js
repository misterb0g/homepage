import Parser from 'rss-parser';

export default async function handler(request, response) {
  // Le flux principal et sécurisé de MacGeneration (souvent le plus fiable)
  const targetUrl = 'https://www.macg.co/rss'; 
  
  // Configuration du parser avec les options pour contourner les protections
  const parser = new Parser({
    // 1. requestOptions pour passer le User-Agent (simule un vrai navigateur)
    requestOptions: {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    },
    // 2. xml2js en non-strict pour ignorer les erreurs de format XML
    xml2js: { 
        strict: false 
    },
  });

  try {
    // Utilisation directe de parseURL (le parser gère le flux)
    const feed = await parser.parseURL(targetUrl);

    // Si feed.items est vide, c'est que quelque chose a mal tourné (on génère une erreur contrôlée)
    if (!feed.items || feed.items.length === 0) {
        throw new Error('Le flux RSS est vide ou non reconnu. Blocage probable.');
    }

    // Nettoyage et formatage (On prend les 4 premiers articles)
    const items = feed.items.slice(0, 4).map(item => ({
      title: item.title,
      link: item.link,
      // item.isoDate est plus fiable que pubDate dans ce cas
      date: item.pubDate || item.isoDate || new Date().toISOString(), 
      author: item.creator || item.author || 'MacG'
    }));

    // Envoi de la réponse (Cache de 10 minutes)
    response.setHeader('Cache-Control', 's-maxage=600'); 
    response.status(200).json(items);

  } catch (error) {
    console.error("Erreur API News:", error.message);
    
    // Renvoyer un message d'erreur explicite pour qu'il s'affiche sur la page
    response.status(200).json([
        { title: `Erreur: Impossible de charger le flux. Cause: ${error.message.substring(0, 60)}...`, link: "#", date: new Date().toISOString() }
    ]); 
  }
}
