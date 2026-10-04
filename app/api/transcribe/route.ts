import { NextResponse } from "next/server";
import { MAX_AUDIO_BYTES, transcribeAudio } from "@/lib/transcribe";
export const runtime = "nodejs";
export const maxDuration = 60;
const failure = () => NextResponse.json({ error: "Could not transcribe — try the demo scripts below." }, { status: 502 });
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > MAX_AUDIO_BYTES + 32_768)
    return NextResponse.json({ error: "That recording is too large. Please record a shorter call." }, { status: 413 });
  let file: FormDataEntryValue | null;
  try { file = (await request.formData()).get("audio"); }
  catch { return NextResponse.json({ error: "Please send an audio recording." }, { status: 400 }); }
  if (!(file instanceof File) || !file.size)
    return NextResponse.json({ error: "Please record a call first." }, { status: 400 });
  if (file.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: "That recording is too large. Please record a shorter call." }, { status: 413 });
  if (!file.type.startsWith("audio/")) return NextResponse.json({ error: "Please send an audio file." }, { status: 415 });
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ error: "Recording checks need an ElevenLabs API key. Try a demo below." }, { status: 503 });
  try { return NextResponse.json({ transcript: await transcribeAudio(file, key) }); }
  catch { return failure(); }
}
