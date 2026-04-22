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
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const GNEWS_API_KEY = process.env.GNEWS_API_KEY || "";

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

const nicheMap = {
  misterio:
    "Historias de misterio, terror psicológico, fenómenos inexplicables, tensión narrativa y casos inquietantes.",
  historias_reales:
    "Historias reales inauditas, sucesos extraños documentados, relatos verdaderos impactantes.",
  casos_sin_resolver:
    "Casos sin resolver, desapariciones misteriosas, expedientes abiertos, enigmas criminales.",
  casos_resueltos:
    "Casos resueltos pero difíciles de procesar, investigaciones impactantes y verdades inquietantes.",
  crimen_perturbador:
    "Crimen real perturbador, sucesos oscuros, eventos extraños e inquietantes.",
  curiosidades:
    "Curiosidades virales, datos sorprendentes, hechos raros, contenido que provoque asombro.",
  motivacion:
    "Motivación, éxito, disciplina, superación personal y mentalidad fuerte.",
  drama:
    "Drama viral, gossip de internet, conflictos, polémicas y traiciones."
};

const nicheQueries = {
  misterio: [
    'mysterious OR unexplained OR strange incident',
    'haunting OR eerie OR unexplained disappearance',
    'weird case OR unexplained event'
  ],
  historias_reales: [
    'real bizarre story OR unbelievable true story',
    'strange real event OR shocking true case',
    'documented strange case'
  ],
  casos_sin_resolver: [
    'unsolved case OR missing person OR unresolved mystery',
    'cold case OR disappearance unsolved',
    'unsolved investigation'
  ],
  casos_resueltos: [
    'case solved after years OR solved mystery shocking',
    'solved cold case OR investigation resolved',
    'truth revealed in solved case'
  ],
  crimen_perturbador: [
    'disturbing crime case OR bizarre crime',
    'strange murder investigation OR disturbing case',
    'criminal case shocking details'
  ],
  curiosidades: [
    'viral strange fact OR surprising discovery',
    'weird science OR unbelievable fact',
    'bizarre world news'
  ],
  motivacion: [
    'inspiring story OR against all odds',
    'discipline success story OR personal transformation',
    'overcame adversity story'
  ],
  drama: [
    'internet drama OR controversy OR viral backlash',
    'creator controversy OR online feud',
    'viral scandal internet'
  ]
};

function buildSystemPrompt({ niche, platform, duration }) {
  return `
Eres un estratega experto en contenido viral faceless para TikTok, Instagram Reels y YouTube Shorts.

Responde SOLO JSON válido.
No uses markdown.
No uses backticks.
No pongas texto fuera del JSON.

Estructura exacta:
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
- Hook muy fuerte y rápido.
- Desarrollo narrativo, atrapante y fácil de narrar con voz IA.
- CTA para provocar comentarios o debate.
- Notas visuales útiles para Higgsfield, Pexels o stock.
- Guía CapCut práctica y accionable.
- Plataforma: ${platform}
- Duración objetivo: ${duration} segundos.
- Nicho: ${nicheMap[niche] || niche}
- Si el contenido se basa en una noticia o caso real, redacta de forma responsable y narrativa.
- No inventes fuentes ni detalles específicos no dados.
`;
}

async function generateScriptFromStory({ niche, platform, duration, topic, sourceTitle, sourceDescription, sourceUrl }) {
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
Convierte esta historia encontrada en internet en un guion viral en español.

Tema principal: ${topic}

Título fuente:
${sourceTitle || ""}

Descripción fuente:
${sourceDescription || ""}

URL fuente:
${sourceUrl || ""}

Hazlo ideal para ${platform} y ${duration} segundos.
`
      }
    ]
  });

  const text = (response.output_text || "").trim();
  if (!text) throw new Error("La IA devolvió respuesta vacía");

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`La IA no devolvió JSON válido. Respuesta: ${text}`);
  }
}

async function searchStoriesByNiche(niche, maxResults = 8) {
  if (!GNEWS_API_KEY) throw new Error("Falta GNEWS_API_KEY");

  const queries = nicheQueries[niche] || nicheQueries.misterio;
  const allArticles = [];

  for (const q of queries) {
    const url = new URL("https://gnews.io/api/v4/search");
    url.searchParams.set("q", q);
    url.searchParams.set("lang", "en");
    url.searchParams.set("max", "10");
    url.searchParams.set("apikey", GNEWS_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.errors?.join(", ") || data?.message || "Error consultando GNews");
    }

    for (const article of data.articles || []) {
      allArticles.push(article);
    }
  }

  const deduped = [];
  const seen = new Set();

  for (const article of allArticles) {
    const key = (article.url || article.title || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(article);
  }

  return deduped.slice(0, maxResults).map((article) => ({
    title: article.title,
    description: article.description,
    url: article.url,
    source: article.source?.name || "",
    publishedAt: article.publishedAt || "",
    image: article.image || ""
  }));
}

app.post("/login", (req, res) => {
  const { password } = req.body || {};
  if (password === PASSWORD) return res.json({ ok: true });
  return res.status(401).json({ ok: false, error: "Contraseña incorrecta" });
});

app.post("/search-stories", async (req, res) => {
  try {
    const { niche } = req.body || {};

    if (!niche) {
      return res.status(400).json({ ok: false, error: "Falta niche" });
    }

    const stories = await searchStoriesByNiche(niche, 10);

    return res.json({
      ok: true,
      niche,
      stories
    });
  } catch (error) {
    console.error("ERROR /search-stories:", error);
    return res.status(500).json({
      ok: false,
      error: "Error buscando historias",
      details: error?.message || "Error desconocido"
    });
  }
});

app.post("/generate", async (req, res) => {
  try {
    const { niche, platform, duration, topic, sourceTitle, sourceDescription, sourceUrl } = req.body || {};

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: "Falta OPENAI_API_KEY" });
    }

    if (!niche || !platform || !duration || !topic) {
      return res.status(400).json({ ok: false, error: "Faltan datos para generar contenido" });
    }

    const data = await generateScriptFromStory({
      niche,
      platform,
      duration,
      topic,
      sourceTitle,
      sourceDescription,
      sourceUrl
    });

    return res.json({ ok: true, data });
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
    const { platform = "TikTok", duration = "60" } = req.body || {};

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: "Falta OPENAI_API_KEY" });
    }

    const targetNiches = [
      "historias_reales",
      "casos_sin_resolver",
      "casos_resueltos",
      "crimen_perturbador",
      "misterio"
    ];

    const results = [];

    for (const niche of targetNiches) {
      try {
        const stories = await searchStoriesByNiche(niche, 2);

        for (const story of stories) {
          const generated = await generateScriptFromStory({
            niche,
            platform,
            duration,
            topic: story.title,
            sourceTitle: story.title,
            sourceDescription: story.description,
            sourceUrl: story.url
          });

          results.push({
            niche,
            source: story,
            data: generated
          });
        }
      } catch (err) {
        results.push({
          niche,
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