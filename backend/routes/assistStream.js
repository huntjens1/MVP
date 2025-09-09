// backend/routes/assistStream.js
const express = require('express');
const router = express.Router();

// Verwacht dat ../streams/suggestionsSSE.js exporteert:  module.exports.assistStream = (req,res)=>{...}
const { assistStream } = require('../streams/suggestionsSSE');

router.get('/assist-stream', (req, res) => {
  return assistStream(req, res);
});

module.exports = router;
