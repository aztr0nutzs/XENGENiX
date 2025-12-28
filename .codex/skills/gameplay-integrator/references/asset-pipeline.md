# Asset Pipeline Rules

## General rules
- Map every visual and audio to a real asset file.
- Keep assets in the correct pipeline: `res/drawable`, `res/raw`, or `app/src/main/assets`.
- Avoid mystery files; name assets clearly and consistently.
- Use optimized formats: vectors for icons, PNG/WebP for sprites/backgrounds, and compressed audio for SFX/music.

## Integration steps
1. Add assets to the correct directory with consistent naming.
2. Reference assets through the existing code pattern.
3. Verify scaling and alignment on multiple screen sizes.

## Performance notes
- Avoid oversized PNGs.
- Do not decode or transform large bitmaps on the UI thread.
