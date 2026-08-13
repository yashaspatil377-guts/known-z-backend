// POST /api/admin-update-order
// Updates an order's status (Processing / Shipped / Delivered). Password-protected.

const { kv } = require('@vercel/kv');

const VALID_STATUSES = ['Processing', 'Shipped', 'Delivered'];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { password, orderId, status } = req.body;

    if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    if (!orderId || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid order ID or status' });
    }

    const raw = await kv.get(`order:${orderId}`);
    if (!raw) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = typeof raw === 'string' ? JSON.parse(raw) : raw;
    order.status = status;

    await kv.set(`order:${orderId}`, JSON.stringify(order));

    return res.status(200).json({ success: true, order });
  } catch (err) {
    console.error('admin-update-order error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};
