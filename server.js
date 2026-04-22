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
  const { prompt } = req.body;

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
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await r.json();
  const text = (data.content || []).map(x => x.text || "").join("");

  try {
    const json = JSON.parse(text.replace(/```json|```/g, "").trim());
    res.json(json);
  } catch {
    res.status(500).json({ error: "Invalid JSON", raw: text });
  }
});

app.listen(PORT, () => console.log("Running on " + PORT));