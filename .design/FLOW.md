# Flow map — Payment Terminal, Flow 2

Replaces the information-architecture phase: this is one linear flow, so the structure
is a state machine, not navigation. Timings and transitions are read from the Figma
prototype reactions.

## Update 2026-11-11 — "PayXpress Compose" › Payment Flow (New)

The flow now comes from Figma file `SgRqzQkSTAUxX8HAyYqgrp`, section `5987:4877`. Copy is in
English ("with tips", "Insert, swipe or tap your card", "Authorization / Please wait",
"Payment accepted"). Current sequence, which supersedes the tables below where they differ:

```
S1 amount-entry ─ ✓ ─ dissolve 300 ─▶ S2 please-wait ─ 2.0 s ─▶ S3 present-card
S3 present-card ─ CLICK the screen (was a timer; Figma now 5 s) ─ dissolve 800 ─▶ S4 card-read
   └─ CANCEL TRANSACTION ─▶ S1 (fresh sale)
S4 card-read ─ 1.0 s ─▶ S5 please-wait-2 ─ 0.8 s ─▶ S6 authorization ─ 2.0 s, instant ─▶ S7 approved
S7 approved ─ banner animation plays once, CB fades in ─ 2.0 s, dissolve 300 ─▶ S8 receipt
S8 receipt ─ "View receipt" row ─ fade 300 ease-in ─▶ S9 ticket overlay
   (Figma wires this to "Send by email"; moved to View receipt on request, 2026-11-11)
   └─ SKIP ─▶ S1 (not wired in Figma; added so the flow has no dead end)
S9 ticket ─ CLOSE (Figma "Back") ─▶ S8
```

Send by email, Scan QR code, Print, and the ticket's @ / print buttons are shown but inert,
as in Figma. The ticket's AMOUNT line shows the amount entered. On request, the ticket's
buttons have no outline and 20 px corners: @ and print are white, CLOSE is black (Figma has
grey-outlined 4 px buttons and a dark grey CLOSE). Sizes and positions are Figma's.

The white keypad sheet, transaction panel and history panel reach the screen's side edges
(Figma insets them 5 px). The grey gaps read as light lines against the black bezel,
running into the rounded bottom corners. Content keeps Figma's coordinates.

## Update 2026-11-11 — Transaction History flow

Figma file `SgRqzQkSTAUxX8HAyYqgrp`, section `5991:6705` "Transaction History" (flow start
`5991:10375`). It starts on the same amount-entry screen, so both flows share S1.

```
S1 amount-entry ─ ☰ ─ dissolve 50 ─▶ dimmed (25% black) ─ 0.2 s, move in 200 ease-in ─▶ H1 menu
H1 menu ─ Transaction's history ─ row selected, 0.2 s, Smart Animate 300 ease-in ─▶ H2 journal
   └─ Charge ─ same timing ─▶ S1       (added: Figma has no way back to S1)
   └─ tap outside ─▶ closes             (added)
H2 journal ─ filter icon ─ 300 ease-in ─▶ filters sheet
   filters ─ chips toggle (one per group) · APPLY FILTERS ─ 300 ease-in ─▶ H2 filtered, badge = active groups
           └─ CANCEL / tap outside ─▶ H2 unchanged · RESET clears the chips   (added)
H2 journal ─ row ─ 300 ease-in ─▶ H3 details   (Figma wires the 2nd row of the filtered list; every row works)
   └─ ☰ ─▶ H1 menu                              (added)
H3 details ─ share icon ─ 150 ease-in ─▶ "Editing a duplicate" sheet
   sheet ─ Customer copy ─ 300 ease-in ─▶ receipt ticket ─ CLOSE (Back) ─▶ sheet
         └─ Merchant copy ─▶ same ticket, "MERCHANT RECEIPT"   (added)
H3 details ─ ← ─▶ H2   (added)
```

Deviations, all so the prototype behaves like the product rather than a click-through:
- Filters really filter. Figma's filtered frame (5991:8424) still lists declined rows under
  ACCEPTER; here only accepted rows remain. Day totals are computed (20 × 15,00 € = 300,00 €,
  Figma shows 350,00 €). The badge counts active groups (Figma shows "1" for two picks).
- Approved sales from the payment flow are added to the list under today's date.
- Day headers collapse their rows; lists and chip rows scroll by mouse drag as well as the wheel.
- A picked scheme chip (logo only) gets a black ring, since its label can't turn ExtraBold.
- Motion added on request: the history rows cascade in (each 320 ms ease-out, rising 24 px,
  40 ms apart, visible rows only) when the list opens from the menu or after Apply filters,
  but not when coming back from details. Both bottom sheets slide up from the bottom edge
  (320 ms decelerate) as the backdrop fades in, and slide down to close (220 ms ease-in),
  instead of Figma's dissolve.

