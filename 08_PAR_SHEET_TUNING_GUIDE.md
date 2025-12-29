# docs/08_PAR_SHEET_TUNING_GUIDE.md

# Par Sheet Tuning Guide (Reels + Paytable → “Feel” + Hit Rates)

This file teaches the AI **how to tune** the slot’s *math layer* (reel strips, paylines, paytable, and feature spawning) to hit a target **game feel**: frequent small hits, occasional teases, rare bonuses, and mythic jackpots—without inventing fake “manufacturer RTP.”

The Easy.Vegas article is clear that the **par sheet (reel strips + paytable)** is the blueprint that determines the expected return and overall behavior. :contentReference[oaicite:0]{index=0}  
It also emphasizes that the article is about **math/gameplay** rather than graphics/UI. :contentReference[oaicite:1]{index=1}

---

## 1) What “Tuning” Actually Means

### Your tuning knobs
1. **Reel strips (stops)**
   - A reel is a list of “stops,” and symbols are weighted by how often they appear in that list. :contentReference[oaicite:2]{index=2}
2. **Paytable**
   - Defines which symbol combos pay how much. :contentReference[oaicite:3]{index=3}
3. **Paylines**
   - Explicit paths that select one symbol per reel and determine wins. :contentReference[oaicite:4]{index=4}
4. **Feature rules**
   - In our build, ORBs trigger Hold-and-Spin; this is not in the article specifically, but is standard modern “bonus feature” design.

### What not to do
- Do **not** claim an exact RTP unless you calculate/estimate it.
- Do **not** “boost wins” secretly. The entire point is that the par sheet defines behavior. :contentReference[oaicite:5]{index=5}

---

## 2) Baseline Targets (Recommended Defaults)

These are “feel targets” (not legal/regulated targets):

- **Base hit frequency (any win):** 25%–40% of spins
- **Meaningful win frequency:** 8%–15% of spins
- **Bonus trigger rate:** ~1 per 120–250 spins (adjustable)
- **Jackpot hit rates (inside bonus):**
  - Mini: common-ish (but still rare)
  - Minor: rare
  - Major: very rare
  - Grand: mythic

Why this works: it keeps engagement and “tease” without turning the game into a win-fountain.

---

## 3) How Reel Strip Weighting Controls Outcomes

Easy.Vegas explains:
- Reels have many **stops**, and fewer **unique symbols**, and RNG chooses a stop index. :contentReference[oaicite:6]{index=6}  
So symbol weighting is primarily: **more occurrences on the strip = more frequent landing.**

### Practical tuning rules
- Low symbols should dominate the strips.
- High symbols appear less often.
- Wild should be rare.
- Scatter should be rarer than wild (unless you want scatter payouts more frequently).
- ORBs are best handled by a **controlled injection pass** (recommended) rather than stuffing ORBs into strips, so bonus frequency doesn’t explode.

---

## 4) Paytable Shaping (Small Frequent Hits vs Big Spikes)

Easy.Vegas defines the paytable as the table that determines payouts. :contentReference[oaicite:7]{index=7}

### If the game feels too “dead”
- Increase low-symbol 3-of-a-kind payouts slightly (or)
- Increase low-symbol occurrences on reel strips
- Add modest wild presence (careful: wild inflates hit frequency a lot)

### If the game feels too “loose”
- Reduce low-symbol 3-of-a-kind payouts
- Reduce wild frequency
- Reduce the number of paylines (but we prefer keeping 50 and tuning strips/pays)

### If wins are too “flat” (boring)
- Lower frequent payouts slightly
- Increase rare high-symbol payouts so big hits feel exciting
- Ensure there’s a visible distribution: many small, fewer medium, rare big

---

## 5) Paylines: What They Affect

Paylines are paths across reels, selecting one symbol per reel. :contentReference[oaicite:8]{index=8}  
More paylines generally means:
- More chances to “hit something”
- Smaller individual line bets if total bet is fixed

### Tuning advice
- Keep 50 paylines (your cabinet vibe is “50 lines”)
- Tune by adjusting:
  - bet-per-line calculation
  - paytable values
  - reel strip weights

---

## 6) Feature Frequency Tuning (ORB Triggering)

The Easy.Vegas article covers the general “spin = stop indices = evaluate paylines” pipeline. :contentReference[oaicite:9]{index=9}  
Modern features aren’t directly specified there, so we implement them explicitly and tune them with a measured approach.

