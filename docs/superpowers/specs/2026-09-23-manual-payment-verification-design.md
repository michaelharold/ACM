# Manual payment verification (UPI QR + receipt upload)

Date: 2026-09-23 · Status: approved in chat, pending spec review

## Goal

Replace the Razorpay checkout with a manual flow. The user pays to a UPI QR account shown on the site, then uploads a payment screenshot and enters the UPI transaction ID (UTR). An admin checks the receipt and approves or rejects it. Only a verified registration gets its ticket and WhatsApp link. A verified membership gets member status and a membership ID. Razorpay stays in the codebase but is switched off, so it can be turned back on later.

## Constraints

- **Stay on the free Firebase (Spark) plan.** There's no Cloud Storage, so receipt screenshots are compressed and stored inline as data URIs, one per Firestore document. This follows the existing gallery pattern.
- **No new server code.** Firestore security rules enforce every payment state change, so the flow works even when the Vercel `/api` isn't deployed. Team registration still uses the existing `/api/register-team`.
- **Mock (demo) mode keeps working.** Service functions fall back to localStorage, following the existing idiom in `src/services/firestore.js`.

## Payment mode switch

`src/lib/payments.js` gets a mode constant:

```js
export const PAYMENT_MODE = 'manual' // set to 'razorpay' once Razorpay is approved
export const isRazorpayMode = PAYMENT_MODE === 'razorpay' && !!import.meta.env.VITE_RAZORPAY_KEY_ID
export const isApiAvailable = !!import.meta.env.VITE_RAZORPAY_KEY_ID || import.meta.env.VITE_API_ENABLED === '1'
```

- **Razorpay code stays in place.** `payFor`, the `/api/*` payment endpoints, the webhook and the `paymentAccounts` collection are untouched. Every Razorpay call site becomes `if (isRazorpayMode) {…old path…} else {…manual path…}`.
- **`isApiAvailable` replaces `isPaymentConfigured`** where the question is "is the backend deployed" (membership ID verification). The old `isPaymentConfigured` export stays as an alias of `isRazorpayMode`.

## Data model

### `upiAccounts/{id}` (new, public read)

`{ label, payeeName, upiId, qrImage (data URI, ≤150 KB), active, createdAt }`

- **Default account:** `siteContent/main.defaultUpiAccountId`.
- **Event:** `events/{id}.upiAccountId`, where `''` means the default.
- **Membership:** `siteContent/main.membershipUpiAccountId`, where `''` means the default. The existing `membershipFee` stays.
- **Resolving an account:** use the explicit account if it exists and is active, otherwise the default. If neither exists, the payment step shows "Payment details not set up yet — contact the organisers" and blocks submit.

### `registrations/{id}` (extended)

`paymentStatus` takes these values:

| value | meaning | ticket? |
|---|---|---|
| `free` | nothing to pay | yes |
| `pending` + `receiptId` | receipt submitted, under review | no |
| `pending`, no `receiptId` | awaiting receipt (team leader, or an upload that failed) | no |
| `paid` | verified by an admin | yes |
| `rejected` | admin rejected; `rejectReason` shown to the user | no |

New fields:

- `amountDue` — fee after any verified member discount
- `upiAccountId` — the account the user was shown
- `receiptId`, `utr`, `receiptSubmittedAt`
- `reviewedBy` (name), `reviewedAt`, `rejectReason`
- `seatHeld` — true while this registration occupies a capacity slot

`seatHeld` exists so that reject, re-upload and cancel never double-count a seat. A registration with `counted: true` and no `seatHeld` field (legacy data) is treated as holding a seat.

### `memberships/{uid}` (extended)

It gets the same `paymentStatus` values and the same receipt and review fields as registrations. It does not get `seatHeld`.

### `receipts/{id}` (new)

`{ kind: 'event'|'membership', refId, userId, image (data URI, ≤300 KB), utr, amount, createdAt }`

- There's one image per document, and it's loaded only when a reviewer opens it. Registration lists never include image data.
- Rejecting a receipt deletes the receipt document, so storage stays small. Verified receipts are kept for audit.

### `utrs/{utr}` (new)

`{ userId, kind, refId, receiptId, createdAt }`

- The document ID is the 12-digit UTR. The rules only allow creating one, never overwriting it, so a UTR can be used exactly once. Rejecting deletes it, which lets the user resubmit the same UTR.

## Seat accounting

`registeredCount` keeps using the existing ±1 rule.

| action | effect |
|---|---|
| create (capped event) | capacity check, `+1`, `seatHeld: true` |
| admin rejects | if `seatHeld` → `−1`, `seatHeld: false` |
| user re-uploads after rejection | capacity re-check; if full, refuse ("event is full"); else `+1`, `seatHeld: true` |
| user cancels an unverified registration | if seat held → `−1`, then delete |
| admin approves | no change |

The capacity check stays best-effort and non-atomic, as it is today.

## Security rules

