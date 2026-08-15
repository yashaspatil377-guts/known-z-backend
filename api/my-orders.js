// POST /api/my-orders
// Returns every order belonging to the logged-in customer.
// Requires a valid session token — this is what makes it safe to show
// order history without asking for an Order ID every time.

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
      return res.status(401).json({ error: 'Session expired — please log in again' });
    }

    const orderIds = await kv.lrange('order:list', 0, -1);
    const matches = [];

    for (const orderId of orderIds) {
      const raw = await kv.get(`order:${orderId}`);
      if (!raw) continue;
      const order = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if ((order.customer?.email || '').toLowerCase().trim() === email) {
        matches.push(order);
      }
    }

    return res.status(200).json({ orders: matches });
  } catch (err) {
    console.error('my-orders error:', err);
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
