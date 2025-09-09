// backend/routes/suggestions.js
const express = require('express');
const router = express.Router();

// De SSE handler die je al hebt
//   - default export: suggestionsSSE
//   - (optioneel) named export: assistStream (zie bestand hieronder)
const suggestionsSSE = require('../streams/suggestionsSSE');

router.get('/suggestions', (req, res) => {
  // Laat de dedicated SSE-module alle headers / keep-alive doen
  return suggestionsSSE(req, res);
});

module.exports = router;
