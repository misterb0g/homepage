// api/chat.js — version non-stream (diagnostic)
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }});
  }
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response('OPENAI_API_KEY manquant', { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });

  let payload; try { payload = await req.json(); } catch { return new Response('Bad Request', { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }); }
  const { prompt } = payload || {};
  if (!prompt) return new Response('Prompt requis', { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });

  const input = [
    { role: 'system', content: 'Tu es un assistant utile et concis. Réponds en français.' },
    { role: 'user', content: prompt },
  ];

  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4.1-mini', input }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response('Erreur OpenAI: ' + text, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const data = await upstream.json();
  const reply = data.output_text || 'Réponse vide.';
  return new Response(JSON.stringify({ reply }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
