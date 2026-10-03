import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const transcription = Boolean(process.env.ELEVENLABS_API_KEY);
  const analysis = Boolean(process.env.GEMINI_API_KEY);
  const voice = Boolean(process.env.ELEVENLABS_API_KEY && (process.env.ELEVENLABS_MASCOT_VOICE_ID || process.env.ELEVENLABS_VOICE_ID));
  return NextResponse.json({ transcription, analysis, voice, ready: transcription && analysis && voice }, { headers: { "Cache-Control": "no-store" } });
}
