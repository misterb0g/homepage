import Parser from 'rss-parser';

export default async function handler(request, response) {
  const parser = new Parser({
    xml2js: { strict: false } // Permet d'ignorer les petites erreurs de syntaxe XML
  });

  try {
    // 1. On utilise le Megaflux (qui contient MacG, iGen, ClubiGen, etc.)
    const targetUrl = 'https://www.macg.co/rss';
    
    // 2. On définit un User-Agent de navigateur moderne pour éviter le blocage 403
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    // 3. On récupère le flux manuellement
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': userAgent,
      }
    });

    if (!res.ok) {
      throw new Error(`Erreur HTTP: ${res.status}`);
    }

    const textData = await res.text();

    // 4. Vérification de sécurité : est-ce bien du XML ?
    if (textData.trim().startsWith('<!DOCTYPE html>')) {
      throw new Error('Le site a renvoyé une page HTML au lieu du RSS (Blocage)');
    }

    // 5. Parsing du XML
    const feed = await parser.parseString(textData);

    // 6. Nettoyage et formatage (On prend les 4 premiers articles)
    const items = feed.items.slice(0, 4).map(item => ({
      title: item.title,
      link: item.link,
      // Fallback date si jamais elle est absente
      date: item.pubDate || new Date().toISOString(),
      // Le créateur ou le nom du site source
      author: item.creator || 'MacG' 
    }));

    // 7. Envoi de la réponse avec cache
    response.setHeader('Cache-Control', 's-maxage=600'); 
    response.status(200).json(items);

  } catch (error) {
    console.error("Erreur API News:", error.message);
    // En cas d'erreur, on renvoie un tableau vide pour que le site reste propre
    response.status(200).json([]); 
  }
}
