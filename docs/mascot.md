# CallCanary mascot

Asset: `public/mascot.png`. Generated using the built-in image-generation tool with the user's masked yellow canary image as the edit target. Transparent PNG; no notebook-paper background. The alert animates the whole character when audio playback starts and stops. It does not provide phoneme-level lip sync.

Prompt used:

> Edit the attached image into a clean transparent-background website mascot cutout. Preserve the exact character identity: round golden-yellow canary, black knitted balaclava with rectangular yellow eye opening, stern small black eyes and orange beak, raised yellow wings and tiny black feet. Preserve hand-drawn bold dark outlines, original proportions, expression and pose. Remove ALL lined notebook paper and background. Clean edges, retain charming illustration texture. Single full-body character centered with transparent space around feet and wings, no text, no props, no redesign. Asset for CallCanary scam warning popup.

An image does not contain a voice sample. The app uses the configured ElevenLabs voice ID. Set `ELEVENLABS_MASCOT_VOICE_ID` to give this character a distinct voice; otherwise it uses `ELEVENLABS_VOICE_ID`. Recommended direction for selecting or designing a character voice: clear English, slightly raspy protective little-bird personality, warm and firm, measured pace, easy for an older listener to understand. Voice design or cloning has not been performed.

The speech route reads the current verdict's reasons, not a canned explanation from another scam. If ElevenLabs is unavailable, the user can choose the labeled device-voice backup.

## Sleeping state

Asset: `public/mascot-sleeping.png`. Created with the built-in image-generation tool from the user's sleepy sticker photo. Used while protection is off, including a stopped or failed session. The awake mascot remains visible during startup, listening, verification and scam warnings.

Prompt used:

> Edit the latest attached photo of the sleepy masked yellow canary sticker into a transparent-background website mascot. Remove the wooden table, lighting glare, photographic perspective and white sticker border. Preserve the character faithfully: round golden-yellow bird with closed sleepy eyes, dark charcoal knitted balaclava, orange beak, drooping wings, tiny feet, sleeping Zzz above its head, the black tied sack beside it and the illustrated paper bills under its feet exactly as shown. Clean hand-drawn dark outlines and flat warm colors, front-facing illustration, full character and its existing props fully visible, centered with generous transparent margins. Do not add anything or redesign the character. This is the protection-off sleeping state for CallCanary.
