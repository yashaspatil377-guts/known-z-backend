// POST /api/create-order
// Creates a Razorpay order server-side, using your secret key.
// The secret key NEVER touches the browser — that's the whole point of this file.

const Razorpay = require('razorpay');

module.exports = async (req, res) => {
  // Allow your storefront to call this endpoint from a different domain.
  // Once your site has a fixed domain, replace '*' with that domain for tighter security.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { amount, items } = req.body; // amount in rupees (e.g. 2298), items = cart summary for your records

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Razorpay wants paise, not rupees
      currency: 'INR',
      receipt: `knownz_${Date.now()}`,
      notes: {
        items: items ? JSON.stringify(items).slice(0, 500) : '',
      },
    });

    res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    console.error('create-order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
};
