// routes/summarize.js
import express from "express";
import { OpenAI } from "openai";
import { requireAuth } from "../middlewares/auth.js";

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/api/suggest-question', requireAuth, async (req, res) => {
  const { transcript, conversationId, userId } = req.body;
  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ summary: "Transcript ontbreekt." });
  }

  const prompt = `
Vat het volgende IT-supportgesprek bondig samen. Focus op probleem, acties, oplossing en eventuele follow-up. Gebruik dit format:
- Klant: [naam/ID, indien bekend]
- Probleem: [kort en duidelijk]
- Actie(s): [samenvatting acties]
- Oplossing: [indien opgelost]
- Follow-up: [indien nodig]
Transcript:
${transcript}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 350,
      temperature: 0.4,
    });

    const summary = response.choices?.[0]?.message?.content || "Geen samenvatting gegenereerd.";
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ summary: "Samenvatten mislukt.", error: err.message });
  }
});

export default router;
