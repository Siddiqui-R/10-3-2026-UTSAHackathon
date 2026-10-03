import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BYTES = 4 * 1024 * 1024;
const failure = () => NextResponse.json({ error: "Could not transcribe — try the demo scripts below." }, { status: 502 });
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > MAX_BYTES + 32_768)
    return NextResponse.json({ error: "That recording is too large. Please record a shorter call." }, { status: 413 });
  let file: FormDataEntryValue | null;
  try { file = (await request.formData()).get("audio"); }
  catch { return NextResponse.json({ error: "Please send an audio recording." }, { status: 400 }); }
  if (!(file instanceof File) || !file.size)
    return NextResponse.json({ error: "Please record a call first." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That recording is too large. Please record a shorter call." }, { status: 413 });
  if (!file.type.startsWith("audio/")) return NextResponse.json({ error: "Please send an audio file." }, { status: 415 });
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ error: "Recording checks need an ElevenLabs API key. Try a demo below." }, { status: 503 });
  try {
    let model = "scribe_v1"; let retried = false; let discovered = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const form = new FormData(); form.append("file", file, file.name); form.append("model_id", model);
      const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST", headers: { "xi-api-key": key }, body: form, signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) {
        const data = await response.json();
        return typeof data.text === "string" && data.text.trim() ? NextResponse.json({ transcript: data.text }) : failure();
      }
      if (response.status >= 500 && !retried) { retried = true; continue; }
      if ([400, 404, 422].includes(response.status) && !discovered) {
        const error = await response.text();
        if (!/model|scribe/i.test(error)) return failure();
        discovered = true;
        const list = await fetch("https://api.elevenlabs.io/v1/models", { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(5_000) });
        if (!list.ok) return failure();
        const models = await list.json();
        const match = models.filter((m: { model_id: string }) => /scribe/.test(m.model_id)).sort((a: { model_id: string }, b: { model_id: string }) => b.model_id.localeCompare(a.model_id))[0];
        if (!match) return failure();
        model = match.model_id; continue;
      }
      return failure();
    }
  } catch { return failure(); }
  return failure();
}

