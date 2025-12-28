import { GoogleGenerativeAI } from "@google/generative-ai";

// On peut passer en edge pour plus de rapidité si la lib le supporte bien
export const config = { runtime: 'nodejs' }; 

const ALLOWED_ORIGINS = ['https://start.bogarts.be', 'http://localhost:3000'];

function getCorsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';

  // 1. Gestion du Preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.writeHead(204, getCorsHeaders(origin));
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Clé API manquante dans les variables d’environnement.');
    }

    // Dans Node.js sur Vercel, req.body est déjà un objet si le Content-Type est JSON
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Le prompt est vide.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Utilisation de 1.5-flash pour la rapidité sur une page de démarrage
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Appliquer les headers CORS à la réponse de succès
    const headers = getCorsHeaders(origin);
    Object.keys(headers).forEach(key => res.setHeader(key, headers[key]));

    return res.status(200).json({ text });

  } catch (error) {
    console.error("Erreur Gemini:", error);
    return res.status(500).json({ 
      error: "Erreur lors de la génération", 
      details: error.message 
    });
  }
}