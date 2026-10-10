> [!IMPORTANT]
> This project is deployed on Vercel (not Lovable). `vite.config.ts` switches the Nitro preset to `vercel` when `VERCEL` is set, and `vercel.json` holds the install/build commands and the cron schedule. Keep the main branch in a working state; avoid rewriting pushed history.

- Render the browser-only administrator bottom navigation in `AccountShell`; this keeps it consistent across admin pages while leaving installed-app navigation independent.
- Suppress website chrome for authenticated admins in SiteHeader and the shared account shells, keeping account actions in the shell header so individual pages cannot restore the public header.
- Keep AccountShell and AppShell page workspaces full-width without outer horizontal gutters; shared shell sizing prevents individual signed-in pages reverting to a centred layout.
- Rental rent for admins other than the exempt original owner is charged as direct charges on that admin's own Stripe Connect account (stripe-connect.server.ts); the exempt owner keeps the built-in Stripe flow so existing payments are untouched.
- Motorbike finance maths lives in `src/lib/finance-calc.ts` (pure, integer pence) and is recomputed server-side in `finance.server.ts` on every save; the browser only previews, so stored schedules are always server-authoritative.
- Early settlement reads the global rebate setting on every server operation and passes it to the pure calculation; cached browser settings never authorise rebates.
- Reusable administrator signatures are private per-user records; explicit finance signing copies the saved image/name into the agreement and records a snapshot-linked audit action so later signature edits cannot alter executed documents.
- Finance conversation notes are separate staff-only records, not customer-visible finance transaction notes, so internal conversations do not leak into customer statements.
- Agreement PDFs are generated on demand in the browser from the full rendered document, including both signatures, without relying on a print popup.
- `finance_transactions` is append-only (trigger blocks update/delete); corrections must be new reversal rows so the audit trail stays intact.
- Finance staff permissions are enforced server-side via `assertFinance` in `src/lib/finance-perms.ts`; staff without a saved permissions row keep default access so existing staff aren't locked out.
- Finance accounts (P&L, ledger, cash flow) are derived from the append-only `finance_transactions` kinds at read time rather than a separate ledger table, so the audit trail stays the single source of truth.
- Phase-two finance actions use a shared confirmation dialog in FinancePhase2 before mutations, explaining actual record/payment/delivery effects without changing server behaviour.
- Stock/Inventory (/admin/inventory) is batch-based (stock_batches, FIFO) and its undo writes reversal movements plus a stock_movement_undos row, because stock_movements are immutable for audit.
- Expanded inventory rows derive batch order from the existing received-date/created-date ordering and pass the selected batch into the adjustment dialog, so displayed FIFO and adjustment targets stay aligned with inventory data.
- Stock action popups use a shared full-window accessible dialog with a fixed close control; product forms use a bounded scroll panel with a sticky header so closing stays available on short screens.
- Stock counts use an atomic authorised RPC and immutable movement-linked postings; approval and undo preserve financial exclusion, and main P&L derives count gains/losses and inventory financial value from those postings without inventing cash movements.
- Only staff, admins and owners sign in; there are no customer accounts, loyalty, credit balances, payment plans, Dawat or customer reminder/push features, so new work must not add customer self-service pages.
- Till customers are plain contact records (`pos_customers`: name, phone, optional email) linked to a sale via `sales.pos_customer_id` only so receipts and invoices show who bought; they are soft-deleted so past receipts keep the name, and must not grow logins, balances or loyalty.
- Built-but-hidden modules are switched off in `src/lib/features.ts` (currently finance and Stripe online payments): gate navigation, routes, public links and outward-facing server actions on the flag instead of deleting the module, so it can be re-enabled.
- The app sends no email of any kind (no reminders, receipts, invoices, alerts or contact emails) and runs no automatic rental billing; rental weeks are created when staff list or open rentals and payments are recorded manually. Only Supabase Auth's own password-reset email exists.
- Public contact-form submissions are stored in `contact_enquiries` by the server (service role) and followed up in /admin/enquiries; anonymous users have no direct table access.
