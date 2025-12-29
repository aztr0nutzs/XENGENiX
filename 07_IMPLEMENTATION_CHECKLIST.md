# docs/07_IMPLEMENTATION_CHECKLIST.md

# Implementation Checklist (AI Must Pass)

## Data
- [ ] Reel strips are explicit stop lists. :contentReference[oaicite:38]{index=38}
- [ ] Paylines are explicit patterns. :contentReference[oaicite:39]{index=39}
- [ ] Paytable exists and is used. :contentReference[oaicite:40]{index=40}
- [ ] ParSheet bundles reels + paytable and drives outcomes. :contentReference[oaicite:41]{index=41}

## RNG
- [ ] RNG is injectable
- [ ] Seeded mode is deterministic
- [ ] Tests validate determinism

## Spin pipeline
- [ ] Picks stop indices per reel via RNG. :contentReference[oaicite:42]{index=42}
- [ ] Evaluates all paylines for wins. :contentReference[oaicite:43]{index=43}
- [ ] Produces SpinOutcome object
- [ ] UI animates to chosen stops. :contentReference[oaicite:44]{index=44}

## Bonus & jackpots
- [ ] Hold-and-spin logic correct
- [ ] Jackpot meters implemented and displayed
- [ ] Contribution/drift logic works (optional MHB mode documented) :contentReference[oaicite:45]{index=45}

## Logging & recovery
- [ ] Session log exists
- [ ] “last result not seen” recovery implemented :contentReference[oaicite:46]{index=46}

## Tests
- [ ] Payline evaluation unit tests
- [ ] Bonus respin reset tests
- [ ] Jackpot award application tests
