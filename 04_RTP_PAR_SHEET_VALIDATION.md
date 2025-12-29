# docs/04_RTP_PAR_SHEET_VALIDATION.md

# RTP / Par Sheet Validation (Dev & Test)

## Why this matters
The guide is explicit: the reel strips + paytable (“par sheet”) determine RTP. :contentReference[oaicite:31]{index=31}  
So we need dev tooling to:
- estimate session RTP
- verify engine correctness

## Two Validation Approaches

### A) Monte Carlo simulation (fast, practical)
- Run N simulated spins with a fixed seed (e.g., 1,000,000).
- Track:
  - total wagered
  - total returned
  - estimated RTP = returned / wagered
- Also track feature hit rate:
  - bonus triggers per 1000 spins
  - jackpot hits

### B) Full cycle enumeration (only feasible for tiny reels)
The guide describes cycle tests as a way to compute expected return for simple slots by iterating all stop combinations. :contentReference[oaicite:32]{index=32}  
For a 5x3 game with large reel strips, full enumeration is too large. Use Monte Carlo.

## Required Dev Panel Metrics
Show:
- spins
- wagered
- returned
- session RTP
- bonus hit count
- last 20 spin summaries
- current seed

## Acceptance
- Run simulation in debug builds only.
- Ensure the engine produces stable results under seeded RNG.
