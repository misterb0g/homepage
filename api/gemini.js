import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  runtime: 'nodejs',
};

const ALLOWED_ORIGIN = 'https://start.bogarts.be';

function cors(headers = {}, origin = '') {
  const allow = origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allow,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...headers,
  };
}

export default async function handler(req, res) { // On ajoute 'res' pour la cohérence avec Node.js
  // La correction est ici : on utilise la syntaxe Node.js pour les en-têtes
  const origin = req.headers.origin || '';

  if (req.method === 'OPTIONS') {
    // En Node.js, on utilise l'objet 'res' pour répondre
    res.status(204).json({});
    return;
  }
  
  // Utilisation de 'res' pour les autres réponses également
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('La variable d\'environnement GEMINI_API_KEY est manquante ou vide sur Vercel.');
    }

    const payload = req.body; // En Node.js, le corps est déjà parsé dans req.body
    const { prompt } = payload;

    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Le prompt est requis dans la requête.');
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const response = await result.response;
    const text = response.text();

    const headers = cors({}, origin);
    // On applique les headers manuellement
    Object.keys(headers).forEach(key => res.setHeader(key, headers[key]));
    
    res.status(200).json({ text });

  } catch (error) {
    console.error("Erreur détaillée dans la fonction Gemini:", error);
    const headers = cors({ 'Content-Type': 'application/json' }, origin);
    Object.keys(headers).forEach(key => res.setHeader(key, headers[key]));
    res.status(500).json({ error: `Erreur côté serveur : ${error.message}` });
  }
}