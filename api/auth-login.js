// POST /api/auth-login
// Verifies email + password against the stored hash, returns a session token.

const crypto = require('crypto');
const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const raw = await kv.get(`user:${normalizedEmail}`);

    if (!raw) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }

    const user = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const computedHash = crypto.scryptSync(password, user.passwordSalt, 64).toString('hex');

    // Constant-time comparison to avoid timing attacks
    const match = crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(user.passwordHash, 'hex')
    );

    if (!match) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }

    const token = createToken(normalizedEmail);

    return res.status(200).json({
      token,
      user: { name: user.name, email: user.email, phone: user.phone }
    });
  } catch (err) {
    console.error('auth-login error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

function createToken(email) {
  const payload = Buffer.from(JSON.stringify({
    email,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30
  })).toString('base64url');

  const signature = crypto
    .createHmac('sha256', process.env.SESSION_SECRET)
    .update(payload)
    .digest('hex');

  return `${payload}.${signature}`;
}
