# Payment Terminal — Flow 2 prototype

An interactive, code-built version of a payment-terminal flow designed in Figma.
Unlike the Figma prototype, the keypad is real: type any amount, confirm, and the
payment runs through to **Approved** with that amount, using the original Figma
timings, transitions and loader animation.

Built for usability testing in a desktop browser, with the screen shown inside a
Sunmi P3 terminal (`assets/terminal-device.webp`), camera notch included.

## Run it

Needs [Node.js](https://nodejs.org) (no install step, no dependencies).

```bash
node serve.mjs
```

Then open <http://localhost:5173>.

## The flow

Source: Figma "PayXpress Compose" › Payment Flow (New).

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

**Keypad:** digits fill from the cents (5 → 0,05 → 0,50 → 5,00 €), ← deletes,
✕ clears, ✓ at 0,00 € shakes the amount. Maximum 99 999,99 €.

## Files

| Path | What |
|---|---|
| `index.html` | Amount-entry screen markup |
| `app.js` | State machine, timers, keypad logic, transaction screens, loader motion |
| `styles.css` | Layout, at the design's native 720 × 1600, scaled to fit the window |
| `tokens.css` | Colour, type, radius, shadow and motion values read from Figma |
| `assets/` | Icons and artwork exported from Figma |
| `serve.mjs` | Zero-dependency local server |
| `.design/` | Brief, flow map, task list and design review |

## Notes

- Lato (400 / 600 / 800) and Roboto load from CDNs, so the prototype needs an internet connection to render with the right type.
- Animations are GIFs made from the designer's MP4s: `assets/loader.gif` (Please wait, Card read, Authorization) and `assets/present-card.gif` (Present card) loop; `assets/approved-banner.gif` plays once each time Approved appears. With reduced motion on, a still frame shows instead.
- The ticket is set in Monaco in Figma (macOS only); elsewhere it falls back to Fira Mono.
- Non-goals for this version: other flows, declined path, tips, PIN, keyboard input. The ☰, ⇄ and chip controls are shown but inert.
