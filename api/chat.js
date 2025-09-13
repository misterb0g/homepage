export const config = { runtime: 'edge' };

const ALLOWED_ORIGIN = 'https://start.bogarts.be';

function cors(headers = {}, origin = '') {
  const allow = origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : ALLOWED_ORIGIN;
  return { ...headers, 'Access-Control-Allow-Origin': allow, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  if (req.method === 'OPTIONS') { return new Response(null, { status: 204, headers: cors({}, origin) }); }
  if (req.method !== 'POST') { return new Response('Method Not Allowed', { status: 405, headers: cors({}, origin) }); }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY manquant.');

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) throw new Error('Le paramètre "messages" (tableau) est requis.');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, stream: false }), // Note: stream: false pour une réponse simple
    });

    if (!res.ok) {
      const errorBody = await res.json();
      throw new Error(errorBody.error.message || `Erreur API OpenAI (${res.status})`);
    }

    const data = await res.json();
    const text = data.choices[0].message.content;

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: cors({ 'Content-Type': 'application/json' }),
    });

  } catch(error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: cors({ 'Content-Type': 'application/json' }, origin)
    });
  }
}