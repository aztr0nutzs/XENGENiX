# docs/02_RNG_AND_SECURITY_MODEL.md

# RNG & Security Model (Android Entertainment Build)

## RNG Selection Guidance
The referenced slot programming guide distinguishes:
- For games without money at stake: language/runtime RNG is “good enough.” :contentReference[oaicite:20]{index=20}
- For real-money: use a cryptographically secure PRNG (CSPRNG). :contentReference[oaicite:21]{index=21}

## Our Context
This is an **offline entertainment simulation**. Use a clean RNG interface that supports:
- A **seedable PRNG** for determinism in tests (required).
- A “production” RNG implementation that can use Kotlin/Java standard RNG.
- Optionally, a “secure RNG” adapter (SecureRandom) for future expansion. :contentReference[oaicite:22]{index=22}

## RNG Interface Contract
Implement:
- `nextInt(bound: Int): Int`
- `nextLong(): Long` (optional)
- Must be injectable into spin generation and bonus simulation.

## Determinism
When a seed is set:
- Same seed + same inputs = identical stops + identical outcomes.
- Add tests validating identical sequences of results.

## Client vs Server Note
The guide explains:
- If real money is involved, RNG + balance math must be on the server for security; client-only is a risk. :contentReference[oaicite:23]{index=23}
- If no money is involved, client-side logic is fine. :contentReference[oaicite:24]{index=24}

We are **client-only** because this is not a real-money product.
