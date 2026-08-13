// POST /api/verify-payment
// Confirms a payment is genuine by recomputing Razorpay's signature server-side,
// then emails you the full order details so you have an actual record to work from.

const crypto = require('crypto');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      customer,
      items,
      amount
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ verified: false, error: 'Missing fields' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      return res.status(400).json({ verified: false });
    }

    // Payment confirmed genuine. Email the order details — if this fails for any
    // reason, we still tell the customer their payment succeeded (it did), we just
    // log the email error so it doesn't silently vanish.
    try {
      await sendOrderEmail({ razorpay_payment_id, customer, items, amount });
    } catch (emailErr) {
      console.error('Order email failed:', emailErr);
    }

    return res.status(200).json({ verified: true });
  } catch (err) {
    console.error('verify-payment error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
};

async function sendOrderEmail({ razorpay_payment_id, customer, items, amount }) {
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_EMAIL) {
    console.warn('RESEND_API_KEY or NOTIFY_EMAIL not set — skipping order email.');
    return;
  }

  const itemsHtml = (items || [])
    .map(i => `<li>${i.qty} × ${i.name} (Size ${i.size}) — ₹${i.price * i.qty}</li>`)
    .join('');

  const html = `
    <h2>New Known Z Order</h2>
    <p><strong>Payment ID:</strong> ${razorpay_payment_id}</p>
    <p><strong>Total:</strong> ₹${amount}</p>

    <h3>Customer</h3>
    <p>
      ${customer?.name || ''}<br>
      ${customer?.email || ''}<br>
      ${customer?.phone || ''}
    </p>

    <h3>Shipping Address</h3>
    <p>${customer?.address || ''}, ${customer?.city || ''} - ${customer?.pincode || ''}</p>

    <h3>Items</h3>
    <ul>${itemsHtml}</ul>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Known Z Orders <onboarding@resend.dev>',
      to: [process.env.NOTIFY_EMAIL],
      subject: `New Order — ₹${amount} from ${customer?.name || 'a customer'}`,
      html
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API error: ${errText}`);
  }
}
