import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = { runtime: "nodejs" };

const ALLOWED_ORIGIN = "https://start.bogarts.be";

// Ordre de fallback : modèles connus compatibles generateContent sur l'API Gemini (v1beta)
const MODEL_CANDIDATES = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
];

async function listModels(apiKey) {
  // Endpoint officiel list models (utile pour diagnostiquer les noms réellement disponibles pour ta clé)
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`ListModels a échoué: ${t}`);
  }
  const j = await r.json();
  return j.models || [];
}

async function tryGenerate(genAI, prompt) {
  let lastErr = null;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return { model: modelName, text: response.text() };
    } catch (e) {
      // On garde l'erreur et on tente le prochain modèle
      lastErr = e;
      // Si ce n'est pas un 404/NotFound, on remonte tout de suite (quota, auth, etc.)
      const msg = String(e?.message || e);
      if (!msg.includes("404") && !msg.toLowerCase().includes("not found")) {
        throw e;
      }
    }
  }

  // Tous les modèles ont échoué (probablement changement de nomenclature / accès clé)
  const msg = String(lastErr?.message || lastErr || "Erreur inconnue");
  throw new Error(
    `Aucun modèle Gemini de la liste n'est disponible pour generateContent. Dernière erreur: ${msg}. ` +
    `Astuce: appelle /api/gemini?listModels=1 pour obtenir la liste des modèles accessibles.`
  );
}

export default async function handler(req, res) {
  // CORS (simple et explicite)
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY manquante côté serveur." });

    // Endpoint de diagnostic (non destiné au grand public)
    if (req.method === "GET") {
      const wantList = (req.query?.listModels === "1") || (req.query?.listModels === "true");
      if (!wantList) return res.status(404).json({ error: "Not found" });

      const models = await listModels(apiKey);
      // On renvoie un sous-ensemble utile : name + supportedGenerationMethods (si présent)
      const simplified = models.map(m => ({
        name: m.name,
        displayName: m.displayName,
        supportedGenerationMethods: m.supportedGenerationMethods,
      }));
      return res.status(200).json({ models: simplified });
    }

    // POST : génération
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    }

    const prompt = body?.prompt;
    if (!prompt) return res.status(400).json({ error: 'Champ "prompt" manquant.' });

    const genAI = new GoogleGenerativeAI(apiKey);
    const out = await tryGenerate(genAI, prompt);

    return res.status(200).json({ text: out.text, model: out.model });
  } catch (error) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
