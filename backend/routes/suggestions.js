// backend/routes/suggestions.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { subscribe: sseSubscribe, emit: sseEmit } = require('../streams/suggestionsSSE');

const router = express.Router();

// --- debug helper -----------------------------------------------------------
const DEBUG_ON = /^true|1|yes$/i.test(String(process.env.DEBUG || 'false'));
const debug = (...a) => { if (DEBUG_ON) console.log('[suggestions]', ...a); };

// --- auth helper ------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'change-me';

function verifyAuth(req) {
  try {
    const cookieToken = req.cookies?.auth;
    const hdr = req.headers['authorization'];
    const hdrToken = hdr && hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    const token = cookieToken || hdrToken;
    if (!token) return null;
    const payload = jwt.verify(token, JWT_SECRET);
    return payload || null;
  } catch (e) {
    debug('auth verify failed:', e?.message);
    return null;
  }
}

// --- OpenAI 1-shot generator -----------------------------------------------
// gebruikt Node 18+ fetch API
async function generateSuggestions(promptText) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    debug('OPENAI_API_KEY missing');
    throw new Error('OPENAI_API_KEY missing');
  }

  const body = {
    model: 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Je bent een ITIL v4 servicedesk-assistent. Geef maximaal 3 korte, concrete vervolgvraag-suggesties om een ticket sneller op te lossen. Antwoord in JSON met {"suggestions":["...","..."]}. Geen uitleg, geen extra velden.',
      },
      {
        role: 'user',
        content: `Context (laatste klant/agent zinnen):\n${promptText}\n\nGeef nu nieuwe vervolgvraag-suggesties.`,
      },
    ],
  };

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    debug('OpenAI error:', r.status, txt);
    throw new Error(`OpenAI ${r.status}: ${txt}`);
  }

  const data = await r.json();
  const raw = data.choices?.[0]?.message?.content || '{}';

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    debug('JSON parse error on OpenAI content:', e?.message, raw);
    parsed = { suggestions: [] };
  }

  const list = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  const cleaned = list
    .map(s => String(s).trim())
    .filter(Boolean)
    .slice(0, 3);

  debug('generateSuggestions ->', cleaned);
  return cleaned;
}

// --- GET /api/suggestions  (SSE subscribe) ---------------------------------
router.get('/suggestions', (req, res) => {
  const origin = req.headers.origin;
  const conversationId = String(req.query.conversation_id || '').trim();
  debug('SSE subscribe attempt', { conversationId, origin });

  if (!conversationId) {
    debug('missing conversation_id');
    return res.status(400).json({ error: 'conversation_id is verplicht' });
  }

  const user = verifyAuth(req);
  if (!user) {
    debug('unauthorized SSE');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    sseSubscribe(conversationId, res);
    res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, conversation_id: conversationId })}\n\n`);
    debug('SSE subscribed', { conversationId, user: user?.sub || user?.id });
  } catch (e) {
    debug('SSE subscribe error:', e?.message);
    return res.status(500).json({ error: 'SSE init failed' });
  }
});

// --- POST /api/suggest  (1-shot + push naar SSE) ----------------------------
router.post('/suggest', express.json(), async (req, res) => {
  const user = verifyAuth(req);
  if (!user) {
    debug('unauthorized POST /suggest');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { conversation_id, text } = req.body || {};
  debug('suggest request', { conversation_id, hasText: !!text });

  if (!conversation_id || !text) {
    return res.status(400).json({ error: 'conversation_id_and_text_required' });
  }

  try {
    const suggestions = await generateSuggestions(text);
    const payload = { conversation_id, suggestions, ts: Date.now() };

    // Push naar alle SSE subscribers
    sseEmit(conversation_id, payload);

    // En terug naar aanroeper
    return res.status(200).json(payload);
  } catch (e) {
    debug('suggest error:', e?.message);
    return res.status(500).json({ error: 'suggest_failed' });
  }
});

module.exports = router;
