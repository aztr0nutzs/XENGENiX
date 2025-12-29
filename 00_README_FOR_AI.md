# docs/00_README_FOR_AI.md

# Bio-Link Slot (Android) — AI Build Guide

## Purpose
Build an Android-native slot game whose **math/logic** is deterministic, testable, and properly structured — modeled after standard slot concepts: reels, stops, paylines, paytable, par sheet, RNG, RTP, and jackpots. :contentReference[oaicite:1]{index=1}

This guide **focuses on the math + logic**, because UI/graphics are separate workstreams. (The referenced article explicitly focuses on the math/logic and does not cover graphics/UI.) :contentReference[oaicite:2]{index=2}

## Core Principles (Do not violate)
1. **Reels are strips of “stops”** (not “weights” floating in the air). Each reel has a concrete list of stops; RNG selects a stop index. :contentReference[oaicite:3]{index=3}
2. **Paylines are explicit paths** across reels; each payline reads one symbol per reel. :contentReference[oaicite:4]{index=4}
3. **Paytable defines payouts**, and the reels + paytable (“par sheet”) determines RTP. :contentReference[oaicite:5]{index=5}
4. Implement **seedable PRNG** for tests; for real-money you’d need CSPRNG, but this is offline entertainment. Still, keep the interface pluggable. :contentReference[oaicite:6]{index=6}
5. Keep a strict separation:
   - Engine: RNG → stops → grid → evaluate wins → update state
   - UI: animations and rendering only

## Deliverables
- A playable slot with:
  - 5 reels x 3 rows base game
  - 50 paylines (explicit definitions)
  - Paytable (explicit)
  - Hold-and-Spin bonus (Fire Link style mechanic)
  - Jackpot meters (entertainment simulation)
- Tests:
  - RNG determinism
  - Payline win evaluation correctness
  - Bonus respin reset correctness
- Logging:
  - Record each spin outcome & win amount for debugging and RTP estimation (session-only is fine).

## Work Order (must follow)
1. Implement engine types (symbols, reels, paylines, paytable).
2. Implement RNG interface + seedable PRNG adapter.
3. Implement spin generation (select stop per reel).
4. Implement payline win evaluation.
5. Implement bonus trigger logic + bonus state machine.
6. Implement bonus simulation (respins, locked orbs, jackpots).
7. Add test harness and validation runs.
8. Wire UI last.

## “Slot Math” Vocabulary (must use consistently)
- Reels, Symbols, Stops, Paylines, Paytable, Par Sheet, RTP, RNG. :contentReference[oaicite:7]{index=7}
