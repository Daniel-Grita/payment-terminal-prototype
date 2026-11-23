# PayXpress payment terminal — interactive prototype

A code-built version of the PayXpress terminal app designed in Figma ("PayXpress Compose"),
shown inside a Sunmi P3 terminal (camera notch included) for usability testing and
recording in a desktop browser.

Unlike a Figma prototype, it behaves like the real thing where it matters: the keypad takes
any amount and the payment runs through with it, approved sales show up in the history and
the daily summary, and settings change what the screens show. Screens, timings and
transitions follow the Figma frames.

## Run it

Needs [Node.js](https://nodejs.org); no install step, no dependencies.

```bash
node serve.mjs
```

Then open <http://localhost:5173>. The server only answers on this machine; to open the
prototype from a phone on the same network, start it with `HOST=0.0.0.0 node serve.mjs`.

## What's in it

Everything starts from the amount-entry screen: ✓ runs a payment, ☰ opens the menu.

| Flow | Reached from | Source |
|---|---|---|
| [Payment](#payment) | the keypad | Figma › Payment Flow (New) |
| [Transaction history](#transaction-history) | ☰ › Transaction's history | Figma › Transaction History |
| [Daily summary](#daily-summary-and-business-day-hours) | ☰ › Daily summary, ☰ › Settings | Figma 1732:26911, 1850:5027, 2563:15083; settings from the PayXpress manual |
| [File collection's history](#file-collections-history) | ☰ › File collection's history | Figma › File Collection |

### Payment

| # | Screen | Moves on |
|---|---|---|
| 1 | Amount entry | ✓ with an amount (dissolve 300 ms) |
| 2 | Please wait | after 2 s |
| 3 | Present card | **click the screen** to tap the card (dissolve 800 ms) · **Cancel transaction** returns to 1 |
| 4 | Card read | after 1 s |
| 5 | Please wait | after 0.8 s |
| 6 | Authorization | after 2 s |
| 7 | Approved | banner animation plays, CB logo fades in · after 2 s (dissolve 300 ms) |
| 8 | Cardholder receipt | **View receipt** opens the ticket · **Skip** starts a new sale |
| 9 | Ticket (overlay) | **Close** returns to 8 |

**Alternative payments (Alipay QR)** — stage menu › Upcoming features › **Alipay QR payments**
(Figma › Payment Flow QR Code Alipay, 5987:4877; copy translated to English). Only Alipay is accepted: WeChat Pay is shown, as in Figma, but tapping it does nothing.
With the switch on, screen 3 becomes Present card with a **Pay by QR code** option:

| # | Screen | Moves on |
|---|---|---|
| 3 | Present card + QR | **Alipay** opens 3a · **WeChat Pay** does nothing · click elsewhere taps the card (card flow as above) · **Cancel transaction** returns to 1 |
| 3a | Alipay QR code | **click the screen** = the customer scans it (dissolve 300 ms) · **Cancel transaction** returns to 1 · **Scan customer's QR code** is shown, not wired |
| 5–9 | Please wait → Authorization → Approved → Receipt → Ticket | as above, but Authorization shows ALIPAY+, Approved and Receipt have no CB mark, and the ticket reads ALIPAY+ |

An Alipay sale always ends on the new screens, even with the Old interface (it has no Alipay screens), and counts under QR codes › Alipay+ in the daily summary.

**Keypad:** digits fill from the cents (5 → 0,05 → 0,50 → 5,00 €), ← deletes, ✕ clears,
✓ at 0,00 € shakes the amount. Maximum 99 999,99 €.

### Transaction history

| # | Screen | Moves on |
|---|---|---|
| H1 | Menu | ☰ dims the screen, the menu slides in · an entry opens its screen · tap outside closes |
| H2 | Transaction's history | **Filters** icon opens the filters sheet · a row opens H3 · a day header collapses its rows · drag or scroll the list |
| H2 | Filters (sheet) | pick one chip per group (ALL clears it) · **Apply filters** filters the list and shows the count on the icon · **Cancel** · **Reset** |
| H3 | Transaction's details | **←** back to H2 · **share** icon opens "Editing a duplicate" |
| H3 | Editing a duplicate (sheet) | **Customer copy** or **Merchant copy** opens the receipt · **Close** returns to the sheet |

Sales approved in the payment flow are added under today's date, with their amount and time.

### Daily summary and business-day hours

D1 follows Figma: **Operations** (1732:26911) and **Payment methods** (1850:5027, cards / Conecs TR / QR codes, each group collapsible). The figures are computed from sample activity, so every total agrees across both tabs. D2 and D3 follow the PayXpress manual.

**Upcoming features** (stage menu, the ☰ in the page's top-left corner; remembered per browser): **ECR & Quick mode** splits Accepted debits into payments made through the cash machine and payments made on the terminal alone, and adds the **More info** note (Figma 2563:15083). Payments made in the prototype count as Quick mode.

| # | Screen | Moves on |
|---|---|---|
| D1 | Daily summary | shows the **last business day that has ended** · **Operations** / **Payment methods** tabs |
| D2 | Settings | **Daily summary** opens D3 (the other entries are shown, not wired) |
| D3 | Settings › Daily summary | **Custom start and end time** switch · **Start time** / **End time** open the time dialog · **←** back to D2 |
| D3 | Time dialog | type the hour, then the minute (two digits, or a first hour digit above 2, moves on) · a click picks a field · arrow keys or the mouse wheel step it · **Confirm** or Enter · **Cancel**, Esc or a tap outside |

A business day is the calendar day (00:00–23:59) until custom hours are switched on. An end
time at or before the start time ends the next day (e.g. 17:00 → 02:30), as for night taxis.
The summary counts accepted operations only: debits (with their tips), minus cancellations
and credits. Its sample sales cover the last five days at fixed times of day and night, so
changing the hours visibly changes the totals; approved sales are added too, and appear once
their business day has ended. The hours reset when the page reloads.

### File collection's history

| # | Screen | Moves on |
|---|---|---|
| R1 | File collection's history | grey placeholders for 2.5 s, then the reports, newest day first · a day header slides its reports shut (chevron up) or open · **@** or the **printer** on a report opens R2 · the **upload** icon opens Send |
| — | Send (dialog) | **Send**: a spinner replaces the icon for 2.5 s, placeholders for 1.5 s, then today's reports appear on top · **Cancel** or a tap outside closes it |
| R2 | Report ticket | **@** opens the email dialog · **Close** or Esc returns to R1 (print is inert) |
| — | Email (dialog) | tapping the field types example@email.com in, or type any address · **Validate** or Enter: "sending in progress" for 1.5 s, then "Ticket has been sent" · **OK** returns to R1 |

The reports are the Figma frames' sample data; the prototype's "today" is 02/09/2026, as in Figma.

### Pay by Link

Stage menu › Upcoming features › **Pay by Link** adds the entry to the side menu, under Charge
(Figma › Pay by Link, 6481:33361). The merchant sends the client a payment link by email
instead of taking a card.

| # | Screen | Moves on |
|---|---|---|
| L1 | Pay by Link | **Start a new payment** slides in L2 · the search field filters by client's email · a day header collapses its rows · a row slides in L4 (a link still being created is greyed out and can't be opened) |
| L2 | New payment link (1/2) | **Communication language** opens a sheet listing 19 languages (it scrolls; the chosen one is ticked, Cancel, Esc or a tap outside closes it) · **Next** checks the fields, then shows L3 · a missing or invalid required field turns red with its message · **←** back to L1 |
| L3 | New payment link (2/2) | **Send link** checks first and last name, then shows "Confirmation" · **OK** slides L3 away to L1, where the new link is on top as "Creation in progress" · **←** back to L2 |
| L4 | Pay by Link details | the **QR** icon by the URL opens "Scan the QR code" (**OK**, Esc or a tap outside closes it) · **Payment attempts** collapses · **←** back to L1 |

The form starts filled with Figma's example (Sherlock Holmes, order ORD-39858-GH) so it can be
clicked straight through; clear Order ID to see the error state. Sample links are dated
yesterday; their payment attempts are shown, not wired.

## Stage menu (for recording)

The ☰ in the window's top-left corner, outside the terminal, opens the stage settings.

- **Interface** switches between the **New** software (the Figma flows above) and the **Old**
  one. Old only changes the end of a payment: after Authorization it shows the old
  "Paiement sans contact accepte" screen, then "Ticket commerçant ?" (the eye opens the
  merchant receipt, **Fermer** starts a new sale). It applies from the next approval.
- **Background** has eight presets, including green and blue screen for keying, plus a
  custom colour picker or hex field.
- **Drop shadow** turns the terminal's shadow on or off.

Choices are remembered in this browser. The button fades out 3 s after the page opens so it
stays out of recordings; move the pointer into the top-left corner, or Tab to it, to bring
it back. Esc or a click outside closes the panel.

## Files

| Path | What |
|---|---|
| `index.html` | Markup for every screen, the menu and the stage menu |
| `app.js` | Navigation, timers and the logic of each flow; the payment screens are rendered from one template |
| `stage-menu.js` | Stage menu: interface, background and shadow, outside the terminal |
| `styles.css` | Layout at the design's native 720 × 1600, scaled to fit the window |
| `tokens.css` | Colour, type, radius, shadow and motion values read from Figma |
| `assets/` | Icons, artwork and animations exported from Figma |
| `serve.mjs` | Zero-dependency local server |
| `.design/` | Brief, flow map, task list and design review |

## Notes

- Lato (regular, italic, semibold, bold, heavy) and Roboto load from CDNs, so the prototype needs an internet connection to render with the right type.
- Tickets are set in Monaco in Figma (macOS only); elsewhere they fall back to Fira Mono.
- Animations are animated WebPs made from the designer's files: `assets/loader.webp` (Please wait, Card read, Authorization; lossless, from an MP4) and `assets/present-card.webp` (Present card; the tap-to-pay GIF, lossy, flattened on the white panel) loop; `assets/approved-banner.webp` (lossless, from an MP4) plays once each time Approved appears. With reduced motion on, a still frame shows instead.
- Keyboard: Tab moves through the controls and stays inside an open menu, sheet, dialog or ticket; Esc closes it. On Present card, focus lands on a hidden "Tap card" button, so Enter taps the card.
- Shown but not wired: the ⇄ icon and DEBIT / WITH TIPS chips on the keypad, the history's date-range chips and chart button, the daily summary's share icon, the settings other than Daily summary, and Support and About in the menu. Not covered: declined payments, tips and PIN entry.
