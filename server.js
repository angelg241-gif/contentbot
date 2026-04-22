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

const nicheMap = {
  misterio:
    "Historias de misterio, terror psicológico, fenómenos inexplicables, tensión narrativa, ambientes perturbadores y casos inquietantes.",
  curiosidades:
    "Curiosidades virales, datos sorprendentes, hechos raros, contenido que provoque asombro, conversación y retención.",
  motivacion:
    "Motivación, éxito, disciplina, mentalidad fuerte, superación personal, hábitos poderosos y mensajes de impacto.",
  drama:
    "Drama viral, gossip de internet, conflictos, polémicas, traiciones, historias intensas y emocionales.",
  historias_reales:
    "Historias reales inauditas, sucesos extraños documentados, relatos verdaderos impactantes, eventos difíciles de creer.",
  casos_sin_resolver:
    "Casos sin resolver, desapariciones misteriosas, expedientes abiertos, enigmas criminales, investigaciones sin cierre.",
  casos_resueltos:
    "Casos resueltos pero difíciles de procesar, investigaciones impactantes, verdades descubiertas que dejan una fuerte impresión emocional.",
  crimen_perturbador:
    "Crimen real perturbador, sucesos oscuros, patrones extraños, eventos inquietantes y difíciles de olvidar."
};

function buildSystemPrompt({ niche, platform, duration }) {
  return `
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
- El hook debe ser muy fuerte, rápido y viral.
- El desarrollo debe ser natural, narrativo, atrapante y fácil de narrar con voz IA.
- El CTA debe impulsar comentarios, debate o interacción.
- Las notas visuales deben servir para Higgsfield, Pexels o material stock.
- La guía CapCut debe ser práctica, accionable y específica.
- Adapta todo a ${platform}.
- Duración objetivo: ${duration} segundos.
- Nicho: ${nicheMap[niche] || niche}.
- Si el nicho es de casos reales o crimen, usa tono serio, inmersivo y responsable.
- No inventes medios ni cites fuentes falsas.
- Si el contenido parece basado en hechos reales, redacta de forma narrativa sin afirmar detalles no verificados como absolutos.
- Hazlo altamente consumible para formato short-form.
`;
}

async function generateOne({ niche, platform, duration, topic }) {
  const response = await client.responses.create({
    model: "gpt-5.4",
    input: [
      {
        role: "system",
        content: buildSystemPrompt({ niche, platform, duration })
      },
      {
        role: "user",
        content: `
Tema del video: ${topic}
Plataforma: ${platform}
Duración: ${duration} segundos
Nicho: ${niche}

Genera un contenido altamente viral y útil para producción.
`
      }
    ]
  });

  const text = (response.output_text || "").trim();

  if (!text) {
    throw new Error("La IA devolvió respuesta vacía");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`La IA no devolvió JSON válido. Respuesta: ${text}`);
  }
}

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
        error: "Falta OPENAI_API_KEY en variables de entorno"
      });
    }

    if (!niche || !platform || !duration || !topic) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos para generar el contenido"
      });
    }

    const parsed = await generateOne({ niche, platform, duration, topic });

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

app.post("/generate-daily-pack", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Falta OPENAI_API_KEY en variables de entorno"
      });
    }

    const platform = "TikTok";
    const duration = "60";

    const pack = [
      {
        niche: "misterio",
        topic: "Una historia perturbadora ocurrida en un lugar aparentemente normal"
      },
      {
        niche: "historias_reales",
        topic: "Un caso real tan extraño que parece inventado"
      },
      {
        niche: "casos_sin_resolver",
        topic: "Una desaparición sin explicación que sigue generando preguntas"
      },
      {
        niche: "casos_resueltos",
        topic: "Un caso resuelto cuya verdad fue más inquietante que las teorías"
      },
      {
        niche: "crimen_perturbador",
        topic: "Un crimen real difícil de procesar por lo extraño de sus detalles"
      },
      {
        niche: "curiosidades",
        topic: "Un dato viral tan raro que parece mentira"
      },
      {
        niche: "motivacion",
        topic: "Una historia de disciplina extrema que inspire a actuar hoy"
      },
      {
        niche: "drama",
        topic: "Un drama de internet que cambió la imagen de alguien para siempre"
      }
    ];

    const results = [];

    for (const item of pack) {
      try {
        const parsed = await generateOne({
          niche: item.niche,
          platform,
          duration,
          topic: item.topic
        });

        results.push({
          niche: item.niche,
          topic: item.topic,
          data: parsed
        });
      } catch (err) {
        results.push({
          niche: item.niche,
          topic: item.topic,
          error: err.message
        });
      }
    }

    return res.json({
      ok: true,
      date: new Date().toISOString(),
      results
    });
  } catch (error) {
    console.error("ERROR /generate-daily-pack:", error);

    return res.status(500).json({
      ok: false,
      error: "Error generando pack diario",
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