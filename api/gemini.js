import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = { runtime: 'nodejs' };

const ALLOWED_ORIGIN = 'https://start.bogarts.be';

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  
  // Headers CORS
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    // On essaie de récupérer le prompt que ce soit déjà parsé ou non
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { /* pas du JSON */ }
    }

    const prompt = body?.prompt;

    if (!prompt) {
      return res.status(400).json({ 
        error: 'Le champ "prompt" est manquant dans le corps de la requête.',
        debug: { receivedBody: body } // Pour t'aider à voir ce que le serveur reçoit
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    return res.status(200).json({ text: response.text() });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}