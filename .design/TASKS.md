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
