# Integration Patterns

## Lobby integration
- Locate the lobby UI and add a new tile/card/button for the mode.
- Wire the launch action to existing navigation patterns.
- Preserve existing button behaviors and layout rules.

## Navigation wiring
- Match existing route naming conventions and argument patterns.
- Preserve back-stack behavior. Back returns to the expected previous screen.
- Only add deep links if explicitly requested.

## State management
- Follow the existing state model and persistence layer.
- Do not change storage keys unless explicitly requested.

## Golden path example
- If a correctly integrated mode already exists, use it as the pattern.
- If no such example exists, ask the user which mode is the reference implementation.
