// api/chat.js — Vercel Edge Function (Node 18+)
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response('OPENAI_API_KEY manquant', { status: 500 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const { prompt } = payload || {};
  if (!prompt || typeof prompt !== 'string') {
    return new Response('Prompt requis', { status: 400 });
  }

  // Prépare l’input pour la Responses API
  const system = "Tu es un assistant utile et concis. Réponds en français par défaut.";
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ];

  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',     // adapte si tu veux un autre modèle
      input: messages,
      text: { format: 'text' },  // flux texte simple
      stream: true,              // active le streaming
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    return new Response('Erreur OpenAI: ' + text, { status: 500 });
  }

  // Proxy du flux vers le client
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
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*', // serre la vis si tu veux restreindre
    },
  });
}
