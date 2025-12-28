# Repo Scan Snapshot (XENGENiX)

## Observed structure
- `app/src/main/java/com/xenogenics/app/MainActivity.java` exists.
- `app/src/main/assets/www/` contains the HTML/CSS/JS app.
- No Kotlin or Compose files were found at time of scan.

## Implications
- This project appears to be a WebView-based game.
- If a request requires native Compose/Navigation/VMs, confirm with the user before adding new architecture or dependencies.

## How to re-scan
- `find app/src -type f -name "*.kt"`
- `find app/src -type f -name "*.java"`
- `grep -R "NavHost" app/src` (fallback if `rg` is unavailable)
