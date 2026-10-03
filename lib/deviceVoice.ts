"use client";
// Backup when ElevenLabs is unavailable. Pick the same kind of voice every time so the canary stays recognisable:
// an en-US voice, slightly lower and slower than default.
const PREFERRED = [/Google US English/i, /Microsoft (?:Guy|Davis|Andrew|Christopher)/i, /Daniel|Alex|Aaron|Fred/i];
function pickVoice() {
  const voices = window.speechSynthesis.getVoices().filter(voice => /^en[-_]US/i.test(voice.lang));
  for (const pattern of PREFERRED) { const match = voices.find(voice => pattern.test(voice.name)); if (match) return match; }
  return voices.find(voice => voice.localService) || voices[0];
}
export function speakWithDeviceVoice(text: string, events: { onStart: () => void; onEnd: () => void; onError: () => void }) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(); if (voice) speech.voice = voice;
  speech.lang = "en-US"; speech.rate = 0.88; speech.pitch = 0.85;
  speech.onstart = events.onStart; speech.onend = events.onEnd; speech.onerror = events.onError;
  window.speechSynthesis.speak(speech);
  return true;
}
