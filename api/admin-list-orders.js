// POST /api/admin-list-orders
// Returns every order, newest first. Protected by a simple password —
// good enough for a one-person shop, not meant as a full auth system.

const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { password } = req.body;

    if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    const orderIds = await kv.lrange('order:list', 0, -1);

    const orders = [];
    for (const orderId of orderIds) {
      const raw = await kv.get(`order:${orderId}`);
      if (raw) {
        orders.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
      }
    }

    return res.status(200).json({ orders });
  } catch (err) {
    console.error('admin-list-orders error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};
