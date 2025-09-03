// api/chat.js — Vercel Edge Function (stream SSE → texte, CORS restreint)
export const config = { runtime: 'edge' };

// ⚠️ Autorise UNIQUEMENT ton domaine de prod.
// Ajoute tes domains de preview si besoin.
const ALLOWED_ORIGIN = 'https://start.bogarts.be';

function cors(headers = {}, origin = '') {
  const allow = origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allow,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...headers,
  };
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';

  // Préflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors({}, origin) });
  }
  // POST uniquement
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: cors({}, origin) });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response('OPENAI_API_KEY manquant (Vercel → Env Vars → Redeploy).', {
      status: 500, headers: cors({}, origin)
    });
  }

  // Lire le prompt
  let payload;
  try { payload = await req.json(); }
  catch { return new Response('Bad Request: JSON invalide', { status: 400, headers: cors({}, origin) }); }
  const { prompt } = payload || {};
  if (!prompt || typeof prompt !== 'string') {
    return new Response('Prompt requis (string)', { status: 400, headers: cors({}, origin) });
  }

  // Messages
  const input = [
    { role: 'system', content: 'Tu es un assistant utile et concis. Réponds en français.' },
    { role: 'user', content: prompt },
  ];

  // Appel OpenAI en STREAM (SSE)
  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      input,
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    return new Response(`Erreur OpenAI upstream: ${text}`, { status: 500, headers: cors({}, origin) });
  }

  // Transforme SSE → texte (on n’émet que les deltas de texte)
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder('utf-8');
      const encode = (t) => new TextEncoder().encode(t);
      let buffer = '';

      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const dataLine = chunk.split('\n').map(l => l.trim()).find(l => l.startsWith('data:'));
            if (!dataLine) continue;
            const jsonStr = dataLine.slice(5).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;

            try {
              const evt = JSON.parse(jsonStr);
              if (evt?.type === 'response.output_text.delta') {
                const delta = evt?.delta ?? '';
                if (delta) controller.enqueue(encode(delta));
              }
              if (evt?.type === 'response.error') {
                const msg = evt?.error?.message || 'Erreur inconnue';
                controller.enqueue(encode(`\n[Erreur OpenAI] ${msg}`));
              }
            } catch { /* ignore parse errors */ }
          }
        }
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
    }, origin),
  });
}
