# Payment Terminal — Flow 2 prototype

An interactive, code-built version of a payment-terminal flow designed in Figma.
Unlike the Figma prototype, the keypad is real: type any amount, confirm, and the
payment runs through to **Approved** with that amount, using the original Figma
timings, transitions and loader animation.

Built for usability testing in a desktop browser, with the terminal shown in a phone frame.

## Run it

Needs [Node.js](https://nodejs.org) (no install step, no dependencies).

```bash
node serve.mjs
```

Then open <http://localhost:5173>.

## The flow

| # | Screen | Moves on |
|---|---|---|
| 1 | Amount entry | ✓ with an amount (dissolve 300 ms) |
| 2 | Please wait | after 2 s |
| 3 | Present card | after 3 s (dissolve 800 ms) · **Cancel transaction** returns to 1 |
| 4 | Card read | after 2 s |
| 5 | Please wait | after 0.5 s |
| 6 | Authorization | after 2 s (dissolve 300 ms) |
| 7 | Approved | after 2 s, or tap, back to a fresh sale |

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
- The Present Card terminal drawing is an animated GIF in Figma. Drop it in as `assets/terminal-illustration.gif` and it plays; until then the static frame is shown.
- Non-goals for this version: other flows, declined path, tips, PIN, keyboard input. The ☰, ⇄ and chip controls are shown but inert.
