export default async function handler(req, res) {
  // L'URL magique : On demande à Google News le flux RSS uniquement pour le site "lesoir.be"
  // Paramètres : hl=fr (Français), gl=BE (Belgique)
  const googleNewsUrl = 'https://news.google.com/rss/search?q=site:lesoir.be&hl=fr&gl=BE&ceid=BE:fr';

  try {
    const response = await fetch(googleNewsUrl);

    if (!response.ok) {
      throw new Error(`Erreur Google News: ${response.status}`);
    }

    const xmlData = await response.text();

    // Vérification de sécurité
    if (!xmlData.includes('<rss') && !xmlData.includes('<feed')) {
         throw new Error("Le contenu reçu n'est pas un flux RSS valide.");
    }

    // On nettoie un peu le XML si nécessaire (Google ajoute parfois des suffixes aux titres)
    // Mais pour l'instant, on renvoie brut, votre index.html gère bien le standard RSS.
    
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    
    res.status(200).send(xmlData);

  } catch (error) {
    console.error("ERREUR API NEWS :", error);
    res.status(500).json({ error: error.message });
  }
}
