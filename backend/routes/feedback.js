const express = require('express');
const { z } = require('zod');

const router = express.Router();
const Body = z.object({
  suggestionId: z.string().optional(),
  suggestion_id: z.string().optional(),
  suggestion_text: z.string().optional(),
  conversation_id: z.string().optional(),
  vote: z.enum(['up', 'down']).optional(),
  feedback: z.number().int().min(-1).max(1).optional()
});

router.post('/', async (req, res) => {
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) return res.status(200).json({ ok: true }); // soft-accept
  // TODO: persist later (Supabase)
  return res.status(202).json({ ok: true });
});

module.exports = router;
