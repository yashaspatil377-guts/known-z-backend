# Known Z — Payment Backend

Two small serverless functions that let your storefront take real, verified payments.

- `api/create-order.js` — asks Razorpay to open an order before payment starts
- `api/verify-payment.js` — checks a completed payment is genuine before you treat it as paid

Neither file ever exposes your Razorpay secret key to the browser — that's the entire reason this backend exists.

## 1. Get your Razorpay keys

1. Sign up at [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Go to **Settings → API Keys**
3. Generate a **Test** key pair first (starts with `rzp_test_`) — use this while you're testing
4. Once you've completed Razorpay's KYC/business verification, generate a **Live** key pair (`rzp_live_`) for real transactions

## 2. Deploy to Vercel (free)

**Option A — Vercel CLI**
```bash
npm install -g vercel
cd knownz-backend
vercel
```
Follow the prompts (link or create a project). Then add your keys as environment variables:
```bash
vercel env add RAZORPAY_KEY_ID
vercel env add RAZORPAY_KEY_SECRET
```
Paste the values when prompted. Then deploy for real:
```bash
vercel --prod
```
You'll get a URL like `https://knownz-backend.vercel.app`.

**Option B — Vercel dashboard (no terminal)**
1. Push this folder to a GitHub repo
2. Go to [vercel.com/new](https://vercel.com/new), import that repo
3. Under **Environment Variables**, add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
4. Click Deploy

## 3. Connect it to your website

Open your `knownz-website.html` file and find this line near the top of the `<script>` section:

```js
const BACKEND_URL = 'https://YOUR-BACKEND-URL.vercel.app';
```

Replace it with the URL Vercel gave you. That's the only change needed — the checkout flow already calls `/api/create-order` and `/api/verify-payment` on that domain.

## 4. Test it

Use Razorpay's test card: `4111 1111 1111 1111`, any future expiry, any CVV, any OTP. A successful test payment confirms the whole chain — order creation, checkout, and signature verification — is wired correctly.

## 5. Go live

Swap your Test keys for Live keys in Vercel's environment variables once KYC is done, redeploy, and real payments will start flowing. Nothing else changes.

## What's still not built

This backend confirms payments are real. It does not yet:
- Store orders in a database
- Send confirmation emails
- Manage inventory/stock levels
- Handle refunds

Each of those is a reasonable next step once you're actually taking orders — happy to help with any of them when you get there.
