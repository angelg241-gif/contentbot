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

const client = new OpenAI({
  apiKey: OPENAI_API_KEY
});

const storyCache = {};
const CACHE_TTL_MS = 10 * 60 * 1000;

const recentGenerated = [];
const dailyPackMemory = [];

function pushRecent(item) {
  recentGenerated.unshift({
    ...item,
    createdAt: new Date().toISOString()
  });

  if (recentGenerated.length > 50) {
    recentGenerated.length = 50;
  }
}

function setDailyPack(items) {
  dailyPackMemory.length = 0;
  dailyPackMemory.push(...items);
}

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
    "mysterious OR unexplained OR strange incident",
    "haunting OR eerie OR unexplained disappearance",
    "weird case OR unexplained event"
  ],
  historias_reales: [
    "real bizarre story OR unbelievable true story",
    "strange real event OR shocking true case",
    "documented strange case"
  ],
  casos_sin_resolver: [
    "unsolved case OR missing person OR unresolved mystery",
    "cold case OR disappearance unsolved",
    "unsolved investigation"
  ],
  casos_resueltos: [
    "case solved after years OR solved mystery shocking",
    "solved cold case OR investigation resolved",
    "truth revealed in solved case"
  ],
  crimen_perturbador: [
    "disturbing crime case OR bizarre crime",
    "strange murder investigation OR disturbing case",
    "criminal case shocking details"
  ],
  curiosidades: [
    "viral strange fact OR surprising discovery",
    "weird science OR unbelievable fact",
    "bizarre world news"
  ],
  motivacion: [
    "inspiring story OR against all odds",
    "discipline success story OR personal transformation",
    "overcame adversity story"
  ],
  drama: [
    "internet drama OR controversy OR viral backlash",
    "creator controversy OR online feud",
    "viral scandal internet"
  ]
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCacheFresh(niche) {
  const hit = storyCache[niche];
  if (!hit) return false;
  return Date.now() - hit.timestamp < CACHE_TTL_MS;
}

function getFallbackStory(niche) {
  const fallbackByNiche = {
    historias_reales: {
      title: "Un caso real tan extraño que parecía inventado",
      description:
        "Una historia impactante y realista sobre un evento difícil de creer, contada con tono viral y narrativo.",
      url: ""
    },
    casos_sin_resolver: {
      title: "La desaparición que nunca tuvo una respuesta clara",
      description:
        "Un caso sin resolver con preguntas abiertas, tensión y un fuerte gancho narrativo.",
      url: ""
    },
    casos_resueltos: {
      title: "El caso resuelto cuya verdad fue peor que las teorías",
      description:
        "Una investigación resuelta que dejó una verdad difícil de procesar.",
      url: ""
    },
    crimen_perturbador: {
      title: "El crimen real que dejó a todos intentando entender lo ocurrido",
      description:
        "Un caso oscuro y perturbador, contado de forma responsable y atrapante.",
      url: ""
    },
    misterio: {
      title: "El misterio que nadie logró explicar del todo",
      description:
        "Un suceso extraño e inquietante, perfecto para un guion viral con atmósfera.",
      url: ""
    },
    curiosidades: {
      title: "El dato tan raro que parece mentira, pero no lo es",
      description:
        "Una curiosidad sorprendente, con alto potencial de retención.",
      url: ""
    },
    motivacion: {
      title: "La historia que demuestra lo que pasa cuando alguien no se rinde",
      description:
        "Una historia inspiradora centrada en disciplina, resiliencia y transformación.",
      url: ""
    },
    drama: {
      title: "La polémica que cambió la imagen de alguien para siempre",
      description:
        "Un drama viral con tensión, conflicto y potencial de comentarios.",
      url: ""
    }
  };

  return fallbackByNiche[niche] || fallbackByNiche.historias_reales;
}

function buildSystemPrompt({ niche, platform, duration }) {
  return `
Eres un estratega experto en contenido viral faceless para TikTok, Instagram Reels y YouTube Shorts.

Debes responder SOLO JSON válido.
No uses markdown.
No uses backticks.
No pongas texto fuera del JSON.

Devuelve EXACTAMENTE esta estructura:
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
- Si el contenido es de casos reales o crimen, redacta con tono serio y responsable.
- No inventes medios ni detalles específicos no dados.
`;
}

async function generateScriptFromStory({
  niche,
  platform,
  duration,
  topic,
  sourceTitle,
  sourceDescription,
  sourceUrl
}) {
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
Convierte esta historia en internet en un guion viral en español.

Tema principal:
${topic}

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

  if (!text) {
    throw new Error("La IA devolvió respuesta vacía");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`La IA no devolvió JSON válido. Respuesta: ${text}`);
  }
}

