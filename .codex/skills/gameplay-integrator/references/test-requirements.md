# Test Requirements

## Minimum coverage when tests are missing
- Add pure logic unit tests for:
  - win/lose detection
  - scoring rules
  - turn transitions or timer edge cases
- Avoid UI tests unless the project already has a UI test framework in use.

## Verification loop
- Run `./gradlew :app:assembleDebug` or the project's existing test command.
- Fix failing tests and rerun until green.
- Report any remaining warnings with rationale.
