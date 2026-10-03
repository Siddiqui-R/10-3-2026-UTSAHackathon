// CallCanary's character voice. One voice ID and one set of settings everywhere, so it always sounds like the same bird.
export const MASCOT_VOICE_DESCRIPTION =
  "A small but brave guardian canary. Clear American English, slightly raspy and husky, warm yet firm, protective like a " +
  "trusted older neighbour. Medium pitch, unhurried pace, crisp consonants, easy for an older listener on speakerphone to understand. " +
  "Calm authority, never panicked, never cartoonish or squeaky.";
export const MASCOT_VOICE_NAME = "CallCanary Guardian";
// Low-latency model so a warning starts quickly. Override with ELEVENLABS_TTS_MODEL if needed.
export const TTS_MODEL = process.env.ELEVENLABS_TTS_MODEL || "eleven_flash_v2_5";
// Steadier delivery and a slightly slower pace for older listeners; a little style keeps the raspy character.
export const MASCOT_VOICE_SETTINGS = { stability: 0.6, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true, speed: 0.92 };
export function mascotVoiceId() {
  return process.env.ELEVENLABS_MASCOT_VOICE_ID || process.env.ELEVENLABS_VOICE_ID || "";
}
