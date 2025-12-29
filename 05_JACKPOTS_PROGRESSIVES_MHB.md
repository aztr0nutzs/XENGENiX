# docs/05_JACKPOTS_PROGRESSIVES_MHB.md

# Jackpots: Progressive + Must-Hit-By (MHB) Concepts (Entertainment Simulation)

The guide covers:
- Progressive jackpots grow by a contribution % of each bet. :contentReference[oaicite:33]{index=33}
- Must-Hit-By (MHB): set a secret award point between reseed and max; can be biased toward max. :contentReference[oaicite:34]{index=34}

## Our Implementation (Entertainment Simulation)
We do NOT implement regulated casino progressive behavior. We implement:
- 4 meters: MINI, MINOR, MAJOR, GRAND
- Visual drift + contribution:
  - Each bet adds a small contribution to MINI/MINOR/MAJOR meters.
  - GRAND either static or very slow drift.
- Jackpot wins occur via jackpot orbs during Hold-and-Spin.

## Progressive Contribution (Simple)
On every spin:
- `mini += bet * miniRate`
- `minor += bet * minorRate`
- `major += bet * majorRate`
Rates are small and configurable.

## Must-Hit-By (Optional Mode)
If you enable MHB mode for (say) MINI:
- Define:
  - reseedValue
  - mustHitByValue
- Choose a secret hit point between them (optionally biased high). :contentReference[oaicite:35]{index=35}
- As meter grows, if it reaches hit point, award it (in our case: via a forced jackpot orb or a special event).

## Persistence
Store meters in DataStore so values persist between sessions.

## Safety/Clarity
- Use “tokens” not money terminology.
- Do not claim real-world odds or RTP.
