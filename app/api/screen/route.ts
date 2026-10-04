import { NextResponse } from "next/server";
import { generateVerdict } from "@/lib/gemini";
import { checkReportedNumber } from "@/lib/reportedNumbers";
import { decideScreening, parseScreenJudgment, SCREEN_SYSTEM_PROMPT, screenResponseSchema, screenUserText } from "@/lib/screening";
import { MAX_AUDIO_BYTES, transcribeAudio } from "@/lib/transcribe";
export const runtime = "nodejs";
export const maxDuration = 60;
// Each layer fails open: one broken provider must not take down the screen.
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > MAX_AUDIO_BYTES + 32_768)
    return NextResponse.json({ error: "That recording is too long." }, { status: 413 });
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Please send the caller's reply." }, { status: 400 }); }
  const audio = form.get("audio"); const phone = form.get("phone");
  if (!(audio instanceof File) || !audio.size) return NextResponse.json({ error: "No reply was recorded. Please try again." }, { status: 400 });
  if (audio.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: "That recording is too long." }, { status: 413 });
  if (!audio.type.startsWith("audio/")) return NextResponse.json({ error: "Please send an audio recording." }, { status: 415 });
  const number = typeof phone === "string" && phone.trim() ? checkReportedNumber(phone) : null;
  const sttKey = process.env.ELEVENLABS_API_KEY;
  let transcript: string | null = null;
  if (sttKey) { try { transcript = await transcribeAudio(audio, sttKey); } catch { transcript = null; } }
  const geminiKey = process.env.GEMINI_API_KEY;
  const judgment = transcript?.trim() && geminiKey ? await generateVerdict(geminiKey, {
    systemPrompt: SCREEN_SYSTEM_PROMPT, schema: screenResponseSchema, parse: parseScreenJudgment, userText: screenUserText(transcript), deadlineMs: 40_000,
  }) : null;
  return NextResponse.json(decideScreening({ number, transcript, judgment }));
}
