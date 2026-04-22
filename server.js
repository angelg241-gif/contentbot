import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.APP_PASSWORD || "1234";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/login", (req, res) => {
  const { password } = req.body || {};

  if (password === PASSWORD) {
    return res.json({ ok: true });
  }

  return res.status(401).json({
    ok: false,
    error: "Contraseña incorrecta"
  });
});

app.post("/generate", async (req, res) => {
  try {
    const { niche, platform, duration, topic } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Falta OPENAI_API_KEY en Render"
      });
    }

    if (!niche || !platform || !duration || !topic) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos para generar el contenido"
      });
    }

    const nicheMap = {
      misterio: "Historias de misterio, terror psicológico, casos perturbadores, fenómenos inexplicables y tensión narrativa.",
      curiosidades: "Curiosidades virales, datos sorprendentes, hechos raros, contenido que provoque asombro y conversación.",
      motivacion: "Motivación, éxito, disciplina, mentalidad fuerte, superación personal y mensajes de impacto.",
      drama: "Drama viral, gossip de internet, conflictos, polémicas, traiciones, historias intensas y emocionales."
    };

    const systemPrompt = `
Eres un estratega experto en contenido viral faceless para TikTok, Instagram Reels y YouTube Shorts.

Tu trabajo es generar guiones en español listos para producir.
Debes responder SOLO JSON válido.
No uses markdown.
No uses backticks.
No pongas texto fuera del JSON.

La respuesta debe seguir EXACTAMENTE esta estructura:

{
  "title": "string",
  "hook": "string",
  "development": "string",
  "cta": "string",
  "hashtags": ["string", "string", "string", "string", "string", "string"],
  "visual_notes": "string",
  "algorithm_tip": "string",
  "capcut_guide": {
    "voice": "string",
    "images": ["string", "string", "string", "string"],
    "editing": "string",
    "screen_text": "string",
    "music": "string",
    "export": "string"
  }
}

Reglas:
- El hook debe ser fuerte, rápido y viral.
- El desarrollo debe ser natural, atractivo y fácil de narrar.
- El CTA debe impulsar comentarios o interacción.
- Las notas visuales deben servir para Higgsfield, Pexels o material stock.
- La guía CapCut debe ser práctica y accionable.
- Adapta todo a ${platform}.
- Duración objetivo: ${duration} segundos.
- Nicho: ${nicheMap[niche] || niche}.
`;

    const userPrompt = `
Tema del video: ${topic}

Plataforma: ${platform}
Duración: ${duration} segundos
Nicho: ${niche}

Genera un contenido altamente viral y útil para producción.
`;

    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ]
    });

    const text = (response.output_text || "").trim();

    if (!text) {
      return res.status(500).json({
        ok: false,
        error: "La IA devolvió respuesta vacía"
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: "La IA no devolvió JSON válido",
        raw: text
      });
    }

    return res.json({
      ok: true,
      data: parsed
    });
  } catch (error) {
    console.error("ERROR /generate:", error);

    return res.status(500).json({
      ok: false,
      error: "Error generando contenido",
      details: error?.message || "Error desconocido"
    });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});