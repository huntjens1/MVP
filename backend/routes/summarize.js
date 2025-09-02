const express = require('express');
const { z } = require('zod');
const { summarizeTranscriptNL } = require('./openai');

const router = express.Router();
const Body = z.object({ transcript: z.string().optional() });

router.post('/', async (req, res) => {
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) return res.json({ summary: '' });
  const transcript = (parsed.data.transcript || '').trim();
  if (!transcript) return res.json({ summary: '' });

  try {
    const summary = await summarizeTranscriptNL(transcript);
    return res.json({ summary });
  } catch (e) {
    console.error('[summarize] error', e?.message);
    return res.json({ summary: '' }); // soft-fail
  }
});

module.exports = router;
