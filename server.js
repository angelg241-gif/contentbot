import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Variables
const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.APP_PASSWORD || "1234";

// OpenAI config
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Login simple
app.post("/login", (req, res) => {
  if (req.body.password === PASSWORD) {
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Wrong password" });
});

// Generador
app.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    const response = await client.responses.create({
      model: "gpt-5.4",
      input: `Responde en español, útil, claro y directo.\n\n${prompt}`
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

// Ruta principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});