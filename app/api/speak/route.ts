import { NextResponse } from "next/server";
import { WARNING_SCRIPT } from "@/lib/demoTranscripts";
export const runtime = "nodejs";
export const maxDuration = 30;
let cached: { voice: string; bytes: ArrayBuffer } | undefined;
export async function POST(request: Request) {
  let text: unknown;
  try { text = (await request.json())?.text; } catch { return NextResponse.json({ error: "Please send warning text." }, { status: 400 }); }
  if (text !== WARNING_SCRIPT) return NextResponse.json({ error: "Only the CallCanary safety warning can be spoken." }, { status: 400 });
  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voice) return NextResponse.json({ error: "Spoken alerts need an ElevenLabs key and voice. Read the warning on screen." }, { status: 503 });
  try {
    if (!cached || cached.voice !== voice) {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`, {
        method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: "eleven_flash_v2_5", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) return NextResponse.json({ error: "The spoken alert could not be prepared. Read the warning on screen." }, { status: 502 });
      const bytes = await response.arrayBuffer();
      if (!bytes.byteLength) throw new Error("Empty audio");
      cached = { voice, bytes };
    }
    return new Response(cached.bytes, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "The spoken alert could not be prepared. Read the warning on screen." }, { status: 502 }); }
}

