# docs/01_SLOT_TERMS_AND_DATA_MODEL.md

# Slot Terms & Data Model (Engine Contract)

This section defines the exact terms and how the code must represent them.

## Terms
- **Reel**: the vertical spinning column; modern slots commonly use five reels. :contentReference[oaicite:8]{index=8}
- **Symbol**: a picture on the reel; payouts depend on symbol combinations. :contentReference[oaicite:9]{index=9}
- **Stop**: a specific position on the reel strip; reels have many stops but fewer unique symbols. RNG chooses a stop index. :contentReference[oaicite:10]{index=10}
- **Payline**: a left-to-right path through one symbol on each reel. :contentReference[oaicite:11]{index=11}
- **Paytable**: defines what each symbol combo pays. :contentReference[oaicite:12]{index=12}
- **Par Sheet**: the blueprint (reel strips + paytable) that determines RTP. :contentReference[oaicite:13]{index=13}
- **RTP (Payback)**: long-run expected return; controlled by the par sheet. :contentReference[oaicite:14]{index=14}
- **RNG / PRNG**: picks random stops; in computer games it’s typically pseudo-random. :contentReference[oaicite:15]{index=15}

## Data Model Requirements (Android/Kotlin)
Implement these as immutable data types:

### Symbol
- Enum of all symbols.
- Include categories:
  - Low symbols (A,K,Q,J,10,9)
  - High symbols (theme)
  - Special: WILD, SCATTER, ORB

### ReelStrip
- `List<Symbol>` where each entry is a stop.
- “Weighting” is achieved by repeating symbols more times in the list. :contentReference[oaicite:16]{index=16}

### Stops
- A `StopIndex` per reel is an integer 0..(strip.size-1).
- A spin result is 5 stop indices, one per reel. :contentReference[oaicite:17]{index=17}

### Window / Grid
- For a 5x3 slot:
  - Each reel shows 3 consecutive stops (centered around stop index) OR
  - Use a simplified model where stop index maps to the middle row and top/bottom are adjacent indices (wrap-around).
- MUST be deterministic and documented.

### Paylines
- Store as list of int arrays, each length 5, values in {0,1,2} for row selection across the reels. :contentReference[oaicite:18]{index=18}

### Paytable
- Define payouts for 3/4/5-of-a-kind on lines (and optional scatter-anywhere pays).

### ParSheet (Config)
- A single object that bundles:
  - Reel strips
  - Paylines
  - Paytable
- This is the “blueprint” determining RTP. :contentReference[oaicite:19]{index=19}
