import { NextResponse } from "next/server";
import { sanitizeContacts, type TrustedContact } from "@/lib/contacts";
import { generateVerdict } from "@/lib/gemini";
import { checkReportedNumber } from "@/lib/reportedNumbers";
import { decideScreening, parseScreenJudgment, pendingLayers, SCREEN_SYSTEM_PROMPT, screenResponseSchema, screenUserText } from "@/lib/screening";
import { MAX_AUDIO_BYTES, transcribeAudio } from "@/lib/transcribe";
export const runtime = "nodejs";
export const maxDuration = 60;
// Streams newline-delimited JSON: {"type":"progress",...} as each layer finishes, then {"type":"result","result":...}.
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
  // Contacts come from the device for this check only. They are not stored and never sent to the AI.
  let contacts: TrustedContact[] = [];
  try { contacts = sanitizeContacts(JSON.parse(String(form.get("contacts") || "[]"))); } catch { contacts = []; }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (value: unknown) => controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
      try {
        const number = typeof phone === "string" && phone.trim() ? checkReportedNumber(phone) : null;
        send({ type: "progress", transcript: null, layers: pendingLayers(decideScreening({ number, transcript: "", judgment: null, contacts }), ["transcript", "phrases", "contacts", "content"]) });
        const sttKey = process.env.ELEVENLABS_API_KEY;
        let transcript: string | null = null;
        if (sttKey) { try { transcript = await transcribeAudio(audio, sttKey); } catch { transcript = null; } }
        const geminiKey = process.env.GEMINI_API_KEY;
        const willJudge = !!(transcript?.trim() && geminiKey);
        send({ type: "progress", transcript, layers: pendingLayers(decideScreening({ number, transcript, judgment: null, contacts }), willJudge ? ["contacts", "content"] : []) });
        const judgment = willJudge ? await generateVerdict(geminiKey!, {
          systemPrompt: SCREEN_SYSTEM_PROMPT, schema: screenResponseSchema, parse: parseScreenJudgment, userText: screenUserText(transcript!), deadlineMs: 40_000,
        }) : null;
        send({ type: "result", result: decideScreening({ number, transcript, judgment, contacts }) });
      } catch { send({ type: "error", error: "The screen could not finish. Please try again." }); }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
