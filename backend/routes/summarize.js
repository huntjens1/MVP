import { Router } from "express";
import OpenAI from "openai";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/api/summarize", async (req, res) => {
  try {
    const { transcript } = req.body || {};
    if (!transcript) return res.status(400).json({ error: "missing_transcript" });

    const system = `
Je bent een NEDERLANDSE IT-servicedesk agent.
Vat het gesprek samen in max 5 regels.
Noem indien mogelijk: probleemcategorie, prioriteit en impact.
`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: transcript.slice(0, 2000) },
      ],
    });

    const summary = resp.choices?.[0]?.message?.content || "(geen samenvatting)";
    res.json({ summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "summarize_failed" });
  }
});

export default router;