async function fetchStoriesFromGNews(niche, maxResults = 8) {
  if (!GNEWS_API_KEY) {
    throw new Error("Falta GNEWS_API_KEY");
  }

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
      throw new Error(
        data?.errors?.join(", ") ||
          data?.message ||
          "Error consultando GNews"
      );
    }

    for (const article of data.articles || []) {
      allArticles.push(article);
    }

    await sleep(900);
  }

  const deduped = [];
  const seen = new Set();

  for (const article of allArticles) {
    const key = (article.url || article.title || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);

    deduped.push({
      title: article.title,
      description: article.description,
      url: article.url,
      source: article.source?.name || "",
      publishedAt: article.publishedAt || "",
      image: article.image || ""
    });
  }

  return deduped.slice(0, maxResults);
}

async function searchStoriesByNiche(niche, maxResults = 8) {
  if (isCacheFresh(niche)) {
    return storyCache[niche].data.slice(0, maxResults);
  }

  const freshData = await fetchStoriesFromGNews(niche, maxResults);

  storyCache[niche] = {
    timestamp: Date.now(),
    data: freshData
  };

  return freshData;
}

async function getStoriesWithFallback(niche, maxResults = 8) {
  try {
    const stories = await searchStoriesByNiche(niche, maxResults);
    if (stories.length) return stories;
  } catch (err) {
    console.log("GNEWS FALLÓ:", err.message);
  }

  return [getFallbackStory(niche)];
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

app.post("/search-stories", async (req, res) => {
  try {
    const { niche } = req.body || {};

    if (!niche) {
      return res.status(400).json({
        ok: false,
        error: "Falta niche"
      });
    }

    const stories = await getStoriesWithFallback(niche, 10);

    return res.json({
      ok: true,
      niche,
      stories,
      cached: isCacheFresh(niche)
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

app.get("/cache-status", (req, res) => {
  const snapshot = Object.entries(storyCache).map(([niche, value]) => ({
    niche,
    count: value.data.length,
    ageSeconds: Math.floor((Date.now() - value.timestamp) / 1000)
  }));

  res.json({
    ok: true,
    cache: snapshot,
    recentGeneratedCount: recentGenerated.length,
    dailyPackCount: dailyPackMemory.length
  });
});

app.post("/generate", async (req, res) => {
  try {
    const {
      niche,
      platform,
      duration,
      topic,
      sourceTitle,
      sourceDescription,
      sourceUrl
    } = req.body || {};

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Falta OPENAI_API_KEY"
      });
    }

    if (!niche || !platform || !duration) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos para generar contenido"
      });
    }

    let finalTopic = topic;
    let finalSourceTitle = sourceTitle;
    let finalSourceDescription = sourceDescription;
    let finalSourceUrl = sourceUrl;

    if (!finalTopic || finalTopic.trim() === "") {
      const stories = await getStoriesWithFallback(niche, 1);

      if (!stories.length) {
        return res.status(404).json({
          ok: false,
          error: "No se encontraron historias automáticas"
        });
      }

      const story = stories[0];
      finalTopic = story.title;
      finalSourceTitle = story.title;
      finalSourceDescription = story.description;
      finalSourceUrl = story.url;
    }

    const data = await generateScriptFromStory({
      niche,
      platform,
      duration,
      topic: finalTopic,
      sourceTitle: finalSourceTitle,
      sourceDescription: finalSourceDescription,
      sourceUrl: finalSourceUrl
    });

    pushRecent({
      niche,
      platform,
      duration,
      topic: finalTopic,
      sourceTitle: finalSourceTitle,
      sourceUrl: finalSourceUrl,
      data
    });

    return res.json({
      ok: true,
      data,
      sourceUrl: finalSourceUrl || ""
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
    const { platform = "TikTok", duration = "60" } = req.body || {};

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Falta OPENAI_API_KEY"
      });
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
      const stories = await getStoriesWithFallback(niche, 2);

      for (const story of stories) {
        try {
          const generated = await generateScriptFromStory({
            niche,
            platform,
            duration,
            topic: story.title,
            sourceTitle: story.title,
            sourceDescription: story.description,
            sourceUrl: story.url
          });

          const item = {
            niche,
            source: story,
            data: generated
          };

          results.push(item);

          pushRecent({
            niche,
            platform,
            duration,
            topic: story.title,
            sourceTitle: story.title,
            sourceUrl: story.url,
            data: generated
          });

          await sleep(700);
        } catch (err) {
          results.push({
            niche,
            source: story,
            error: err.message
          });
        }
      }
    }

    setDailyPack(results);

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

app.get("/recent-generated", (req, res) => {
  res.json({
    ok: true,
    items: recentGenerated
  });
});

app.get("/daily-pack-latest", (req, res) => {
  res.json({
    ok: true,
    items: dailyPackMemory
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});