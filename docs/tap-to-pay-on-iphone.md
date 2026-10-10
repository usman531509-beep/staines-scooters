# Tap to Pay on iPhone — what Stainess Scooter needs before any code can ship

Goal: an admin opens the POS on an iPhone, presses **Charge**, the customer taps
their contactless card, Apple Pay or Google Pay **onto the iPhone itself**, and the
sale is recorded automatically.

This is technically possible, but it cannot be built inside the web app. It requires
a **native iOS app** containing Stripe's Terminal SDK, an **Apple entitlement**, and a
**Stripe account with Terminal enabled**. Below is everything required, in order.
Nothing has been coded yet — by design. Once the three approvals in Stage 1–3 are in
place, the work in Stage 4–6 can be done.

---

## Hard requirements (all mandatory, no workarounds)

| Requirement | Why | Who grants it |
|---|---|---|
| iPhone XS or newer, iOS 17+ | Tap to Pay uses the phone's secure NFC reader | — |
| Apple Developer Program membership (paid, £79/yr) | Needed to request the entitlement and sign the app | Apple |
| Entitlement `com.apple.developer.proximity-reader.payment.acceptance` | Without it the NFC reader refuses to accept payments | Apple, on request |
| A real Stripe account (not the built-in Lovable payments connection) | Terminal connection tokens require your own Stripe secret key | Stripe |
| Stripe Terminal enabled + Tap to Pay on iPhone approved | Terminal is off by default and Tap to Pay is separately reviewed | Stripe |
| A native iOS build (Swift + StripeTerminal SDK) distributed via App Store or TestFlight | The SDK is native code; it cannot run in a web view | You / a developer |
| UK-registered business, UK Stripe account | Tap to Pay on iPhone is live in the UK | — |

**Not possible:** running this through the current Capacitor shell as-is (it just
loads the live site in a web view), through Stripe.js, or through
Lovable's built-in payments connection. That connection is a gateway key, not a
Stripe secret key, and it does not issue `terminal/connection_tokens`.

---

## Stage 1 — Stripe account and Terminal access

1. Create or sign in to your own Stripe account at `dashboard.stripe.com`
   (business: Stainess Scooter, UK, motorcycle sales & servicing).
2. Complete full business verification: company details, UK bank account, ID for
   the director, trading address.
3. In the Stripe Dashboard, open **More → Terminal** and enable Terminal.
4. Request **Tap to Pay on iPhone** for the account:
   <https://stripe.com/docs/terminal/payments/setup-reader/tap-to-pay>
   Stripe reviews this — expect a few working days. They may ask what you sell and
   your expected in-person volume.
5. Create a **Terminal Location** (Dashboard → Terminal → Locations) for the
   shop address. Every Tap to Pay reader must be tied to a Location; note
   the `tml_...` ID.
6. Copy the **restricted API key** (secret) with Terminal write permission. This is
   the key the connection-token endpoint will use.

**Deliverable to me:** confirmation that Tap to Pay is approved, the Location ID,
and the restricted key added as a project secret (never pasted into chat).

---

## Stage 2 — Apple Developer Program and the entitlement

1. Enrol Stainess Scooter in the Apple Developer Program (£79/yr) — a business
   enrolment needs a D-U-N-S number, which is free and takes ~1–2 weeks if you don't
   have one. A sole-trader/individual enrolment is faster if acceptable.
