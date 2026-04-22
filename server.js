import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.APP_PASSWORD || "1234";
const CLAUDE_KEY = process.env.CLAUDE_KEY || "";

app.post("/login", (req, res) => {
  if (req.body.password === PASSWORD) return res.json({ ok: true });
  res.status(401).send("Wrong password");
});

app.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!CLAUDE_KEY) {
      return res.status(500).json({
        error: "Falta CLAUDE_KEY en variables de entorno"
      });
    }

    const fullPrompt = `
Responde SOLO en JSON válido.
No uses markdown.
No uses backticks.
No expliques nada fuera del JSON.

Formato exacto:
{
  "respuesta": "tu respuesta aquí"
}

Prompt del usuario:
${prompt}
`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
        messages: [{ role: "user", content: fullPrompt }]
      })
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(500).json({
        error: "Error API Claude",
        details: data
      });
    }

    const text = (data.content || []).map(x => x.text || "").join("").trim();

    if (!text) {
      return res.status(500).json({
        error: "Claude devolvió respuesta vacía",
        details: data
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(500).json({
        error: "Claude no devolvió JSON válido",
        raw: text,
        details: data
      });
    }

    res.json(parsed);
  } catch (err) {
    res.status(500).json({
      error: "Error interno del servidor",
      details: err.message
    });
  }
});

app.listen(PORT, () => console.log("Running on " + PORT));