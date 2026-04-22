import express from "express";
import path from "path";
import OpenAI from "openai";

const app = express();

// Middlewares
app.use(express.json());
app.use(express.static("public"));

// Variables
const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.APP_PASSWORD || "1234";

// OpenAI config
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 🔐 Login simple
app.post("/login", (req, res) => {
  if (req.body.password === PASSWORD) {
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Wrong password" });
});

// 🧠 Generador de contenido (OpenAI)
app.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    const response = await client.responses.create({
      model: "gpt-5.3",
      input: `Responde en español, estilo contenido viral para redes (TikTok/Instagram), directo y poderoso:\n\n${prompt}`
    });

    res.json({
      respuesta: response.output_text
    });

  } catch (error) {
    console.error("ERROR:", error);

    res.status(500).json({
      error: "Error generando contenido",
      details: error.message
    });
  }
});

// 🌐 Ruta principal (FIX para Render)
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});