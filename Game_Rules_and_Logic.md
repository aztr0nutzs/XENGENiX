Core Concept

You’re not “winning prizes.” You’re running an illegal bio-lab extraction job. The Genetic Sequencer doesn’t hand you loot — it mutates the run. Every spin is a lab procedure with side effects.

You win by extracting a stable genome sample (your “payload”) out of the facility before contamination or alarms kill the run.

XENO-GENICS — Rules & Game Logic
Win Condition

Extract 1 Stable Genome Sample with:

Stability ≥ 100 at extraction time

Contamination < 100

Alarm < 100

If any meter hits 100 first → run fails (different failure types below).

The Three Meters (the whole game lives here)
1) Stability (0–150)

How “viable” the genome is. You need 100+ to extract successfully.

Goes up from correct sequencing decisions + good synth-organs

Goes down from bad mutations, certain anomalies, wrong neural linking

2) Contamination (0–100)

Biohazard level in the chamber.

As it rises, random negative effects trigger (below)

At 100: Containment Breach → run ends immediately

3) Alarm (0–100)

Facility response level.

Rises when you push the system too hard or trigger security-linked anomalies

At 100: Blacksite Lockdown → run ends immediately

These three meters make your wheel meaningful: every spin gives you power with a cost.

The “Sequencer” Wheel Outcomes (your current sectors become a rules engine)

Each sector outcome is a Procedure (not loot). It changes meters, grants a module, or starts an event.

A) MUTAGENS (high power, high contamination)

Mutagens always do:

Stability +X

Contamination +Y

Adds a Mutation Tag (used for combos)

Example Mutagen logic:

Cryo-Mutagen: K-Δ9

Stability +20

Contamination +10

Tag: CRYO

If you already have CRYO, it becomes “Overchill”: Alarm +8 (system strain)

Splice Agent: Helix-Rust

Stability +28

Contamination +18

Tag: RUST

20% chance: “Corruption Burst” Stability -12 (unless you have a Neural Link)

B) NEURAL LINKS (control + safety valves)

Neural Links let the player intervene in the next spin/event.

Neural Link always does:

Alarm -X (or prevents alarm rises)

Grants 1 Control Token (used to manipulate the wheel)

Control Tokens (choose 1 effect when used):

Re-route: re-spin once (must accept second result)

Bias: nudge result by ±1 sector (adjacent outcome)

Patch: cancel 1 negative event trigger (like contamination tick)

Neural Links are how skilled play happens: they reduce RNG without killing the wheel identity.

C) SYNTH-ORGANS (passive upgrades that change the rules)

Synth-organs install as permanent passives for the run. You can hold max 3.

Examples:

Synth-Heart: Pulse Forge

Every spin: Stability +3

If Alarm > 60: also Contamination +2 (heart runs “hot” under pressure)

Cyber-Gills: Deep Breather

Every time contamination rises: reduce that rise by 25% (rounded)

But Stability gains from Mutagens are reduced by 10% (tradeoff)

Bone Lattice: Titanium Lace

Prevent the first “critical failure” event

Alarm rises +10% from all sources (you’re detectable)

D) ANOMALY (rare chaos, run-defining)

Anomaly outcomes are dramatic. They force a hard choice.

Glitched Genome: ███-NULL

Immediately triggers a Choice Prompt:

Purge & Stabilize: Stability -15, Contamination -25, Alarm +10

Embrace the Null: Stability +35, Alarm +25, adds Tag NULL

If you ever hit Alarm ≥ 80 while holding NULL, it triggers “Sentinel Trace” (see events)

This makes anomalies “stories” instead of random punishments.

The Turn Loop (clean and repeatable)

Each run is broken into Cycles. A typical run is 8–14 cycles depending on choices.

Cycle Structure

Spin Sequencer

Apply Procedure result (Mutagen / Neural Link / Synth-Organ / Anomaly)

Trigger Phase (check contamination + alarm thresholds for events)

Action Phase (player chooses one action)

Decay Phase (meters drift based on your installed organs / tags)

Action Phase Options (this is where strategy lives)

Pick ONE per cycle:

Extract Attempt

Allowed only if Stability ≥ 100

Success if Contamination < 100 and Alarm < 100

If Stability ≥ 120, extraction reduces Alarm by 10 (clean exit)

Vent Chamber

Contamination -18

Alarm +8 (vents are monitored)

