# Payments (Razorpay) — setup & deploy

The site takes secure Razorpay payments for **event registrations** and **ACM
membership**, with **no paid Firebase plan**. The frontend and two tiny backend
endpoints are hosted together on **Vercel's free tier**; Firebase (Auth +
Firestore) stays on the free Spark plan.

Until you add the keys below and deploy to Vercel, payments stay **dormant** —
the site behaves exactly as before (registrations/membership just record as
`pending`/`free`). Nothing breaks in the meantime.

## How it works (and why it's safe)

1. User submits a registration/membership → the record is created as `pending`.
2. Browser calls **`/api/create-order`**. The server looks up the amount from
   Firestore (the event's `fee`, or the admin-set membership fee) — **never from
   the browser**, so the price can't be tampered with — and creates a Razorpay
   order.
3. Razorpay's hosted checkout opens. The user pays. **The secret key never
   touches the browser.**
4. Razorpay returns a signature. The browser sends it to
   **`/api/verify-payment`**, which re-computes the signature with the secret
   and, only if it matches, marks the record `paid` via the Firebase Admin SDK
   (which bypasses security rules — the client can never mark itself paid).

## What you need

- A **Razorpay account** → Dashboard → **Settings → API Keys**. Use **Test Mode**
  keys first (no KYC needed to build/test). Go live later after KYC.
- A **Firebase service-account key**: Firebase console → ⚙ **Project settings →
  Service accounts → Generate new private key**. Downloads a JSON file.

## Environment variables (set these in Vercel → Project → Settings → Env Vars)

| Variable | Where it's used | Value |
| --- | --- | --- |
| `VITE_RAZORPAY_KEY_ID` | client (public) | Razorpay **Key ID** (e.g. `rzp_test_…`). Its presence turns the feature on. |
| `RAZORPAY_KEY_ID` | server | same Razorpay **Key ID** |
| `RAZORPAY_KEY_SECRET` | server (secret) | Razorpay **Key Secret** — never commit this |
| `FIREBASE_SERVICE_ACCOUNT` | server (secret) | the **entire** service-account JSON, pasted as one line |
| `VITE_FIREBASE_*` | client | the six existing Firebase vars (copy from `.env`) |

`VITE_*` vars are baked into the build, so add them **before** deploying (and
re-deploy after any change). The non-`VITE_` secrets are read at runtime by the
functions and are never exposed to the browser.

Set the **membership fee** in the app: Admin → **Site Content → Membership**
(₹0 = free). Event fees are set per event in Admin → **Events**.

## Deploy to Vercel

1. Push this repo to GitHub (already done: `michaelharold/ACM`).
2. [vercel.com](https://vercel.com) → **New Project → Import** the repo. It
   auto-detects Vite via `vercel.json` (build `npm run build`, output `dist`).
3. Add all the env vars above under **Settings → Environment Variables**.
4. **Deploy.** Vercel serves the app and the `/api/*` functions from one domain
   (no CORS), and re-deploys on every `git push`.
5. Add your custom domain under **Settings → Domains** if you have one.
6. In **Firebase console → Authentication → Settings → Authorized domains**, add
   your Vercel domain so Google sign-in works there.

Test with a Razorpay **test card** (e.g. `4111 1111 1111 1111`, any future
expiry/CVV) end-to-end, then swap in live keys.

## Not yet built (future)

- **Webhook** for server-to-server confirmation (covers a user closing the tab
  right after paying). The current client callback already verifies server-side;
  a webhook adds resilience.
- **Multiple payment accounts** (crediting different events to different
  Razorpay accounts). Needs a key-pair per account (and KYC per account) and a
  small admin picker. The current build uses one account.
