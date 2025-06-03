import express from 'express';
import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middlewares/auth.js";

const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/api/suggest-question', requireAuth, async (req, res) => {
  const { transcript } = req.body;
  if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 10) {
    return res.status(400).json({ error: "Transcript te kort voor suggesties." });
  }

  try {
    const prompt = `
Je bent een slimme IT-servicedesk-assistent. Analyseer het volgende live gesprek en geef 2-3 korte vraagsuggesties die de agent direct aan de klant kan stellen om het probleem snel en duidelijk te documenteren.
- Focus op open vragen, geen 'ja/nee' vragen.
- Geef elk voorstel in één zin, alleen relevante vervolgvraag voor ticketdocumentatie.
Voorbeeld:
[Transcript]
${transcript}
[Suggesties]
- 
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Of "gpt-4o" voor nog betere suggesties
      messages: [
        { role: "system", content: "Je bent een slimme IT-servicedesk-assistent. Je output moet alleen een lijst met korte suggestievragen zijn." },
        { role: "user", content: prompt }
      ],
      max_tokens: 80,
      temperature: 0.4,
    });

    const text = completion.choices[0].message?.content || "";
    const suggestions = text
      .split("\n")
      .map(l => l.replace(/^[-•]\s*/, "").trim())
      .filter(l => l.length > 4)
      .map(text => ({ id: uuidv4(), text }));

    return res.json({ suggestions });
  } catch (err) {
    console.error("/api/suggest-question error", err);
    res.status(500).json({ error: "AI suggestie mislukt." });
  }
});

export default router;
