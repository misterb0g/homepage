import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = { runtime: 'nodejs' };

const ALLOWED_ORIGIN = 'https://start.bogarts.be';

// Amélioration de la fonction CORS pour inclure localhost en test si besoin
function setCorsHeaders(res, origin) {
  const allow = origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : ALLOWED_ORIGIN;
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';

  // 1. Toujours mettre les headers CORS, même pour OPTIONS
  setCorsHeaders(res, origin);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Clé API manquante');

    // Sécurité : Vérifier si req.body existe (Vercel le parse par défaut pour le JSON)
    const prompt = req.body?.prompt;

    if (!prompt) {
      return res.status(400).json({ error: 'Le champ "prompt" est manquant dans le corps de la requête.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ text });

  } catch (error) {
    console.error("Erreur Gemini:", error.message);
    return res.status(500).json({ error: error.message });
  }
}