# Project Standards

## Mandatory behavior
- Use MVVM with a single source of truth for UI state.
- No hardcoded user-visible strings; add them to `strings.xml`.
- No new dependencies without justification.
- Do not change `applicationId` or package names.
- Do not delete existing screens or routes.
- Only modify files directly required for the request.
- Do not restyle unrelated screens.
- Any new UI element must be wired to a real callback/event.

## Compose quality bar
- No placeholders, TODOs, or dead buttons.
- Avoid recomposition traps; no mutable state in composables unless explicitly local UI state.
- Use `collectAsStateWithLifecycle()` for ViewModel state flows.
- Add previews for each major screen state (loading/empty/content/error if applicable).
- Use existing theme tokens for colors, typography, and spacing.

## Existing app guidance
- `app/src/main/GUIDELINES.MD` defines the current web UI style rules for the in-app WebView.
- Treat those as app-level theming constraints when editing web assets; do not apply them to Compose unless directed.
