const express = require('express');
const { z } = require('zod');

const router = express.Router();
const Body = z.object({
  suggestionId: z.string(),
  vote: z.enum(['up', 'down']),
  reason: z.string().max(300).optional(),
});

router.post('/', async (req, res) => {
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) return res.status(200).json({ ok: true }); // soft-accept
  // TODO: persist naar Supabase
  return res.status(202).json({ ok: true });
});

module.exports = router;