Ghost the Network

Alarm -15

Stability -6 (you slow the procedure)

Re-sequence (costs 1 Control Token)

Spin again immediately (stacking outcomes)

Adds Contamination +5 flat (overprocessing)

Synthesize Buffer

Stability +10

Contamination +7

If you have any Neural Link installed: Contamination +4 instead

That set gives you risk management decisions every cycle.

Threshold Events (automatic consequences)

These make the meters matter in a crunchy, gamey way.

Contamination Thresholds

≥ 30: “Spore Drift” → each cycle 10% chance: Stability -10

≥ 60: “Biofilm Bloom” → Mutagens give +5 extra Stability BUT +8 extra contamination

≥ 85: “Containment Fog” → Wheel becomes “sticker”: you can’t use Bias (±1) until Vent Chamber once

Alarm Thresholds

≥ 30: “Camera Sweep” → Ghost the Network becomes half effective (-8)

≥ 60: “Sentinel Warmup” → every spin adds Alarm +3 flat

≥ 80: “Trace Active” → if you have NULL tag, trigger Sentinel Trace:

Alarm +10 immediately

Next cycle your action choices are restricted (no Vent / no Buffer)

Combo System (the “skill ceiling”)

Outcomes add Tags: CRYO, RUST, NULL, NEURO, etc.
When certain tag combinations appear, you unlock special procedures.

Examples

CRYO + NEURO

“Cold Sync”: next Mutagen contamination reduced by 50%

RUST + RUST

“Oxidation Cascade”: Stability +20 immediately, but Alarm +15

NULL + any Synth-Organ

“Unlicensed Integration”: gain an extra organ slot (max 4), but Alarm +8 every cycle

Combos create “builds” inside a wheel game, which is what makes it feel like a real roguelite.

Failure Types (so losing feels themed, not generic)

If a meter hits 100:

Contamination 100 → Containment Breach

Run ends, you lose sample, but you keep any “data fragments” collected (meta progression)

Alarm 100 → Blacksite Lockdown

Run ends, you lose all rewards, but unlock “Lockdown Intel” (future runs start with -10 alarm)

Stability hits 0 (optional rule) → Genome Collapse

Run ends, but you unlock “Collapsed Strain” (new anomaly sector appears next runs)

Meta Progression (keeps players returning)

Even in a pure web prototype, you want persistence.
After each run, grant Gene Credits based on:

Max Stability achieved

Whether you extracted

How many combos triggered

How close you were to failure (risk bonus)

Spend Gene Credits on:

Add a new sector into wheel pool (more variety)

Upgrade control tokens (start each run with 1)

Unlock new Synth-Organs

Modify starting meters (e.g., start with Alarm -10)

Step-by-step: how this uses your current UI/gameplay cleanly

Your wheel spin already produces a “result” string.

That result maps to a Procedure object with effects: meter changes + tags + passives.

After procedure, you run a Trigger Phase (threshold checks).

Then player chooses one Action Phase option.

Repeat cycles until extract or fail.

Your “System Log” becomes the narrative feed of all these rules.

This converts the sequencer from “random prize wheel” into a proper tactical system.

Alternative rule variants (pick your poison)
Variant A — “Extraction Timer”

Instead of fixed cycles, you have a Countdown: 12 minutes.

Each cycle costs 1 minute

Vent costs 2 minutes

Re-sequence costs 2 minutes
Adds pressure without changing your wheel.

Variant B — “Contract Objectives”

Each run has 2 objectives drawn from a pool:

“Extract with Alarm < 50”

“Use 2 Mutagens”

“Install 2 Synth-Organs”

“Trigger a combo”
Makes runs feel structured.

Variant C — “Rivals”

At Alarm ≥ 60, a rival runner can “steal” stability:

Every cycle, Stability -4 unless you Ghost the Network
Adds adversarial flavor with minimal complexity.

Practical action plan (immediate)

Implement the three meters: stability, contamination, alarm

Add cycleCount and maxCycles (start at 12)

Create a mapping table: sector → Procedure (type + effects + tags)

After spin:

apply procedure

check thresholds → add event effects

Add the Action Phase buttons (Extract / Vent / Ghost / Buffer / Re-sequence)

Add tags + combo checks as a second pass (small and powerful)

If you want it to feel insanely good, the “glitch transition” should fire on:

spin start

wheel stop

anomaly choice prompt

extraction attempt

