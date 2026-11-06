# Flow map — Payment Terminal, Flow 2

Replaces the information-architecture phase: this is one linear flow, so the structure
is a state machine, not navigation. Timings and transitions are read from the Figma
prototype reactions.

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

The loader keeps running across S4 → S5 → S6 rather than restarting, so the instant
switches don't make it jump. Reduced motion: rotation and pulse stop; the text alone
carries the state.
