// backend/routes/transcripts.js
const express = require('express');
const router = express.Router();

/**
 * LET OP (MVP):
 * - We gebruiken dummy handlers zodat er géén 404 meer optreden in de UI.
 * - Koppel later aan je DB (Supabase) of eigen storage.
 * - Alles is CommonJS; geen ESM-imports meer.
 */

/**
 * GET /api/conversations
 * Eenvoudige lijst (dummy). Frontend vraagt dit soms met ?limit=50.
 */
router.get('/conversations', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 50);
    // TODO: haal echte data op uit je DB
    return res.status(200).json({
      items: [],   // leeg voor MVP
      total: 0,
      limit,
    });
  } catch (err) {
    console.error('[CONVERSATIONS][ERROR]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * GET /api/transcripts
 * Lijst van transcripties (dummy).
 */
router.get('/transcripts', async (req, res) => {
  try {
    // TODO: fetch uit DB
    return res.status(200).json({ items: [], total: 0 });
  } catch (err) {
    console.error('[TRANSCRIPTS/LIST][ERROR]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * GET /api/transcripts/:id
 * Detail van één transcript (dummy).
 */
router.get('/transcripts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // TODO: haal record op uit DB
    return res.status(404).json({ error: 'not_found', id });
  } catch (err) {
    console.error('[TRANSCRIPTS/DETAIL][ERROR]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /api/transcripts
 * Sla een transcript/metadata op (MVP: accepteer en bevestig).
 */
router.post('/transcripts', async (req, res) => {
  try {
    const payload = req.body || {};
    // TODO: persist naar DB
    console.log('[TRANSCRIPTS/CREATE]', {
      ts: new Date().toISOString(),
      payload,
    });
    // 202 Accepted is netjes voor async verwerking
    return res.status(202).json({ ok: true });
  } catch (err) {
    console.error('[TRANSCRIPTS/CREATE][ERROR]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
