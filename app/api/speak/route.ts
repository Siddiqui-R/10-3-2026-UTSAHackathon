import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { WARNING_SCRIPT } from "@/lib/demoTranscripts";
import { warningText, type SpokenLevel } from "@/lib/warningText";
import { MASCOT_VOICE_SETTINGS, mascotVoiceId, TTS_MODEL } from "@/lib/voice";
export const runtime = "nodejs";
export const maxDuration = 30;
// Bounded cache, keyed by voice + content, so explanations never leak across verdicts.
const cache = new Map<string, { bytes: ArrayBuffer; expires: number }>();
const levels: SpokenLevel[] = ["scam", "suspicious", "safe"];
export async function POST(request: Request) {
  let text: string;
  try {
    const body = await request.json();
    if (body?.text === WARNING_SCRIPT && body.reasons === undefined) text = WARNING_SCRIPT;
    else {
      if (!Array.isArray(body?.reasons) || body.reasons.length < 1 || body.reasons.length > 3 ||
        !body.reasons.every((r: unknown) => typeof r === "string" && r.trim().length > 0 && r.length <= 500))
        return NextResponse.json({ error: "Please send up to three short explanations." }, { status: 400 });
      const level = body.level === undefined ? "scam" : body.level;
      if (!levels.includes(level)) return NextResponse.json({ error: "Unknown verdict level." }, { status: 400 });
      text = warningText(body.reasons, level);
    }
  } catch { return NextResponse.json({ error: "Please send an explanation." }, { status: 400 }); }
  const key = process.env.ELEVENLABS_API_KEY;
  const voice = mascotVoiceId();
  if (!key || !voice) return NextResponse.json({ error: "The mascot voice needs an ElevenLabs key and voice ID." }, { status: 503 });
  try {
    const cacheKey = createHash("sha256").update(voice + TTS_MODEL + text).digest("hex");
    let cached = cache.get(cacheKey);
    if (!cached || cached.expires < Date.now()) {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
        method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: TTS_MODEL, voice_settings: MASCOT_VOICE_SETTINGS }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) return NextResponse.json({ error: "The mascot voice could not be prepared. Read the warning on screen." }, { status: 502 });
      const bytes = await response.arrayBuffer();
      if (!bytes.byteLength) throw new Error("Empty audio");
      cached = { bytes, expires: Date.now() + 30 * 60_000 };
      if (cache.size >= 16) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey, cached);
    }
    return new Response(cached.bytes, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Spoken-Text": encodeURIComponent(text.slice(0, 1500)) } });
  } catch { return NextResponse.json({ error: "The mascot voice could not be prepared. Read the warning on screen." }, { status: 502 }); }
}
