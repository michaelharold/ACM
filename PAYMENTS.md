# Payments (Razorpay) — setup, testing & deploy

Secure Razorpay payments for **event registrations** and **ACM membership**, with
**no paid Firebase plan**. The frontend and a few tiny backend endpoints run
together on **Vercel's free tier**; Firebase (Auth + Firestore) stays on the free
Spark plan. Multiple Razorpay accounts are supported — each event and membership
can be credited to a different account.

Until you configure keys, payments stay **dormant** — the site behaves exactly as
before (records just save as `pending`/`free`). You can set up account profiles in
the admin panel at any time; they only start charging once the server has keys.

## How it works (and why it's safe)

1. User submits a registration/membership → the record is saved as `pending`.
2. Browser calls **`/api/create-order`**. The server decides, on its own:
   - the **amount** — from the event's `fee` or the admin-set membership fee
     (never trusted from the browser), and
   - the **account** — the event's/membership's assigned account, resolved to a
     key pair held only in the server env.
   It creates a Razorpay order and returns the order + that account's public Key ID.
3. Razorpay's hosted checkout opens; the user pays. **No secret key is ever in the browser.**
4. **`/api/verify-payment`** re-checks the signature with the account's secret and,
   only if valid, marks the record `paid` and stores the Razorpay **payment id + time**.
5. **`/api/webhook`** does the same server-to-server, so a payment still records even
   if the user closes the tab before step 4.

## Payment accounts (the secret split)

A **Key Secret is never stored in Firestore or the browser.** A payment account
is split in two:

- **In the admin panel** (Admin → **Payments**): the profile — a **label**, the
  **Key ID** (`rzp_…`, public), a description, active toggle. Stored in Firestore.
- **In the server env**: that account's **Key Secret**, mapped by Key ID.

Then assign an account per event (Events tab, when fee > 0) and for membership
(Payments tab), and set the membership **fee** there too (it's editable any time).

## Environment variables

Set these in Vercel → Project → Settings → **Environment Variables** (and in a
local `.env` for testing — see below). `VITE_*` are baked into the build; the rest
are read at runtime by the functions and never reach the browser.

| Variable | Used by | Value |
| --- | --- | --- |
| `VITE_RAZORPAY_KEY_ID` | client | Any valid Razorpay **Key ID**. Its presence switches the feature **on**. |
| `VITE_FIREBASE_*` | client | the six existing Firebase vars (copy from `.env`) |
| `FIREBASE_SERVICE_ACCOUNT` | server | the **entire** service-account JSON on one line |
| `RAZORPAY_KEYS` | server | `{"<keyId>":"<keySecret>", ...}` — one entry per account profile |
| `RAZORPAY_WEBHOOK_SECRETS` | server | `{"<keyId>":"<webhookSecret>", ...}` — one per account (optional until you add webhooks) |

**Single-account shortcut** — if you only ever use one account you can skip the
JSON maps and instead set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and
`RAZORPAY_WEBHOOK_SECRET`; leave each account's assignment as *Default account*.

Get keys from Razorpay Dashboard → **Settings → API Keys** (use **Test Mode**
first — no KYC needed). Get the Firebase key from Firebase console → ⚙ **Project
settings → Service accounts → Generate new private key**.

## Test it locally BEFORE deploying

The client flow (create-order → checkout → verify-payment) is fully testable on
your machine with Test-mode keys — no deploy needed.

1. Put every variable above into a local **`.env`** (it's git-ignored). Paste the
   service-account JSON as a **single line**.
2. Add a matching account profile in the app (Admin → Payments) with the same Key
   ID you used in `RAZORPAY_KEYS`, and set a fee.
3. Run the whole thing (frontend + `/api`) locally:
   ```
   npx vercel dev
   ```
   Open the printed `localhost` URL. (`localhost` is already an authorized domain
   for Firebase Auth, so Google sign-in works.) If the functions don't see your
   env vars, run `vercel link` once, then `vercel env pull`.
4. Register for a paid event (or join membership) and pay with a Razorpay **test
   card**: `4111 1111 1111 1111`, any future expiry, any CVV. On success the record
   flips to **Paid** with the payment id + time in Admin → Registrations / Membership.

> The **webhook** needs a public URL, so it isn't exercised by `localhost` alone —
> test it after deploying, or expose your local server with a tunnel (e.g. ngrok)
> and point a Razorpay webhook at it. The verify-payment path already makes the
> normal flow correct without it.

## Deploy to Vercel

1. Push this repo to GitHub (done: `michaelharold/ACM`).
2. [vercel.com](https://vercel.com) → **New Project → Import** the repo (auto-detected
   via `vercel.json`: build `npm run build`, output `dist`).
3. Add all the env vars above under **Settings → Environment Variables**, then **Deploy**.
   Vercel serves the app and `/api/*` from one domain (no CORS) and redeploys on every push.
4. Add your Vercel domain under Firebase console → **Authentication → Settings →
   Authorized domains** so Google sign-in works there.
5. **Webhooks** (recommended): in each Razorpay Dashboard → **Settings → Webhooks**,
   add `https://<your-domain>/api/webhook`, select **payment.captured** (and
   **order.paid**), set a secret, and put that secret in `RAZORPAY_WEBHOOK_SECRETS`
   under its Key ID.
6. Deploy the Firestore rules (adds the `paymentAccounts` rule) with the account
   that has rights: `firebase deploy --only firestore:rules`.

Once verified in Test mode, swap in **Live** keys (after Razorpay KYC) and redeploy.

## Still open (future)

- **Razorpay Route** for true split-settlement to sub-accounts (vs. one account per
  event). Needs KYC per linked account; the current model already routes each event
  to a chosen account.
