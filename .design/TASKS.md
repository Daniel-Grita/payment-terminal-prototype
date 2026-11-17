# Tasks — Payment Terminal, Flow 2

Ordered risk-first: the screen-scaling and the state machine carry the whole prototype,
so they go first; visuals hang off them.

- [x] T0 Extract values + artwork from Figma → `tokens.css`, `assets/`
- [x] T1 Shell: phone frame on a neutral stage, 720×1600 screen scaled to fit the window
- [x] T2 State machine: 7 states, timers, transitions (dissolve / instant), cancel, reset (FLOW.md)
- [x] T3 Amount Entry: app bar, chips, amount, keypad with real logic (D5, D6) and pressed state
- [x] T4 Shared transaction header: name, DEBIT, LEDs (S3), CB (S6), date + CB mark (S7), amount
- [x] T5 Loader: ring + logo keyframes, phase-locked across S2/S4/S5/S6, reduced-motion
- [x] T6 Present Card: prompt, scheme strip, terminal art, CANCEL TRANSACTION
- [x] T7 Approved: banner gradient, check disc, CB logo, tap to start a new sale (D1)
- [x] T8 Accessibility basics: real buttons, live region announcing each state
- [x] T9 Compare every state against its Figma frame; fix mismatches (all within 1px)
- [x] T10 Review loop (Phase 7) → fix list in REVIEW.md

## Fix list from review
- [x] F1 Approved exit: auto-return after Figma's 2 s timer, tap still works
- [ ] F2 Vendor Lato locally so tests work offline
- [ ] F3 (optional) Live date/time on Approved

## Alipay QR payments — open issues (review of 2026-11-17)

Left as they are on purpose for now; to be taken care of later. From the security audit,
code review and critic review of the Alipay QR flow (critic score 7/10, target 8).

- [ ] A1 Transaction history is partly French: day headers ("16 NOVEMBRE 2026", "17 JANVIER 2025"),
      "TOTAL DES TRANSACTIONS", the period line ("16 jan 2025 → 18 jan 2025"). An Alipay or card
      sale made in the prototype adds a French day header. Translate to English.
- [ ] A2 History "TODAY" chip shows a 16–18 Jan 2025 range while the list holds sales made today.
- [ ] A3 Timestamps disagree across one sale: Approved/Receipt header 05/08/26 at 12:13:44, ticket
      18/11/25 - 17:12:50, details the real time of the sale, status bar 16:25. Use one timestamp.
- [ ] A4 Details say "Bank authorization not requested" while the ticket prints AUTHORIZATION: 777122.
- [ ] A5 Details of a new sale: file collection date (14/11/2025) is before the operation date, and
      the merchant account reads "CB Contact - …" even for an Alipay sale.
- [ ] A6 Alipay ticket keeps card-only lines from Figma 5987:4788 (BANK CARD, CONTACTLESS, the
      Mastercard AID A0000000041010, a masked PAN). Check with the designer.
- [ ] A7 Screen titles "Transaction's History" / "Transactions' Details" are inconsistent; use
      "Transaction history" / "Transaction details".
- [ ] A8 The Alipay QR code is traced from the Figma image and holds a real-looking Alipay payment
      token ("281666040091jBMF6HaJ1zSv9N31cc06G19k"), not a link. Replace it with a QR that only
      reads "PayXpress demo" so participants who scan it get nothing real.
- [ ] A9 Ticket overlay is see-through (60% black) where the Figma frame looks opaque grey, and its
      CLOSE button is black (a 2026-11-11 request) where Figma has dark grey. Confirm which is wanted.
- [ ] A10 Present Card art: in the looping animation the card can touch the terminal's top edge;
      in Figma 5991:16356 it floats apart.
- [ ] A11 "Scan customer's QR code" (Figma "Scanner depuis l'acheteur") is shown but not wired:
      Figma has no screen for customer-presented codes.
- [ ] A12 WeChat Pay looks exactly like Alipay but does nothing; consider a disabled look or a
      "Not accepted" message.
