// api/chat.js — Vercel Edge Function (stream SSE → texte brut, gpt-4o-mini)
export const config = { runtime: 'edge' };

function cors(headers = {}) {
  return {
    'Access-Control-Allow-Origin': '*', // resserre ensuite à ton domaine
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
  // POST uniquement
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: cors() });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response('OPENAI_API_KEY manquant (Vercel → Env Vars → Redeploy).', {
      status: 500, headers: cors()
    });
  }

  // Lire le prompt
  let payload;
  try { payload = await req.json(); } catch { return new Response('Bad Request: JSON invalide', { status: 400, headers: cors() }); }
  const { prompt } = payload || {};
  if (!prompt || typeof prompt !== 'string') {
    return new Response('Prompt requis (string)', { status: 400, headers: cors() });
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
      // text: { format: 'text' }, // optionnel ; le framing restera SSE de toute façon
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    return new Response(`Erreur OpenAI upstream: ${text}`, { status: 500, headers: cors() });
  }

  // Transforme SSE → texte (on n’émet que les delta texte)
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = ''; // buffer lignes incomplètes

      function emit(text) {
        controller.enqueue(new TextEncoder().encode(text));
      }

      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // On découpe par “double newline” (séparateur d’événements SSE)
          let idx;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);

            // Chaque événement SSE contient possiblement plusieurs lignes :
            // event: <type>
            // data: <json>
            // (on ne se sert que de data:)
            const lines = chunk.split('\n').map(l => l.trim());
            const dataLine = lines.find(l => l.startsWith('data:'));
            if (!dataLine) continue;

            const jsonStr = dataLine.slice(5).trim(); // après "data:"
            if (!jsonStr) continue;

            // Certains évts “keep-alive” peuvent envoyer “data: [DONE]” (selon APIs)
            if (jsonStr === '[DONE]') continue;

            let evt;
            try { evt = JSON.parse(jsonStr); } catch { continue; }

            const type = evt?.type;
            // On émet UNIQUEMENT les deltas de texte
            if (type === 'response.output_text.delta') {
              const delta = evt?.delta ?? evt?.data ?? '';
              if (delta) emit(delta);
            }
            // Si erreur côté OpenAI dans le flux
            if (type === 'response.error') {
              const msg = evt?.error?.message || 'Erreur inconnue';
              emit(`\n[Erreur OpenAI] ${msg}`);
            }
            // Fin de génération
            if (type === 'response.completed') {
              // on peut fermer ici si on veut stopper immédiatement
            }
          }
        }
        // vider le buffer restant (peu probable utile)
        if (buffer) {
          // tentative de parse finale si data JSON present
          const m = buffer.match(/^data:\s*(\{.*\})/m);
          if (m) {
            try {
              const evt = JSON.parse(m[1]);
              if (evt?.type === 'response.output_text.delta' && evt?.delta) {
                emit(evt.delta);
              }
            } catch {}
          }
        }
      } catch (e) {
        console.error(e);
        emit('\n[Erreur de flux]');
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
