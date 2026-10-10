# Till upgrade: reg search, three pay buttons, till & reports bar

Brings the TilloraPOS till features into this shop, using this project's red/white styling.

## 1. Search customers by bike registration

At the till (customer box and main scan box) and in the Vouchers, Loyalty Cards and
Customers search, typing a registration (with or without a space) finds the customer.
Matching looks at the registration saved on the profile and at every vehicle on their
account, so older or second bikes are found too.

## 2. Three payment buttons instead of one Charge

The single red Charge button becomes three:

- **CARD** — sends the amount to the card machine, then completes the sale on approval.
- **CASH** — opens a cash window: amount tendered, quick-cash buttons (£5/£10/£20/£50,
  exact total), change due in large figures, then complete.
- **CARD + CASH** — enter how much is paid in cash; the rest goes to the card machine.
  Both parts are recorded on the sale.

The existing Cash / Card / Bank / Split / Credit selector stays for bank transfer and
credit sales; the three buttons drive the normal till flow.

## 3. Module bar next to Sign out

A row of small buttons (no icons), no taller than the Sign out strip:
**Orders · Print Reports · Expenses · Open Till / Close Till · Closed Tills ·
Cash in Till · Cash with Card** — the last two showing today's live totals on the button
itself, in the green style from the screenshot.

## 4. What each button opens

- **Print Reports** — three tabs (Sales · Expenses · Profit & Revenue) with search, a
  date-period filter (Today, Yesterday, This week/month, custom from–to) and **A4** and
  **Thermal** print buttons. Sales lists order, date, type, status, VAT, total; Expenses
  lists date, expense, category, notes, amount; Profit & Revenue lists revenue, VAT,
  net sales, cost of goods, gross profit, expenses, net profit, transactions. Refunded
  rows show in red and count as negative, as in TilloraPOS.
- **Expenses** — add-expense popup (what it was for, amount, date, category, notes) saving
  straight into the existing expenses module.
- **Open Till** — enter opening float; once open the button becomes **Close Till**, showing
  opening float, cash sales, expected cash, counted cash and the variance.
- **Closed Tills** — history with opened/closed times, cash at open, owner cash added,
  cash at close, variance, printable A4/thermal.
- **Cash in Till** — cash payments for the period, opening float, paid out, cash in drawer,
  plus "add own cash to till"; printable.
- **Cash with Card** — card and bank-transfer takings for the period; printable.
- **Orders** — opens the existing sales list.

Cost and profit figures stay hidden from the account that must not see them.

## Technical notes

- Migration adds `till_sessions` and `till_cash_movements` (RLS + GRANTs, staff-only),
  and `sales.till_session_id`, `sales.cash_tendered_pence`, `sales.cash_part_pence`,
  `sales.card_part_pence`.
- New `src/lib/till-print.ts` (A4 + 80mm thermal HTML via hidden iframe, shop header),
  `src/components/till/TillModules.tsx` (report/till/expense dialogs), and
  `src/lib/till.functions.ts` (staff-guarded server functions for sessions, movements,
  report data).
- Registration search: add `bike_reg` to the profile `or(...)` filters in
  `src/lib/loyalty.functions.ts` and pre-resolve `vehicles.registration_normalized`
  to user ids for an `id.in.(…)` clause.
- Split/cash handling extends the existing `createSale` path in `src/lib/pos.functions.ts`
  with the new amount fields; card flow reuses `sendToTerminal`.
