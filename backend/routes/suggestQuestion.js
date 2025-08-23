import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { suggestQuestions } from '../utils/llmClient.js';

const router = express.Router();
const allRoles = ['support','coordinator','manager','superadmin'];

router.post('/api/suggest-question', requireAuth, requireRole(allRoles), async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript) return res.status(400).json({ error: 'transcript is vereist' });

    const text = await suggestQuestions({ transcript });
    const suggestions = text
      .split('\n')
      .map(l => l.replace(/^[-•]\s*/, '').trim())
      .filter(l => l.length > 4)
      .map(t => ({ id: uuidv4(), text: t }));

    return res.json({ suggestions });
  } catch {
    return res.status(500).json({ error: 'AI suggestie mislukt.' });
  }
});

export default router;
