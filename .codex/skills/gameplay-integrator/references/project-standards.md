# Project Standards

## Integration rules
- Add new gameplay modes without breaking existing modes.
- Register the mode in the lobby and wire launch flow.
- Preserve back-stack behavior; Back returns where users expect.

## Persistence rules
- Preserve selected character/piece set, difficulty/level/mode options.
- Preserve audio/vibration settings and accessibility options when present.
- Use the existing persistence approach (DataStore/SharedPrefs/Room).
- Never change persistence keys unless explicitly requested.

## Gameplay correctness
- Implement win/lose conditions, turn logic, input handling, pause/resume.
- Ensure game-over flow and restart/rematch work.
- No fake logic, TODOs, or placeholder rules.

## UI/UX correctness
- All visible controls are wired to callbacks/events.
- Do not restyle unrelated screens.

## Build and safety
- Do not add dependencies without explicit justification.
- Do not change `applicationId` or package names.
- Only modify files required for the request.