`isVerifierFor(kind)` means: `isAdmin()`, or `hasPerm('registrations')` for event receipts, or `hasPerm('membership')` for membership receipts.

### `registrations`

**create** — the owner only, plus:
- `paymentStatus in ['free','pending']`
- `free` is allowed only when `event.fee == 0`, or when `event.fee − event.acmDiscount ≤ 0` and a `membershipId` is present
- `pending` requires `amountDue ≥ event.fee − event.acmDiscount`

**update, owner (the leader, `userId`)** — the keys that can change are limited to `receiptId, utr, receiptSubmittedAt, paymentStatus, rejectReason, seatHeld`, and:
- the old status must be `pending` or `rejected`
- the new status must be `pending`

**update, verifier** — `isAdmin()`, or `hasPerm('registrations')` limited to the review keys: `paymentStatus, paidAt, reviewedBy, reviewedAt, rejectReason, seatHeld, receiptId, utr`.

**delete** — unchanged: the owner while not `paid`, or an admin.

### `memberships`

**create** — as today, plus `paymentStatus in ['free','pending']`. `free` is allowed only when `siteContent/main.membershipFee` is 0 or unset.

**owner update** — `membershipId` stays unchanged, and:
- `paymentStatus` stays unchanged or becomes `pending`
- the owner can't touch `reviewedBy`, `reviewedAt` or `paidAt`

### `users`

- A user can no longer change their own `acmMember`. It's added to the protected keys alongside `role` and `permissions`.
- An admin, or anyone with `hasPerm('membership')`, may update only `acmMember`.

### `receipts`

- **create:** `userId == auth.uid`, `image` is a string under 400,000 characters, `utr` matches `^[0-9]{12}$`, and `kind` is `event` or `membership`
- **read:** the owner, or a verifier for that kind
- **delete:** a verifier for that kind
- **update:** never

### `utrs`

- **get:** signed in, and either the document doesn't exist or it's the reader's own. A denied read therefore means the UTR is someone else's, which gives the user a clear message.
- **create:** `userId == auth.uid`, and the document ID matches `^[0-9]{12}$`
- **delete:** an admin, or anyone with `hasPerm('registrations')` or `hasPerm('membership')`
- **list, update:** never

### `upiAccounts`

- **read:** anyone
- **create/update:** `isAdmin() || hasPerm('events')`, so an event editor can add a QR while creating an event
- **delete:** `isAdmin()`

## User-facing flow

### Registration drawer (`RegistrationDrawer.jsx`)

When the amount due is more than 0 in manual mode, a **Payment** step is added before Confirm. The steps become Details → Eligibility/Team → Payment → Confirm.

The Payment step shows a `PayToCard`:
- QR image, payee name and UPI ID with a copy button
- the exact amount
- a "Pay with UPI app" link, `upi://pay?pa=…&pn=…&am=…&cu=INR&tn=<event name>`, shown on phones

Below it is `ReceiptUploader`:
- The user picks a screenshot. It's compressed client-side with the new `prepareReceipt` in `imagePrep.js`: longest edge ≤1400px, stepping down JPEG quality until it's ≤300 KB.
- A preview appears, plus a UTR input that requires exactly 12 digits.
- Continue is disabled until both are present.

**On submit:**
- **Solo registration and random grouping:**
  1. Pre-check the UTR with `utrs` get.
  2. Capacity check.
  3. One batch writes the registration, `receipts/{id}` and `utrs/{utr}`.
  4. Bump the seat.
- **Manual team:** `/api/register-team` runs first, then `submitReceipt(regId)`. If the receipt step fails, the team stays "awaiting receipt" and the leader can upload from the dashboard.
- **Success screen:** "Receipt submitted — we'll verify your payment shortly". The WhatsApp link is **not** shown until the registration is verified.

### Membership page (`Membership.jsx`)

- **Fee above 0:** the form includes a `PayToCard` for the membership account and a `ReceiptUploader`. Submit writes the membership, receipt and UTR in one batch with `paymentStatus: 'pending'`.
- **`saveProfile({ acmMember: true })` is removed.** Member status is now set by the verifier.
- **Status card:** Under review, Rejected (with the reason and a re-upload form), or Verified (with the membership ID once assigned).

### Dashboard (`Dashboard.jsx`)

**"My tickets" carousel** (new `TicketCarousel` + `TicketCard` components):
- It shows every registration with status `paid`, and `free` ones too, labelled "Confirmed".
- It uses horizontal scroll-snap with previous/next arrows and dots.
- Each **ticket card** has:
  - a ticket-shaped body with semicircle notches on both sides and a dashed tear line
  - an outer **golden glow** (amber gradient border plus amber box-shadow)
  - the event name
  - the person's name inside a **green neon box with a ✓ tick and "Verified"**: emerald border, emerald outer glow and text glow
  - event date, time, venue, team name (if any) and a ticket code `ACM-XXXXXX` (the first 6 characters of the registration id, uppercased)