### Recommended approach: ORB injection pass
After generating the 5x3 grid from reel stops:
1. Compute bet tier (0–4) based on total bet.
2. Compute per-cell ORB probability `p`.
3. Replace only normal symbols (never replace WILD/SCATTER).
4. Count ORBs; if >=6, trigger bonus.

#### If bonus triggers too often
- Reduce `p`
- Reduce max ORBs per base spin
- Increase threshold from 6→7 (last resort; changes feel)

#### If bonus triggers too rarely
- Increase `p` slightly
- Add “pity” ramp: increase `p` after X dead spins (documented, visible in dev panel)

**Important:** Document pity logic transparently in dev panel. Do not hide it.

---

## 7) Bonus Round Tuning (Hold-and-Spin)

Hold-and-spin is tuned with:
- Empty-cell fill probability per respin
- Max new orbs per respin
- Value distribution weights
- Jackpot orb chance

### If bonus ends too quickly (unsatisfying)
- Increase empty-cell fill probabilities slightly
- Increase max new orbs per respin from 3 → 4
- Slightly increase chance of low-value orb hits so respins reset occasionally

### If bonus lasts too long (drags)
- Reduce fill probabilities
- Lower max new orbs per respin
- Ensure respins decrement properly when no new orb lands

### If bonus pays too small (feels pointless)
- Increase mid-range orb values (20/25/30/40 weights)
- Increase chance of landing multiple orbs in one respin (cap still needed)

### If bonus pays too big too often (breaks balance)
- Reduce 100/125/150/1000 weights
- Reduce jackpot orb spawn rate

---

## 8) Estimating “Session RTP” (Dev Mode Only)

Easy.Vegas notes RTP/payback is the long-run return and is determined by reels + paytable. :contentReference[oaicite:10]{index=10}  
We will not claim regulated RTP. We will estimate:

### Monte Carlo estimate
Run N spins (e.g., 100,000 or 1,000,000) in a debug-only simulator:
- total wagered
- total returned
- estimated RTP = returned / wagered

Track also:
- hit frequency
- bonus frequency
- jackpot hit counts

### Why we do this
- Detect math bugs
- Tune feel deliberately
- Avoid “confidence-based nonsense”

---

## 9) A Safe, Repeatable Tuning Workflow (Do This, Not Vibes)

1) **Lock** a seed and a par sheet version.
2) Run 100k spin sim → record baseline:
   - RTP estimate
   - hit rate
   - bonus rate
3) Change **one knob only**:
   - one reel strip symbol frequency, OR
   - one paytable value band, OR
   - orb injection probability curve
4) Re-run sim and compare deltas.
5) Keep a `docs/TUNING_LOG.md` with:
   - change
   - rationale
   - before/after metrics

---

## 10) Common Pitfalls (That AI Agents Love Doing)

- **Mistaking “weights” for reel stops.** Reels must be concrete stop lists. :contentReference[oaicite:11]{index=11}
- **Letting ORBs replace wilds/scatters.** This changes math drastically and makes behavior chaotic.
- **Overusing wilds.** Wilds explode win frequency.
- **No determinism.** Without seedable RNG, you can’t debug or test properly. :contentReference[oaicite:12]{index=12}
- **Claiming exact RTP.** Unless you’ve computed/estimated it with a simulator, don’t claim it.

---

## 11) Where the Code Should Be Tuned (File Map)

- `engine/ReelStrips.kt`  
  Adjust symbol frequency by adding/removing occurrences (stops). :contentReference[oaicite:13]{index=13}
- `engine/Paytable.kt`  
  Adjust payout ladder.
- `engine/PaylineDefinitions.kt`  
  Keep stable (50 lines). Only change if you intentionally redesign.
- `engine/SpinGenerator.kt`  
  Grid window logic + orb injection (if used).
- `engine/BonusFirelink.kt`  
  Respin fill curve, value weights, jackpot spawn rates.
- `viewmodel/GameViewModel.kt`  
  Ensure state machine transitions are correct; do not embed math tweaks here.

---

## 12) Minimal Acceptance Targets (Before You Call It “Good”)

- Engine passes determinism + evaluation tests.
- Base game:
  - frequent small wins exist
  - dead stretches exist but aren’t absurd
- Bonus:
  - triggers rarely but not never
  - lasts long enough to be fun (average 6–15 orb placements total)
- Jackpot:
  - mini occasionally; grand nearly never
- No “magic payouts.” Everything comes from par sheet + feature rules. :contentReference[oaicite:14]{index=14}
