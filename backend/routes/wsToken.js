const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.post('/ws-token', requireAuth, (req, res) => {
  const wsToken = uuidv4(); // opaque
  res.json({ wsToken, expires_in: 60 });
});

module.exports = router;
