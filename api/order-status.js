// POST /api/order-status
// Lets a customer look up their order using Order ID + the email they checked out with.
// Requires both to match, so people can't just guess order IDs and see someone else's address.

const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { orderId, email } = req.body;

    if (!orderId || !email) {
      return res.status(400).json({ error: 'Order ID and email are required' });
    }

    const raw = await kv.get(`order:${orderId.trim().toUpperCase()}`);

    if (!raw) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = typeof raw === 'string' ? JSON.parse(raw) : raw;

    if ((order.customer?.email || '').toLowerCase().trim() !== email.toLowerCase().trim()) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.status(200).json({
      orderId: order.orderId,
      status: order.status,
      items: order.items,
      amount: order.amount,
      createdAt: order.createdAt
    });
  } catch (err) {
    console.error('order-status error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};
