// POST /api/orders-by-email
// Fallback lookup for customers who lost their Order ID — returns every
// order matching that email so they can find the right one.

const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const orderIds = await kv.lrange('order:list', 0, -1);

    const matches = [];
    for (const orderId of orderIds) {
      const raw = await kv.get(`order:${orderId}`);
      if (!raw) continue;
      const order = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if ((order.customer?.email || '').toLowerCase().trim() === normalizedEmail) {
        matches.push({
          orderId: order.orderId,
          status: order.status,
          items: order.items,
          amount: order.amount,
          createdAt: order.createdAt
        });
      }
    }

    return res.status(200).json({ orders: matches });
  } catch (err) {
    console.error('orders-by-email error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};
