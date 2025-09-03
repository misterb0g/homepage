// api/chat.js — Vercel Edge Function (non-stream, gpt-4o-mini)
export const config = { runtime: 'edge' };

function cors(headers = {}) {
  return {
    'Access-Control-Allow-Origin': '*', // ⚠️ ouvre à tout, resserre après (ton domaine uniquement)
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...headers,
  };
}

export default async function handler(req) {
  // Préflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors() });
  }

  // Autoriser uniquement POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: cors() });
  }

  // Vérifier la clé API
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      'OPENAI_API_KEY manquant. Définis la variable dans Vercel → Settings → Environment Variables → Redeploy.',
      { status: 500, headers: cors() }
    );
  }

  // Lire le payload
  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad Request: JSON invalide', { status: 400, headers: cors() });
  }

  const { prompt } = payload || {};
  if (!prompt || typeof prompt !== 'string') {
    return new Response('Prompt requis (string)', { status: 400, headers: cors() });
  }

  // Préparer l'entrée pour Responses API
  const input = [
    { role: 'system', content: 'Tu es un assistant utile et concis. Réponds en français.' },
    { role: 'user', content: prompt },
  ];

  // Appel OpenAI Responses API
  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // ✅ modèle rapide et éco
      input,
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(`Erreur OpenAI upstream: ${text}`, { status: 500, headers: cors() });
  }

  // Réponse OpenAI
  let data;
  try {
    data = await upstream.json();
  } catch {
    return new Response('Erreur: réponse OpenAI non-JSON', { status: 502, headers: cors() });
  }

  const reply =
    data?.output_text
    ?? data?.output?.[0]?.content?.[0]?.text
    ?? 'Réponse vide.';

  return new Response(JSON.stringify({ reply, _debug: { model: 'gpt-4o-mini' } }), {
    status: 200,
    headers: cors({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }),
  });
}
