import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  runtime: 'edge',
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Renvoyer une erreur en JSON pour être cohérent
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY non configurée.' }), {
      status: 500, headers: cors({ 'Content-Type': 'application/json' }, origin),
    });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Requête invalide: JSON manquant ou incorrect' }), {
      status: 400, headers: cors({ 'Content-Type': 'application/json' }, origin)
    });
  }

  const { prompt } = payload;
  if (!prompt || typeof prompt !== 'string') {
    return new Response(JSON.stringify({ error: 'Le prompt est requis (string)' }), {
      status: 400, headers: cors({ 'Content-Type': 'application/json' }, origin)
    });
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  try {
    // === LA CORRECTION EST ICI ===
    // On envoie le prompt dans la structure attendue par l'API
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const response = await result.response;
    const text = response.text();

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: cors({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      }, origin),
    });
  } catch (error) {
    console.error("Erreur de l'API Gemini:", error);
    return new Response(JSON.stringify({ error: `Erreur de l'API Gemini : ${error.message}` }), {
      status: 500,
      headers: cors({ 'Content-Type': 'application/json' }, origin),
    });
  }
}
