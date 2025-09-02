const express = require('express');
// ⬇️ juiste pad: één map omhoog naar services/
const { createDeepgramToken } = require('../services/deepgram');

const router = express.Router();

router.all('/', async (_req, res) => {
  try {
    const token = await createDeepgramToken();
    res.json({ token: token.access_token, expiresIn: token.expires_in });
  } catch (e) {
    res.status(500).json({ error: 'ws-token-failed', detail: e?.message });
  }
});

module.exports = router;
