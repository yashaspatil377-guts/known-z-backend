// POST /api/verify-payment
// Confirms a payment is genuine, saves the order for tracking, and emails you the details.

const crypto = require('crypto');
const { kv } = require('@vercel/kv');

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

    let orderNumber;
    try {
      orderNumber = await kv.incr('order:counter');
    } catch (kvErr) {
      console.error('KV counter error:', kvErr);
      orderNumber = Date.now();
    }
    const orderId = `KZ-${1000 + orderNumber}`;

    const order = {
      orderId,
      paymentId: razorpay_payment_id,
      status: 'Processing',
      customer: customer || {},
      items: items || [],
      amount: amount || 0,
      createdAt: new Date().toISOString()
    };

    try {
      await kv.set(`order:${orderId}`, JSON.stringify(order));
      await kv.lpush('order:list', orderId);
    } catch (kvErr) {
      console.error('KV save error:', kvErr);
    }

    try {
      await sendOrderEmail({ orderId, razorpay_payment_id, customer, items, amount });
    } catch (emailErr) {
      console.error('Order email failed:', emailErr);
    }

    return res.status(200).json({ verified: true, orderId });
  } catch (err) {
    console.error('verify-payment error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
};

async function sendOrderEmail({ orderId, razorpay_payment_id, customer, items, amount }) {
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_EMAIL) {
    console.warn('RESEND_API_KEY or NOTIFY_EMAIL not set — skipping order email.');
    return;
  }

  const itemsHtml = (items || [])
    .map(i => `<li>${i.qty} × ${i.name} (Size ${i.size}) — ₹${i.price * i.qty}</li>`)
    .join('');

  const html = `
    <h2>New Known Z Order — ${orderId}</h2>
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
      subject: `New Order ${orderId} — ₹${amount} from ${customer?.name || 'a customer'}`,
      html
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API error: ${errText}`);
  }
}
