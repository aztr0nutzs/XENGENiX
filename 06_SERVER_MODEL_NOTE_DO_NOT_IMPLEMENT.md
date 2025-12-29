# docs/06_SERVER_MODEL_NOTE_DO_NOT_IMPLEMENT.md

# Server-Based Model Notes (Do NOT implement for this build)

The guide describes a server-based slot architecture for real-money:
- token-based identity checks
- server verifies balance
- server generates stops via RNG
- server calculates wins
- server logs outcomes
- server updates balances, handles disconnect recovery flags :contentReference[oaicite:36]{index=36}

## For this project
Do NOT build a server. This is Android offline entertainment. However:
- Keep logging and state recovery patterns in mind:
  - If app pauses mid-spin animation, persist last SpinOutcome so UI can resume.
  - If user returns from background, show last result (like “not seen yet” flag concept). :contentReference[oaicite:37]{index=37}

## Required “Result Recovery”
Implement a small persistence record:
- lastSpinOutcome (serialized)
- lastSpinSeen boolean
On resume:
- if lastSpinSeen=false, replay the win display state and set true afterward.
