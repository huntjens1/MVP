// backend/routes/wsToken.js
const express = require('express');
const { randomUUID } = require('crypto');

const router = express.Router();

/**
 * POST /api/ws-token
 * Geeft een korte-lived identificator terug die de frontend kan gebruiken
 * om een microfoon/WS sessie te initialiseren.
 * Vorm: { wsToken: "<uuid>" }
 */
router.post('/ws-token', async (req, res) => {
  try {
    const wsToken = randomUUID(); // Node 20, geen extra deps nodig
    // Eventueel: hier je eigen registratie/tenant logging doen.
    return res.status(200).json({ wsToken });
  } catch (err) {
    console.error('[ws-token] error:', err);
    return res.status(500).json({ error: 'WS_TOKEN_FAILED' });
  }
});

module.exports = router;
