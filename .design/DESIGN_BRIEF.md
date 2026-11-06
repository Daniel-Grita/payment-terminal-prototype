# Design Brief — Payment Terminal, Flow 2 (interactive prototype)

**Source:** Figma file *Calculator* (`QECglsPSBmsCk9OykstnEc`), Page 1, prototype flow **Flow 2**
(start frame `2003:1852` — *Amount Entry / Default — 0,00€*).
**Date:** 2026-11-06 · **Status:** Approved

---

## Problem

Flow 2 exists as a Figma prototype, but it is faked: the amount is baked into each frame
(three duplicate Amount Entry frames step through a fixed 5,00 €), so a test participant
can only press the "right" keys. That makes it useless for unguided usability testing.

This is also a **proof of concept**: if rebuilding one Figma flow as a real interactive
app works, more flows will follow the same way.

## The One Thing

> A participant can type **any** amount on the keypad, confirm it, and watch the payment
> run through to Approved, with that amount and the Figma timings and motion intact.

## Audience & context

- **Who:** usability-test participants, unguided, with a facilitator watching.
- **Where:** desktop browser, terminal shown inside a phone frame, mouse input.
- **Language:** as designed (French/English bilingual terminal copy, € with comma decimals).

## In scope

1. **Amount Entry, real keypad logic**
   - Digits fill from the cents: `5` → 0,05 · `50` → 0,50 · `500` → 5,00 €.
   - **←** removes the last digit. **✕** clears to 0,00 €.
   - **✓** confirms. At 0,00 € it does not proceed (gentle feedback on the amount instead).
   - Upper limit on digits so the amount never overflows the layout.
2. **The automatic sequence, with Figma timings and transitions** (see `FLOW.md`).
3. **Present Card is a timed loading moment.** No customer action; it holds, then moves on.
4. **Cancel Transaction** on Present Card stops the sequence and returns to Amount Entry.
5. **Entered amount carried through every screen**, Approved included.
6. **Loader motion from Figma keyframes**, exact: ring rotates −360° / 2 s linear with an
   opacity pulse 0.3 → 0.8 → 0.3; the logo "breathes" at 90% → 100% → 90% scale with
   an opacity pulse 0.6 → 1 → 0.6.
7. **Faithful visuals**: layout, type, colour and artwork matched to the Figma frames.

## Non-goals (said no to, for this version)

- Other flows, a declined/error path, tip entry, PIN entry, card-method choice.
- Physical-keyboard input, the ☰ menu, the ⇄ button, and the DEBIT / AVEC POURBOIRES
  chips (shown as designed, inert).
- Real-device / touch install.
- Live clock: the status-bar time and the Approved date/time stay as designed.
- Any real payment, network or card hardware.

## Decisions taken by default (flag if wrong)

| # | Decision | Why |
|---|---|---|
| D1 | **Approved auto-returns** to a fresh 0,00 € sale after 2 s (dissolve 300 ms ease-out), using Figma's own timer on Approved, which had no destination. Tapping returns immediately. (Changed 2026-11-06 from "hold until tap" so unguided participants never get stuck.) | No dead end for an unguided participant; timing stays the designer's. |
| D2 | **Cancel Transaction resets the amount** to 0,00 €. | Matches how a cancelled sale behaves on a real terminal. |
| D3 | **Tip line on Approved is hidden.** Figma shows "(POURBOIRE / TIP 1,00 €)", but no tip can be entered in this flow. | Showing a tip nobody entered would mislead the test. |
| D4 | **Card brand on Approved stays CB**, as designed. | No card-method choice in scope. |
| D5 | **✓ at 0,00 €** shakes the amount briefly and stays put. | Feedback without inventing a new error screen. |
| D6 | **Max 7 digits** (99 999,99 €). | Keeps the 96 px amount on one line in the 720 px frame. |

## Resolved

- **Present Card stays static**, as designed in Figma, held for 3 s. (Decided 2026-11-06.)

## Risks for usability testing

- Inert controls (☰, ⇄, the two chips) will get tapped and do nothing. Note it in the
  test script so the facilitator can say these are out of scope.
- A ~9.5 s automatic sequence can feel long on a desktop. We keep the Figma timings;
  any change is a design decision for later.

## Skills used per phase

Brief/flow written by hand (`design-brief`, `information-architecture` not installed).
Build: `build-design`, `frontend-design`, `microinteractions`, `full-output-enforcement`.
Review: `better-interface`, `ux-heuristics`, `design-everyday-things`, `better-accessibility`,
`steve-jobs-design-review`, `break` / `state-machine` for the states.
