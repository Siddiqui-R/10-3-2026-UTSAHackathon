# CallCanary mascot

Asset: `public/mascot.png`. Generated using the built-in image-generation tool with the user's masked yellow canary image as the edit target. Transparent PNG; no notebook-paper background. The alert animates the whole character when audio playback starts and stops. It does not provide phoneme-level lip sync.

Prompt used:

> Edit the attached image into a clean transparent-background website mascot cutout. Preserve the exact character identity: round golden-yellow canary, black knitted balaclava with rectangular yellow eye opening, stern small black eyes and orange beak, raised yellow wings and tiny black feet. Preserve hand-drawn bold dark outlines, original proportions, expression and pose. Remove ALL lined notebook paper and background. Clean edges, retain charming illustration texture. Single full-body character centered with transparent space around feet and wings, no text, no props, no redesign. Asset for CallCanary scam warning popup.

## Voice

An image contains no voice sample, so the voice is designed, not cloned. Target character (`lib/voice.ts`): *a small but brave guardian canary — clear American English, slightly raspy and husky, warm yet firm, protective like a trusted older neighbour, medium pitch, unhurried, crisp consonants, never squeaky.*

`node scripts/mascot-voice.mjs design` generates three previews from that description with ElevenLabs Voice Design and saves them as MP3s, without saving a voice. `node scripts/mascot-voice.mjs create <generated_voice_id>` saves the chosen one to the ElevenLabs account; put the printed ID in `ELEVENLABS_MASCOT_VOICE_ID`. `list` shows existing voices if you'd rather pick a stock one, and `sample <voice_id>` renders a test warning with the app's exact settings.

Every spoken line uses the same voice ID, model and settings (stability 0.6, similarity 0.8, style 0.2, speed 0.92). The words are generated per verdict from that verdict's own reasons, never a canned explanation from another scam.

## Moods

| State | Image | Cue | Reduced motion |
|---|---|---|---|
| Protection off | sleeping | slow breathing | static sleeping image |
| Listening | awake | listening ring, occasional head tilt | static ring |
| Checking | awake | tilted, amber "?" badge | tilt and badge stay |
| Warning | awake | pop-in, red "!" badge | badge only |
| Speaking | awake | talking bob | badge only |

## Sleeping state

Asset: `public/mascot-sleeping.png`. Created with the built-in image-generation tool from the user's sleepy sticker photo. Used while protection is off, including a stopped or failed session. The awake mascot remains visible during startup, listening, verification and scam warnings.

Prompt used:

> Edit the latest attached photo of the sleepy masked yellow canary sticker into a transparent-background website mascot. Remove the wooden table, lighting glare, photographic perspective and white sticker border. Preserve the character faithfully: round golden-yellow bird with closed sleepy eyes, dark charcoal knitted balaclava, orange beak, drooping wings, tiny feet, sleeping Zzz above its head, the black tied sack beside it and the illustrated paper bills under its feet exactly as shown. Clean hand-drawn dark outlines and flat warm colors, front-facing illustration, full character and its existing props fully visible, centered with generous transparent margins. Do not add anything or redesign the character. This is the protection-off sleeping state for CallCanary.
