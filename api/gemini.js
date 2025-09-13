import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = { runtime: 'nodejs' };

const ALLOWED_ORIGIN = 'https://start.bogarts.be';

function cors(headers = {}, origin = '') {
  const allow = origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : ALLOWED_ORIGIN;
  return { ...headers, 'Access-Control-Allow-Origin': allow, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const corsHeaders = cors({}, origin);
  Object.keys(corsHeaders).forEach(key => res.setHeader(key, corsHeaders[key]));
  
  if (req.method === 'OPTIONS') { return res.status(204).end(); }
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Method Not Allowed' }); }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY est manquante.');
    
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) throw new Error('Le paramètre "messages" (tableau) est requis.');

    // Transformation du format des messages pour l'API Gemini
    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }],
      }));

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      systemInstruction: systemInstruction,
    });
    
    const result = await model.generateContent({ contents });
    const response = await result.response;
    const text = response.text();
    
    return res.status(200).json({ text });

  } catch (error) {
    console.error("Erreur Gemini:", error);
    return res.status(500).json({ error: error.message });
  }
}