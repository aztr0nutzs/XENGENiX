# Performance Policies

## Non-negotiable rules
- No heavy work on the main thread.
- No unbounded animations or particle systems.
- No infinite coroutines or busy loops.
- Avoid bitmap churn and repeated allocations in hot paths.

## UI performance
- Limit recomposition triggers; prefer immutable state models.
- Use animation APIs appropriate for the UI framework.
- Throttle timers and effects to avoid jank on low-end devices.

## Low-end device guardrails
- Use lite-mode toggles if the project has them.
- Cap particle counts, blur/shader usage, and large transitions.