## States

| # | State | Figma frame | Header shows | Body |
|---|---|---|---|---|
| S1 | `amount-entry` | `2003:1852` Amount Entry / Default | ☰ · ORIGINATOR NAME · ⇄ | DEBIT / AVEC POURBOIRES chips, amount, keypad, ✕ ← ✓ |
| S2 | `please-wait` | `2003:2104` Please Wait — Alt Layout 2 | ORIGINATOR NAME · DEBIT | Amount · "PLEASE WAIT" · loader |
| S3 | `present-card` | `2003:2155` Present Card — Card Only | ORIGINATOR NAME · DEBIT · progress dots | Amount · "INSEREZ, PASSEZ OU PRÉSENTEZ VOTRE CARTE" · brand logos · terminal art · CANCEL TRANSACTION |
| S4 | `card-read` | `2003:2121` Please Wait — Alt Layout 3 | ORIGINATOR NAME · DEBIT | Amount · "CARD READ" · loader |
| S5 | `please-wait-2` | `2003:2138` Please Wait — Alt Layout 4 | ORIGINATOR NAME · DEBIT | Amount · "PLEASE WAIT" · loader |
| S6 | `authorization` | `2003:882` Processing / Authorization | ORIGINATOR NAME · DEBIT · CB | Amount · "AUTHORIZATION PLEASE WAIT / AUTHORISATION - PATIENTEZ" · loader |
| S7 | `approved` | `2003:670` Payment / Approved | ORIGINATOR NAME · DEBIT · date · CB mark | Amount · APPROVED / PAIEMENT ACCEPTÉ banner · CB logo |

## Transitions

```
S1 amount-entry
 │  ✓ pressed, amount > 0        → dissolve 300 ms ease-out
 ▼
S2 please-wait ── hold 2.0 s ──→ (instant)
 ▼
S3 present-card ── hold 3.0 s ──→ dissolve 800 ms ease-out
 │  └─ CANCEL TRANSACTION ──────→ S1 (amount reset)            [D2]
 ▼
S4 card-read ── hold 2.0 s ─────→ (instant)
 ▼
S5 please-wait-2 ── hold 0.5 s ─→ (instant)
 ▼
S6 authorization ── hold 2.0 s ─→ dissolve 300 ms ease-in-out
 ▼
S7 approved ── hold 2.0 s ──────→ dissolve 300 ms ease-out → S1 (fresh 0,00 €)   [D1]
 └─ tap anywhere ─────────────→ same, immediately
```

Total automatic run, ✓ to Approved: ~9.5 s + transitions; back at Amount Entry ~11.5 s.

## Amount Entry rules

| Input | At 0,00 € | With an amount |
|---|---|---|
| Digit 0–9 | 0 does nothing; 1–9 starts the amount | Appends (max 7 digits) [D6] |
| ← | No-op | Removes last digit |
| ✕ | No-op | Clears to 0,00 € |
| ✓ | Shake amount, stay [D5] | Go to S2 |

Format: French, comma decimal, superscript €, thousands with a narrow space (`12 345,67`).

## Motion (all four loader screens: S2, S4, S5, S6)

| Layer | Property | Keyframes (2 s loop) | Easing per segment |
|---|---|---|---|
| Ring ("Loader") | rotation | 0° → −360° | `cubic-bezier(.5,0,.5,1)` |
| Ring | opacity | 0.3 @0 → 0.8 @1 s → 0.3 @2 s | `(.5,0,.5,1)`, then ease-in-out |
| Logo | scale | 0.9 @0 → 1.0 @0.5 s → 0.9 @1.5 s → 0.9 @2 s | `(.5,0,.5,1)`, then ease-in-out |
| Logo | opacity | 0.6 @0 → 1.0 @0.5 s → 0.6 @1.5 s → 0.6 @2 s | `(.5,0,.5,1)`, then ease-in-out |

Figma stores easing on the keyframe that starts a segment, so the spin itself eases
in and out once per revolution (it is not a constant-speed spin).

**Since 2026-11-11 the build plays the designer's own animations instead of rebuilding
these keyframes in code:**

| Screen(s) | Asset | Source | Loop |
|---|---|---|---|
| S2, S4, S5, S6 | `assets/loader.webp` (94×94, shown at 170×170) | `Payment Animation.mp4`, frames 0–120 (two 2 s cycles; frame 121 matches frame 0) | seamless, 15 fps |
| S3 | `assets/present-card.webp` (528×436) | `POS Animation.mp4`, full 2.27 s: card moves in (~1 s), holds, restarts | 25 fps |

Both are cropped to their content, with near-white video noise (≥242) set to pure white
so they sit on the #ffffff panel without a visible box. Reduced motion shows a still frame.
All loader images share one file, so the browser keeps them in sync across S4 → S5 → S6.
