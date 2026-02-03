import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = { runtime: "nodejs" };

const ALLOWED_ORIGIN = "https://start.bogarts.be";

// Modèles candidats (ordre = préférence). Ajuste si ton ListModels montre d’autres noms.
const MODEL_CANDIDATES = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
];

const MAX_RETRIES_429 = 2; // 2 retries = 3 tentatives au total
const BASE_BACKOFF_MS = 1200;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function is429(err) {
  const msg = String(err?.message || err || "");
  return msg.includes("429") || msg.toLowerCase().includes("resource exhausted") || msg.toLowerCase().includes("too many requests");
}

function extractRetryAfterSeconds(err) {
  const msg = String(err?.message || err || "");
  // patterns fréquents vus dans les messages
  // 1) "Please retry in 54.52s"
  const m1 = msg.match(/retry in\s+([0-9.]+)s/i);
  if (m1) return Math.max(1, Math.ceil(parseFloat(m1[1])));

  // 2) JSON retryDelay:"54s"
  const m2 = msg.match(/"retryDelay"\s*:\s*"([0-9]+)s"/i);
  if (m2) return Math.max(1, parseInt(m2[1], 10));

  return null;
}

async function listModels(apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`ListModels a échoué: ${t}`);
  }
  const j = await r.json();
  return j.models || [];
}

async function generateWithModel(genAI, modelName, prompt) {
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return { model: modelName, text: response.text() };
}

async function tryGenerateWithFallback(genAI, prompt) {
  let lastErr = null;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      return await generateWithModel(genAI, modelName, prompt);
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);

      // Si ce n'est pas un 404/NotFound, on arrête le fallback modèle.
      // (quota 429, auth 401/403, etc.)
      if (!msg.includes("404") && !msg.toLowerCase().includes("not found")) {
        throw e;
      }
      // sinon on essaie le modèle suivant
    }
  }

  const msg = String(lastErr?.message || lastErr || "Erreur inconnue");
  throw new Error(
    `Aucun modèle Gemini de la liste n'est disponible pour generateContent. Dernière erreur: ${msg}. ` +
      `Astuce: appelle /api/gemini?listModels=1 pour obtenir la liste des modèles accessibles.`
  );
}

async function generateWithRetry(genAI, prompt) {
  let attempt = 0;

  while (true) {
    try {
      return await tryGenerateWithFallback(genAI, prompt);
    } catch (e) {
      if (!is429(e) || attempt >= MAX_RETRIES_429) throw e;

      const retryAfter = extractRetryAfterSeconds(e);
      const backoff = retryAfter ? retryAfter * 1000 : BASE_BACKOFF_MS * Math.pow(2, attempt);

      attempt += 1;
      await sleep(backoff);
    }
  }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY manquante côté serveur." });

    // Diagnostic : /api/gemini?listModels=1
    if (req.method === "GET") {
      const wantList = req.query?.listModels === "1" || req.query?.listModels === "true";
      if (!wantList) return res.status(404).json({ error: "Not found" });

      const models = await listModels(apiKey);
      const simplified = models.map((m) => ({
        name: m.name,
        displayName: m.displayName,
        supportedGenerationMethods: m.supportedGenerationMethods,
      }));
      return res.status(200).json({ models: simplified });
    }

    // POST : génération
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    const prompt = body?.prompt;
    if (!prompt) return res.status(400).json({ error: 'Champ "prompt" manquant.' });

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
      const out = await generateWithRetry(genAI, prompt);
      return res.status(200).json({ text: out.text, model: out.model });
    } catch (e) {
      // Gestion UX des 429 : message clair + Retry-After si on le détecte
      if (is429(e)) {
        const retryAfterSec = extractRetryAfterSeconds(e) ?? 60;
        res.setHeader("Retry-After", String(retryAfterSec));
        return res.status(503).json({
          error:
            `Gemini est temporairement indisponible (quota/rate limit). ` +
            `Réessaie dans ~${retryAfterSec}s, ou bascule sur ChatGPT.`,
        });
      }
      throw e;
    }
  } catch (error) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