2. Register the App ID `com.stainessscooter.app` (already the Capacitor `appId`).
3. Request the entitlement at
   <https://developer.apple.com/contact/request/tap-to-pay-on-iphone/>
   You will be asked for: the App ID, the payment service provider (answer: Stripe),
   your business details and the use case ("in-store card payments for motorcycle
   parts, servicing and rental at our shop").
4. Apple emails approval, then the entitlement appears in the Certificates,
   Identifiers & Profiles section. Regenerate the provisioning profile so it includes
   the entitlement.

**Realistic timeline for Stages 1–2 together: 2–5 weeks**, mostly waiting on Apple.

---

## Stage 3 — Merchant terms

On the first Tap to Pay run, Apple shows a one-time **terms of service** screen that
the merchant (you) must accept on that specific iPhone, for that Apple ID. This is
per-device and per-account. Every shop iPhone has to accept it once.

---

## Stage 4 — Backend work (I build this)

Small and self-contained; it only becomes useful once Stages 1–3 are done.

1. **Secrets**: `STRIPE_TERMINAL_SECRET_KEY`, `STRIPE_TERMINAL_LOCATION_ID`.
2. **Connection token endpoint** — `POST /api/terminal/connection-token`, staff-auth
   only, returns `stripe.terminal.connectionTokens.create()`. The iOS SDK calls this
   every time it connects a reader.
3. **PaymentIntent endpoint** — creates a PaymentIntent for the POS cart total with
   `payment_method_types: ["card_present"]`, `capture_method: "automatic"`, currency
   `gbp`, and metadata carrying the POS sale draft ID, cart lines, customer ID and
   the staff member. Returns the client secret to the app.
4. **Capture / confirm endpoint** — after the SDK collects the card, the server
   confirms and captures the intent.
5. **Webhook** — on `payment_intent.succeeded` for a `card_present` intent, look up
   the sale draft from metadata, complete the sale exactly as the existing POS
   `checkout` does (stock movements, loyalty points, offer progress, vouchers), then
   fire the existing purchase thank-you email. This is what makes the sale
   **auto-complete**, as you asked, with no second "Charge" press.
6. **Reconciliation** — a `card_terminal_transactions`-style row per attempt so
   approved / declined / cancelled attempts are visible in admin, same as the current
   Takepayments screen.

---

## Stage 5 — Native iOS app work (needs a Swift developer or a new native build)

The current app is a Capacitor shell whose `server.url` points at the live website,
so there is no native layer to attach the SDK to. Two options:

**Option A — Capacitor plugin (recommended, keeps one codebase)**
1. Generate the native iOS project (`npx cap add ios`) and commit it.
2. Add `StripeTerminal` via Swift Package Manager / CocoaPods.
3. Write a small Capacitor plugin exposing four methods to the web POS:
   `initialize()`, `discoverAndConnectLocalMobileReader()`, `collectPayment(intentClientSecret)`,
   `cancel()`.
4. Add to `Info.plist`: `NFCReaderUsageDescription`, `NSLocationWhenInUseUsageDescription`
   (Stripe requires location for in-person payments), and the
   `com.apple.developer.proximity-reader.payment.acceptance` entitlement.
5. In the POS screen, when running inside the native iOS app **and** Tap to Pay is
   available, show a **Tap to Pay** button next to the existing Cash / Card / Bank
   buttons that drives the plugin. On web and Android it stays hidden.

**Option B — separate native POS app** for staff only. Cleaner native code, but you
then maintain two apps.

Either way the app must be distributed through **TestFlight then the App Store** —
Tap to Pay does not work in a simulator, and it does not work in a web view.

---

## Stage 6 — Testing and go-live

1. Stripe test mode + Tap to Pay simulated reader for the plumbing.
2. On a real iPhone in test mode, tap a real contactless card — Stripe supports
   test-mode taps on device.
3. Switch to the live restricted key, do a £1.00 real sale, refund it.
4. Train staff: unlock iPhone → open POS → build cart → **Tap to Pay** → customer
   taps at the top of the phone → receipt emails automatically.

---

## Costs to expect

- Apple Developer Program: £79/yr.
- Stripe in-person UK card fees: from **1.5% + 20p** for UK consumer cards (check
  your account's current rate; Tap to Pay has no separate hardware cost).
- Native development time for Stage 5 if you don't have a Swift developer.

---

## What happens next

Send me, in this order:
1. "Tap to Pay approved by Stripe" + the Terminal Location ID.
2. "Entitlement approved by Apple".

The moment both exist, I build Stage 4 in full and the Capacitor plugin scaffold for
Stage 5, and wire the **Tap to Pay** button into the POS with auto-completing sales.

### If you don't want to wait weeks

I can ship, today, a working contactless flow with no Apple or Stripe approvals: the
POS shows a QR code and short link for the exact total, the customer scans it and pays
with Apple Pay / Google Pay / card in one tap on **their own** phone, and the POS
auto-completes the sale the second Stripe confirms. Same customer experience, no
hardware, no entitlement. Say the word and I'll build it.
