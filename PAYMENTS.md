# Payments (Razorpay) — complete setup, test & deploy guide

Secure Razorpay payments for **event registrations** and **ACM membership**, with
**no paid Firebase plan**. The frontend + a few tiny backend endpoints run
together on **Vercel's free tier**; Firebase (Auth + Firestore) stays free.
Multiple Razorpay accounts are supported — each event and membership can be
credited to a different account.

Until keys are configured the feature is **dormant**: the site behaves exactly as
today (records save as `free`/`pending`, nothing is charged). You can build
account profiles in the admin panel any time; they only start charging once the
server has keys.

---

## 0. Gather these first (the only things the code can't provide)

- [ ] **Razorpay account** → Dashboard → **Settings → API Keys** → generate **Test
      Mode** keys. You get a **Key ID** (`rzp_test_…`) and a **Key Secret**. One
      pair per account you want to route money to.
- [ ] **Firebase service-account key** → Firebase console → ⚙ **Project settings →
      Service accounts → Generate new private key**. Downloads a JSON file.
- [ ] **Fee amounts** — the membership fee and each paid event's fee (set in the
      admin panel, below).
- [ ] **Vercel account** (free) — to host the dynamic site + `/api`.
- [ ] *(later, for webhooks)* a **webhook secret** per Razorpay account.
- [ ] *(later, to go live)* Razorpay **KYC**: PAN, bank account, business proof.

---

## 1. How it works (and why it's safe)

1. A user registers / joins → the record is saved as `pending`.
2. Browser calls **`/api/create-order`**. The server decides on its own:
   - the **amount** — from the event's `fee` / the admin-set membership fee (never
     trusted from the browser), and
   - the **account** — the event's/membership's assigned account, resolved to a
     key pair held only in the server env.
   It creates a Razorpay order and returns the order + that account's public Key ID.
3. Razorpay's hosted checkout opens; the user pays. **No secret key is ever in the browser.**
4. **`/api/verify-payment`** re-checks the signature with the account's secret and,
   only if valid, marks the record `paid` and stores the Razorpay **payment id + time**.
5. **`/api/webhook`** does the same server-to-server, so a payment still records even
   if the user closes the tab before step 4.

### Payment accounts — the secret split (important)

A **Key Secret is NEVER stored in Firestore or the browser.** A payment account is
split in two:

| Half | Where | Contains |
| --- | --- | --- |
| Profile | Admin → **Payments** (Firestore) | label, **Key ID** (public), description, active |
| Secret  | server env (`RAZORPAY_KEYS`) | that account's **Key Secret**, mapped by Key ID |

You create the profile in the panel; you paste the secret into the server env once.
Events and membership then just pick a profile by name.

---

## 2. Environment variables

Set these in a local `.env` (for testing) and later in Vercel. `VITE_*` are baked
into the build; the rest are read at runtime by the functions and never reach the
browser. **`.env` is git-ignored — never commit real secrets.**

| Variable | Used by | Value |
| --- | --- | --- |
| `VITE_RAZORPAY_KEY_ID` | client | Any valid Razorpay **Key ID**. Its presence switches the feature **on**. |
| `VITE_FIREBASE_*` | client | the six existing Firebase vars (already in your `.env`) |
| `FIREBASE_SERVICE_ACCOUNT` | server | the **entire** service-account JSON, on **one line** |
| `RAZORPAY_KEYS` | server | `{"<keyId>":"<keySecret>", ...}` — one entry per account profile |
| `RAZORPAY_WEBHOOK_SECRETS` | server | `{"<keyId>":"<webhookSecret>", ...}` — one per account (optional until webhooks) |

**Single-account shortcut** — if you'll only ever use one account, skip the JSON
maps and set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
instead, and leave every account assignment as *Default account*.

Example `.env` additions for one test account:

```
VITE_RAZORPAY_KEY_ID=rzp_test_ABC123
RAZORPAY_KEYS={"rzp_test_ABC123":"your_test_secret"}
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"acm-33a08", ... }
```

