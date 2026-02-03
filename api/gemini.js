import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = { runtime: 'nodejs' };

const ALLOWED_ORIGIN = 'https://start.bogarts.be';

export default async function handler(req, res) {
  const origin = req.headers.origin || '';

  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch {}
    }

    const prompt = body?.prompt;
    if (!prompt) {
      return res.status(400).json({ error: 'Champ "prompt" manquant.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // ✅ modèle stable
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const result = await model.generateContent(prompt);
    const response = await result.response;

    return res.status(200).json({ text: response.text() });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
