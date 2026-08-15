// POST /api/auth-me
// Verifies a session token and returns the current user — used to keep
// customers logged in across visits without asking them to log in every time.

const crypto = require('crypto');
const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { token } = req.body;
    const email = verifyToken(token);

    if (!email) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const raw = await kv.get(`user:${email}`);
    if (!raw) {
      return res.status(401).json({ error: 'Account not found' });
    }

    const user = typeof raw === 'string' ? JSON.parse(raw) : raw;

    return res.status(200).json({
      user: { name: user.name, email: user.email, phone: user.phone }
    });
  } catch (err) {
    console.error('auth-me error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

function verifyToken(token) {
  if (!token || !token.includes('.')) return null;

  const [payload, signature] = token.split('.');
  const expectedSignature = crypto
    .createHmac('sha256', process.env.SESSION_SECRET)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.exp < Date.now()) return null;
    return data.email;
  } catch {
    return null;
  }
}
