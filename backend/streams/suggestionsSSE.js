import { supabase } from '../supabaseClient.js';
import { suggestQuestions } from '../utils/llmClient.js';
import { requireAuth } from '../middlewares/auth.js';

export function suggestionsSSE(app) {
  app.get('/api/stream/suggestions', requireAuth, async (req, res) => {
    const conversationId = req.query.conversation_id;
    if (!conversationId) return res.status(400).json({ error: 'conversation_id is vereist' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();

    const keep = setInterval(() => res.write(':keepalive\n\n'), 20000);
    let lastPayload = '';

    const tick = async () => {
      const { data, error } = await supabase
        .from('transcripts')
        .select('content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) { res.write(`event: error\ndata: "db-error"\n\n`); return; }
      if (!data?.length) return;

      const transcript = data
        .sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
        .map(r => r.content).join(' ').trim();

      if (!transcript || transcript === lastPayload) return;
      lastPayload = transcript;

      try {
        const out = await suggestQuestions({ transcript });
        const lines = out.split('\n').map(s => s.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
        res.write(`event: suggestions\n`);
        res.write(`data: ${JSON.stringify({ suggestions: lines })}\n\n`);
      } catch {
        res.write(`event: error\ndata: "ai-failed"\n\n`);
      }
    };

    const interval = setInterval(tick, 2000);
    await tick();

    req.on('close', () => { clearInterval(interval); clearInterval(keep); res.end(); });
  });
}
