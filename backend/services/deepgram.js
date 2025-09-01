const DG_API = 'https://api.deepgram.com';

async function createDeepgramToken() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY missing');

  const ttl = Number(process.env.DG_TOKEN_TTL || 1800); // 30m default
  const body = { ttl_seconds: Math.min(Math.max(ttl, 30), 3600) };

  const res = await fetch(`${DG_API}/v1/auth/grant`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Deepgram grant failed: ${res.status} ${txt}`);
  }
  return await res.json(); // { access_token, expires_in }
}

module.exports = { createDeepgramToken };
