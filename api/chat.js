// api/chat.js — Vercel Edge Function (stream, gpt-4o-mini)
export const config = { runtime: 'edge' };

function cors(headers = {}) {
  return {
    'Access-Control-Allow-Origin': '*', // 🔒 à restreindre à ton domaine quand tout marche
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

  // Clé API
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response('OPENAI_API_KEY manquant (config Vercel → Env Vars → Redeploy).', {
      status: 500,
      headers: cors(),
    });
  }

  // Lire payload
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

  // Messages (Responses API accepte un "input" souple)
  const input = [
    { role: 'system', content: 'Tu es un assistant utile et concis. Réponds en français.' },
    { role: 'user', content: prompt },
  ];

  // Appel OpenAI en streaming
  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // modèle rapide/éco
      input,
      stream: true,         // ⬅️ streaming activé
      // (optionnel) text: { format: 'text' }, // certains comptes préfèrent l’activer
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    return new Response(`Erreur OpenAI upstream: ${text}`, { status: 500, headers: cors() });
  }

  // Proxy du flux tel quel
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch (e) {
        console.error(e);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: cors({
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    }),
  });
}
