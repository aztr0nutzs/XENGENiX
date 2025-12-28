# Navigation Patterns

## Current state
- No Navigation Compose graph files were found during the initial scan.
- Do not introduce new navigation patterns unless the user confirms Compose is expected.

## How to locate existing patterns
Use these searches to discover routing conventions:
- `find app/src -type f -name "*.kt"`
- `grep -R "NavHost" app/src`
- `grep -R "composable(" app/src`
- `grep -R "navController" app/src`

## Integration rules
- Match the existing route naming convention exactly (sealed class, string routes, etc.).
- Preserve existing back behavior and route arguments.
- Add deep links only when explicitly requested.
