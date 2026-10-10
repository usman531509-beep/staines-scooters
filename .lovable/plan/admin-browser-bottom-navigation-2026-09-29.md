# Admin browser bottom navigation

## Changes
- Replace the existing browser POS-only bottom bar with one shared sticky bottom navigation shown to admins on every signed-in web page.
- Match the supplied reference: compact white bar, thin top border, centred outline icons above small labels, dark inactive items, and red active item.
- Include, in order: Menu, Dashboard, POS, Sales, Refunds, Products, Categories, Customers, Loyalty Cards, Vouchers, Credit balances, Offers, Rental, Claims, Expenses, Profit & Loss, MOT, Road Tax, and Service.
- Make every destination clickable; Menu opens the existing full navigation panel.
- Keep the bar fixed above the bottom edge, horizontally scrollable on narrower browser windows, and add page space so it never covers content.
- Remove the current POS-only browser bottom bar to prevent duplication.
- Leave the installed app navigation and non-admin accounts unchanged.

## Technical details
- Add the shared browser-admin navigation to the existing account shell, where admin role and app/browser mode are already known.
- Reuse the existing routes, icons, and semantic red/white design tokens.
- Preserve active-page highlighting for nested pages such as sale details and category details.
