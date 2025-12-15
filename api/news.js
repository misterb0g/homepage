export default async function handler(req, res) {
  // L'URL cible (Le Soir)
  const targetUrl = 'https://www.lesoir.be/rss/81851';
  
  // On passe par un service intermédiaire pour contourner le blocage IP de Vercel
  // "AllOrigins" va chercher la page pour nous et nous renvoie le contenu brut
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

  try {
    const response = await fetch(proxyUrl);

    if (!response.ok) {
      throw new Error(`Erreur Proxy: ${response.status}`);
    }

    const xmlData = await response.text();

    // Vérification basique que nous avons bien reçu du XML et pas une page d'erreur du proxy
    if (!xmlData.includes('<?xml') && !xmlData.includes('<rss')) {
         throw new Error("Le contenu reçu n'est pas un flux RSS valide.");
    }

    // On renvoie le XML à votre site
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    // On garde un cache pour éviter de surcharger le proxy
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    
    res.status(200).send(xmlData);

  } catch (error) {
    console.error("ERREUR API NEWS :", error);
    res.status(500).json({ error: error.message });
  }
}
