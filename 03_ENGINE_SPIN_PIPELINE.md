# docs/03_ENGINE_SPIN_PIPELINE.md

# Engine Spin Pipeline (Must Implement Exactly)

The referenced guide’s core steps for a client-based slot are:

1) Pick a random stop for reel 1 (random between 1 and number of stops). :contentReference[oaicite:25]{index=25}  
2) Repeat for all reels. :contentReference[oaicite:26]{index=26}  
3) Loop paylines and compute win amounts based on paytable. :contentReference[oaicite:27]{index=27}  
4) Animate reels to those stops. :contentReference[oaicite:28]{index=28}  
5) Notify/display win. :contentReference[oaicite:29]{index=29}  

## Our Android Implementation (Engine vs UI)
### Engine responsibilities
- Validate bet vs credits.
- Deduct bet.
- Generate 5 stop indices using RNG.
- Construct the 5x3 window (grid).
- Evaluate paylines and scatters.
- Apply payouts to credits.
- Decide if bonus triggers (orb count threshold).
- Produce a single “SpinOutcome” object:
  - stops
  - grid
  - line wins list
  - total win
  - flags: triggered bonus? scatter count? orb count?

### UI responsibilities
- Render and animate the reels to the exact stop indices.
- Highlight paylines that won.
- Show total win meter.
- Transition to bonus if triggered.

## Engine Output Contract (SpinOutcome)
Minimum fields:
- `reelStops: IntArray(5)`
- `grid: Array<Array<Symbol>>` (or equivalent)
- `lineWins: List<LineWin>` (lineIndex, symbol, count, payout)
- `scatterWin: Long` (optional)
- `totalWin: Long`
- `orbCount: Int`
- `triggerBonus: Boolean`
- `debug: Map<String, Any>` (optional)

## Logging
The guide recommends logging for verification and troubleshooting (and regulators in real money contexts). :contentReference[oaicite:30]{index=30}  
We must log at least session-level:
- wager amount
- outcome
- win
- bonus entry/exit
