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
| [Daily summary](#daily-summary-and-business-day-hours) | ☰ › Daily summary, ☰ › Settings | PayXpress manual ("Total journalier") |
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

No Figma frames: matched to the PayXpress manual's screenshots, using this prototype's components.

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
- Animations are lossless animated WebPs made from the designer's MP4s: `assets/loader.webp` (Please wait, Card read, Authorization) and `assets/present-card.webp` (Present card) loop; `assets/approved-banner.webp` plays once each time Approved appears. With reduced motion on, a still frame shows instead.
- Keyboard: Tab moves through the controls and stays inside an open menu, sheet, dialog or ticket; Esc closes it. On Present card, focus lands on a hidden "Tap card" button, so Enter taps the card.
- Shown but not wired: the ⇄ icon and DEBIT / WITH TIPS chips on the keypad, the history's date-range chips and chart button, the daily summary's share icon, the settings other than Daily summary, and Support and About in the menu. Not covered: declined payments, tips and PIN entry.