- It works in both light and dark themes, and honours `prefers-reduced-motion`.

**Registered events list** — the status badge follows the payment state:
- **Under review** (amber)
- **Awaiting receipt** (amber), with an upload button
- **Rejected** (red), with the reason and an "Upload new receipt" button
- **Verified**/**Free** (green)

The WhatsApp link is shown only for `paid` or `free`. Re-upload reuses `ReceiptUploader` in a modal and calls `resubmitReceipt`.

**Membership box** — shows Under review, Rejected or the ID, consistent with the Membership page.

## Admin

### Payments tab (`PaymentsPanel.jsx`, admin only)

1. **UPI / QR accounts:**
   - a list with the QR thumbnail, label, payee, UPI ID and active toggle
   - a ★ **Default** marker, and "Set as default"
   - add and edit forms: label, payee name, UPI ID, QR image upload through `prepareImage` (square 600×600)
   - delete, which is blocked for the current default
2. **Membership payment:** the fee, plus a "Collect to" select (Default account or any UPI account).
3. **Razorpay (inactive):** the existing Razorpay profile manager moved into a collapsed section labelled "Currently switched off — set PAYMENT_MODE to 'razorpay' in src/lib/payments.js to use".

### Event editor (`Admin.jsx` `EventEditor`)

When the fee is above 0, "Collect payment to" becomes a select with:
- **Default account (name)**
- each active UPI account
- **+ Add new QR account…**, which opens the same account form in a modal, saves, and selects the new account

The Razorpay `paymentAccountId` field is kept but shown only in Razorpay mode.

### Verify payments tab (new `PaymentReviewPanel.jsx`)

- **Who sees it:** admins, plus editors with `registrations` or `membership`. Each editor only sees the kinds they're allowed to verify.
- **Queue:** pending items that have a `receiptId`, oldest first. Filters are Events / Membership and per event. Each row shows:
  - the person, the event (or "Membership") and the amount due
  - the UTR, and when it was submitted
  - any claimed membership ID; admins or membership editors also see ✓/✗ against the memberships list
- **Opening a row** shows the `ReceiptReviewModal`:
  - the full screenshot and the UTR
  - the amount due and which account it should have gone to
  - **Approve** and **Reject** (a reason is required)
- **Approve:**
  - registration → `paid`, `paidAt`, `reviewedBy`, `reviewedAt`
  - membership → the same, plus `users/{uid}.acmMember = true`
- **Reject:**
  - the record gets status `rejected` and the `rejectReason`
  - `receiptId` and `utr` are cleared
  - the receipt and UTR documents are deleted
  - the seat is released if `seatHeld`

### Existing Registrations and Membership panels

- **Payment column:** Under review / Awaiting receipt / Verified / Rejected / Free, plus a "View receipt" button that opens the same `ReceiptReviewModal`.
- **CSV:** the export adds the UTR, the reviewer and the reviewed-at time.
- **Razorpay-only alerts:** the "stuck pending" check alerts (`paymentHealth`) only apply in Razorpay mode. In manual mode, the tab's red dot and the Overview tile show the **number of receipts awaiting review**.

### Storage meter

The storage estimate now counts receipts and QR images too, so the free-plan guardrail stays accurate.

## Server changes (`/api`, dormant until deployed)

- **`api/_lib/grouping.js`:** Random Grouping only forms teams from **verified (`paid`/`free`)** solo registrations. Unverified and rejected ones stay solo for an admin to handle. Each member entry carries its `receiptId` and `utr`, and a team is `paid` only if every member is `paid` or `free`.
- **`api/register-team.js`:** stores `amountDue: fee` and `seatHeld: counted` on the team registration.
- Razorpay endpoints are unchanged.

## Testing

- **Rules tests:** `scripts/rules.test.mjs`, using `@firebase/rules-unit-testing` with `node:test`, run by `npm run test:rules` through `firebase emulators:exec --only firestore`. It covers:
  - self-verify denied, for both registration and membership
  - a user can't create a `paid` registration
  - `free` is denied on a paid event
  - a duplicate UTR is denied
  - another user's receipt can't be read
  - a verifier can approve and reject; an editor without the grant can't
  - a user can't set their own `acmMember`
  - an owner can resubmit after rejection
- **Pure helpers** (unit-tested with `node:test`):
  - `isValidUtr`
  - `upiLink`
  - `ticketCode`
  - `paymentState(record)`, which maps a record to under-review / awaiting / verified / rejected / free
  - `resolveUpiAccount`
- **Build:** `npm run build` stays green.
- **Manual end-to-end in the dev server:** register for a paid event → upload → admin rejects → seat count drops → re-upload → admin approves → the ticket carousel shows the card → the WhatsApp link appears. Repeat for membership.

## Out of scope

- A QR scanner or check-in screen.
- Email notifications.
- Automatically cancelling unverified registrations after a timeout.
- A downloadable ticket image.
