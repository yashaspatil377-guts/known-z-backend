// POST /api/auth-signup
// Creates a new customer account. Passwords are hashed with scrypt (built into
// Node — no extra dependency needed) and never stored or logged in plain text.

const crypto = require('crypto');
const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await kv.get(`user:${normalizedEmail}`);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const { hash, salt } = hashPassword(password);

    const user = {
      name,
      email: normalizedEmail,
      phone: phone || '',
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: new Date().toISOString()
    };

    await kv.set(`user:${normalizedEmail}`, JSON.stringify(user));

    const token = createToken(normalizedEmail);

    return res.status(200).json({
      token,
      user: { name: user.name, email: user.email, phone: user.phone }
    });
  } catch (err) {
    console.error('auth-signup error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function createToken(email) {
  const payload = Buffer.from(JSON.stringify({
    email,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30 // 30 days
  })).toString('base64url');

  const signature = crypto
    .createHmac('sha256', process.env.SESSION_SECRET)
    .update(payload)
    .digest('hex');

  return `${payload}.${signature}`;
}
