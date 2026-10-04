// ElevenLabs Scribe speech-to-text, shared by call listening and caller screening.
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
export class TranscribeError extends Error {}
/** Returns the transcript ("" for silence). Throws TranscribeError when ElevenLabs can't transcribe. */
export async function transcribeAudio(file: File, key: string): Promise<string> {
  let model = "scribe_v1"; let retried = false; let discovered = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const form = new FormData(); form.append("file", file, file.name); form.append("model_id", model);
    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST", headers: { "xi-api-key": key }, body: form, signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) {
      const data = await response.json();
      if (typeof data.text === "string") return data.text;
      throw new TranscribeError("Unexpected transcription response");
    }
    if (response.status >= 500 && !retried) { retried = true; continue; }
    // A retired model ID: find the current Scribe model once and retry.
    if ([400, 404, 422].includes(response.status) && !discovered) {
      const error = await response.text();
      if (!/model|scribe/i.test(error)) throw new TranscribeError("Transcription rejected");
      discovered = true;
      const list = await fetch("https://api.elevenlabs.io/v1/models", { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(5_000) });
      if (!list.ok) throw new TranscribeError("Model list unavailable");
      const models = await list.json();
      const match = models.filter((m: { model_id: string }) => /scribe/.test(m.model_id)).sort((a: { model_id: string }, b: { model_id: string }) => b.model_id.localeCompare(a.model_id))[0];
      if (!match) throw new TranscribeError("No Scribe model available");
      model = match.model_id; continue;
    }
    throw new TranscribeError(`Transcription failed (${response.status})`);
  }
  throw new TranscribeError("Transcription failed");
}
