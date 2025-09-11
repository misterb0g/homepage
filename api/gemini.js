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

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors({}, origin) });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: cors({}, origin) });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('La variable d\'environnement GEMINI_API_KEY est manquante ou vide sur Vercel.');
    }

    const payload = await req.json();
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

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: cors({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, origin),
    });

  } catch (error) {
    console.error("Erreur détaillée dans la fonction Gemini:", error);
    return new Response(JSON.stringify({ error: `Erreur côté serveur : ${error.message}` }), {
      status: 500,
      headers: cors({ 'Content-Type': 'application/json' }, origin),
    });
  }
}