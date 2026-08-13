// GET  /api/products  — public, returns the current live product list
// POST /api/products  — admin only, replaces the product list (password protected)

const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const raw = await kv.get('site:products');
      const products = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
      return res.status(200).json({ products });
    } catch (err) {
      console.error('products GET error:', err);
      return res.status(500).json({ error: 'Failed to load products' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { password, products } = req.body;

      if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
      if (!Array.isArray(products)) {
        return res.status(400).json({ error: 'Invalid products data' });
      }

      await kv.set('site:products', JSON.stringify(products));
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('products POST error:', err);
      return res.status(500).json({ error: 'Failed to save products' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
