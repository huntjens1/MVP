const express = require('express');
const { z } = require('zod');
const { generateSuggestionsNL } = require('./openai');

const router = express.Router();
const Body = z.object({
  transcript: z.string().optional(),
  max: z.number().int().min(1).max(10).optional(),
});

router.post('/', async (req, res) => {
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) return res.json({ suggestions: [] });
  try {
    const suggestions = await generateSuggestionsNL({
      transcript: parsed.data.transcript || '',
      max: parsed.data.max || 5,
    });
    return res.json({ suggestions });
  } catch (e) {
    console.error('[suggest] error', e?.message);
    return res.json({ suggestions: [] });
  }
});

module.exports = router;