---

## 3. Set the fees & accounts in the admin panel

1. Sign in as an admin → **Admin → Payments**.
2. **Add an account profile**: label (e.g. “ACM Main”) + the **Key ID** you used in
   `RAZORPAY_KEYS`. (The panel reminds you the secret goes in the server env.)
3. **Membership**: set the fee (₹, 0 = free) and pick which account it credits.
4. **Events**: Admin → Events → expand an event → set the **Registration Fee** and,
   when the fee > 0, choose **Credit payment to**.

> Fees can't be negative — the field clamps to ≥ 0 on save, and the server rejects
> any non-positive amount.

---

## 4. Test locally BEFORE deploying

The client flow (order → checkout → verify → marked Paid) is fully testable on your
machine with Test-mode keys — no deploy needed.

1. Put every variable from §2 in your local **`.env`** (service-account JSON on one line).
2. Add the matching account profile in Admin → Payments (§3) and set a fee.
3. Run the whole thing (frontend + `/api`) locally:
   ```
   npx vercel dev
   ```
   Open the printed `localhost` URL. `localhost` is already an authorized Firebase
   Auth domain, so Google sign-in works. If the functions don't see your env vars,
   run `vercel link` once, then `vercel env pull`.
4. Register for a paid event (or join membership) → **Pay** → use a Razorpay **test
   card**: `4111 1111 1111 1111`, any future expiry, any CVV.
5. Confirm: the screen shows success, and Admin → **Registrations** / **Membership**
   shows the row as **Paid** with the **payment id + time**.

> The **webhook** needs a public URL, so plain `localhost` won't exercise it — that's
> expected. The verify-payment path already makes the normal flow correct. To test
> the webhook locally, expose your server with a tunnel (e.g. `ngrok http 3000`) and
> point a Razorpay webhook at `https://<tunnel>/api/webhook`.

---

## 5. Deploy to Vercel

1. Push this repo to GitHub (done: `michaelharold/ACM`).
2. [vercel.com](https://vercel.com) → **New Project → Import** the repo. It auto-detects
   the setup via `vercel.json` (build `npm run build`, output `dist`).
3. **Settings → Environment Variables** → add every variable from §2. (VITE_* are read
   at build time, so add them before deploying and redeploy after any change.)
4. **Deploy.** Vercel serves the app and `/api/*` from one domain (no CORS) and
   redeploys on every `git push`.
5. Firebase console → **Authentication → Settings → Authorized domains** → add your
   Vercel domain so Google sign-in works there.

---

## 6. Webhooks (recommended)

For each Razorpay account: Dashboard → **Settings → Webhooks → Add New Webhook**:
- URL: `https://<your-domain>/api/webhook`
- Events: **payment.captured** (and **order.paid**)
- Set a **secret**, then add it to `RAZORPAY_WEBHOOK_SECRETS` under that account's
  Key ID, and redeploy.

This guarantees a payment records even if the user closes the tab mid-checkout.

---

## 7. Firestore rules

The rules already include the `paymentAccounts` collection, and **you've deployed
them**. Re-run this after any future rules change (with the account that has
deploy rights — `michaelharoldsony.02.02.2006@gmail.com`):

```
firebase deploy --only firestore:rules
```

---

## 8. Go live

Once verified in Test mode, complete Razorpay **KYC**, swap the `rzp_test_…` keys
for **live** keys in the env (both `VITE_RAZORPAY_KEY_ID` and `RAZORPAY_KEYS`),
update each account profile's Key ID in the panel, and redeploy.

---

## Still future (optional)

- **Razorpay Route** for true split-settlement to sub-accounts (vs. one account per
  event). Needs KYC per linked account; the current model already routes each event
  to a chosen account.
- **Retry / mark-paid for event registrations** whose online payment was cancelled
  (membership already has a “Pay now” retry; paid events currently rely on the
  organiser following up).
