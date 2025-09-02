const express = require('express');
const { z } = require('zod');

const router = express.Router();
const Body = z.object({
  suggestionId: z.string().optional(),
  suggestion_id: z.string().optional(),     // beide keys toegestaan
  suggestion_text: z.string().optional(),
  conversation_id: z.string().optional(),
  vote: z.enum(['up', 'down']).optional(),  // alias
  feedback: z.number().int().min(-1).max(1).optional() // alias
});

router.post('/', async (req, res) => {
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) return res.status(200).json({ ok: true }); // soft-accept

  // TODO: persist in Supabase (tenant_id uit res.locals.tenant_id)
  // Voor nu: no-op met 202 Accepted
  return res.status(202).json({ ok: true });
});

module.exports = router;
