# POS popup and desktop navigation

## Changes
- Move the Enter Price popup toward the top of the POS screen so it remains visible above the Windows on-screen keyboard.
- Add a sticky, horizontally scrollable bottom navigation bar to the browser POS on computers.
- Include the navigation destinations shown in the reference: POS, Sales, Refunds, Card Terminal, Products, Categories, Lost & Damaged, Customers, Loyalty Cards, Vouchers, Credit Balances, and Offers.
- Keep this new bottom bar limited to the browser POS computer view so existing mobile and installed-app navigation remains unchanged.

## Technical details
- Reuse the existing routes and current red/white design tokens.
- Add bottom space to the POS content so the fixed navigation never covers products or basket controls.
- Highlight the active POS item and keep all other destinations directly clickable.
