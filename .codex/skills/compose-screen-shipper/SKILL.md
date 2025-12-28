---
name: compose-screen-shipper
description: Generate or refactor Jetpack Compose screens from short specs or existing files, wire Navigation Compose routes/args/deep links, and connect MVVM + UiState + events with previews and strings. Use when adding or updating Compose UI, integrating new screens into NavGraph, or aligning Compose screens with existing theme/resources while preserving behavior.
---

# Compose Screen Shipper

## Overview
Ship new or refactored Compose screens end-to-end: UI + MVVM + navigation + previews + resources + verification, without breaking existing flows.

## Workflow Decision Tree
- Architecture gate (must happen first): inspect `app/src/main/java/com/xenogenics/app/MainActivity.java` and determine whether UI is WebView/HTML, native Compose, or hybrid.
- If WebView-based, default to shipping screens as HTML/CSS/JS and wiring via WebView routes + JS bridge. Only add Compose if explicitly requested.
- If Compose is not present in the repo, stop and ask for guidance before introducing it.
- If the request is a new screen, implement screen + ViewModel/UiState/events (if needed) + navigation wiring.
- If the request is a refactor, preserve behavior and persistence keys; only change what the request requires.

## Workflow

### 1) Intake and Scope
- Parse the request for: screen name, user flow, routes/args, expected states, and UI actions.
- Confirm constraints from `references/project-standards.md`.

### 2) Repo Scan
- Read `references/repo-scan.md` and locate Compose, theme, and navigation patterns.
- If Compose or NavGraph patterns are missing, stop and ask for the expected architecture before adding new patterns.

### 3) Screen Implementation
- Build a single-purpose screen composable; keep UI state in a UiState class and handle events via callbacks or ViewModel.
- Avoid mutable state in composables unless it is explicitly local UI state (e.g., transient dialog visibility).
- Use `collectAsStateWithLifecycle()` when observing flows.

### 4) Navigation Wiring
- Add routes, arguments, and deep links using the repo's existing pattern.
- Integrate the new route into the current NavGraph without breaking existing back behavior.

### 5) Resources and Theme Compliance
- Add all user-visible strings to `strings.xml` and reference them via `stringResource`.
- Use existing theme tokens for colors, typography, spacing, and shape.
- Only add new theme tokens when the request explicitly needs them.

### 6) Previews
- Provide at least one preview per major screen state (loading/empty/content/error if applicable).
- Use fake state objects for previews only; do not introduce runtime stubs.

### 7) Verification
- Run the project build or tests (prefer `./gradlew :app:assembleDebug`) and fix issues until green.
- Report any remaining warnings with rationale.

### 8) Output
- Provide a concise change log with file paths touched and why.

## Guardrails and Quality Bar
- No placeholders, TODOs, or dead buttons.
- All visible controls are wired to events/callbacks.
- Do not add new dependencies without explicit justification.
- Do not change `applicationId` or package names.
- Do not delete existing routes or screens.
- Do not restyle unrelated screens.

## References
- `references/project-standards.md`
- `references/repo-scan.md`
- `references/navigation-patterns.md`
- `references/theme-map.md`
- `references/golden_screen_example.kt`

## Golden Path Pointers
- Entry point: `app/src/main/java/com/xenogenics/app/MainActivity.java`
- Web UI: `app/src/main/assets/www/index.html`, `app/src/main/assets/www/script.js`, `app/src/main/assets/www/style.css`
