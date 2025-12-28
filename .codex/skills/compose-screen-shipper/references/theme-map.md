# Theme Map

## Current state
- No Compose theme files were found in this repo during the scan.
- Do not invent theme tokens unless the request explicitly requires them.

## How to locate theme tokens
Check for common Compose theme locations:
- `find app/src -type f -name "*Theme*.kt"`
- `find app/src -type f -path "*ui/theme*"`
- `grep -R "MaterialTheme" app/src`

If no theme files exist, ask the user how Compose theming should be handled.
