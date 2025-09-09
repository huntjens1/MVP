// backend/routes/aiFeedback.js (CommonJS)
const express = require('express');
const { requireAuth } = require('../middlewares/auth');
// Als je al een controller/service hebt, kun je die hier require’en
// const { handleAiFeedback } = require('../controllers/aiFeedback');

const router = express.Router();

/**
 * POST /api/ai-feedback
 * MVP-implementatie: valideert input en geeft 202 terug.
 * Vervang door je echte AI feedback flow als je controller klaar is.
 */
router.post('/api/ai-feedback', requireAuth, async (req, res) => {
  const { conversation_id, comment } = req.body || {};
  if (!conversation_id) return res.status(400).json({ error: 'conversation_id_required' });
  // await handleAiFeedback({ user: req.user, conversation_id, comment });

  return res.status(202).json({ ok: true });
});

module.exports = router;
