# Archived Sound Feature (.sound-feature)

This directory preserves all sound assets, scripts, hooks, services, and tests for the Least Count card game.
Per release requirements, this feature is deactivated and excluded from the active deployment build.

## Directory Structure
- `public/sounds/`: WAV audio files for card actions (select, drop, draw, pick, shuffle, win, lose).
- `scripts/generate-sounds.js`: Audio synthesis script to regenerate high-fidelity procedural WAV files without external dependencies.
- `services/soundManager.ts`: Robust audio engine with HTML5 Audio and Web Audio API synthesizer fallbacks.
- `services/soundManager.test.ts.disabled`: Unit tests for audio verification and sound manager settings.
- `hooks/useGameSounds.ts`: React hook that listens to multiplayer and single-player game state transitions and triggers corresponding sound effects.
- `hooks/useGameSounds.test.ts.disabled`: Unit tests for game state sound transition triggers.

## How to Reactivate the Sound Feature
1. **Move files back into the active frontend tree**:
   ```bash
   # From project root
   mv .sound-feature/public/sounds frontend/public/sounds
   mv .sound-feature/scripts/generate-sounds.js frontend/scripts/generate-sounds.js
   mv .sound-feature/services/soundManager.ts frontend/src/services/soundManager.ts
   mv .sound-feature/services/soundManager.test.ts.disabled frontend/src/services/soundManager.test.ts
   mv .sound-feature/hooks/useGameSounds.ts frontend/src/hooks/useGameSounds.ts
   mv .sound-feature/hooks/useGameSounds.test.ts.disabled frontend/src/hooks/useGameSounds.test.ts
   ```

2. **Uncomment Sound Feature in Frontend**:
   - In `frontend/src/main.tsx`: Search for `[SOUND_FEATURE_DISABLED]` and uncomment imports, state, hook calls, and playback triggers.
   - In `frontend/src/pages/SettingsPage.tsx`: Search for `[SOUND_FEATURE_DISABLED]` and uncomment props and the `SOUND EFFECTS` `<select>` UI control.
