# Review — Payment Terminal, Flow 2 (build v1, 2026-11-06)

Lens: `steve-jobs-design-review` (Phase 7), on the running build at http://localhost:5173.
Verified in the browser: element positions vs Figma, keypad logic, sequence timings,
Cancel Transaction, Approved → new sale, loader motion, fonts, console.

# Design Review: Payment Terminal · Flow 2 prototype
**Verdict:** NOT DONE for unguided testing — ready for a facilitated pilot (score 7/10, 5 of 7 diagnostic rows pass)
**The One Thing:** a participant types any amount, confirms, and watches the payment run to Approved with that amount, the Figma timings and the Figma motion.
**Keeps its promise?** Yes. Any amount from 0,01 to 99 999,99 € flows through all 7 screens; timings measured at 2.0 / 3.0 / 2.0 / 0.5 / 2.0 s; the loaders run the Figma keyframes, phase-locked across screens.
**Cut list:** nothing more to cut; the non-goals in the brief held.
**Fix list (ranked):**
1. ~~**Approved is a dead end for an unguided participant.**~~ **Fixed:** Approved now returns to a fresh sale after Figma's 2 s timer (measured 2.0 s), tap still returns at once.
2. **Fonts load from a CDN.** Without internet, Lato falls back to a system font and every measurement drifts. Fix direction: copy the three Lato files into `payment-terminal/fonts/` (one-time download, needs your OK).
3. **The Approved date/time is static** (05/08/26 AT 12:13:44), as designed and agreed. A participant may notice the wrong date. Fix direction: a live date is a one-line change if you want it.
4. **Inert controls** (☰, ⇄, DEBIT / AVEC POURBOIRES) do nothing when tapped, as agreed. Fix direction: put it in the test script.
**Back of the fence:**
- The coloured keys (✕ ← ✓) and CANCEL TRANSACTION have no pressed state in Figma; the build darkens them slightly on press (deviation, your call).
- On Amount Entry the Figma amount sits 5.5 px right of centre (frame at x92 in a 710 px sheet). Built as designed; it looks like an accident in the file.
- No declined path exists, so the prototype can't show what happens when payment fails. Out of scope for v1, but it's the first thing a real test will ask.

## Diagnostic
| Row | Pass |
|---|---|
| One Thing stated in a sentence | ✓ |
| Core value in ≤ 3 steps (type → ✓) | ✓ |
| Experienced cold, as a customer | ✓ (driven through real clicks) |
| Working demo on the target device (desktop browser) | ✓ |
| Something removed this cycle | ✓ (non-goals) |
| Error / edge states at hero quality | ✗ (Approved exit, no declined) |
| Team would sign it | ✗ pending your review |
