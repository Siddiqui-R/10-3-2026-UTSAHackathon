// Choose or design CallCanary's ElevenLabs character voice. Reads ELEVENLABS_API_KEY from .env.local; never prints it.
//   node scripts/mascot-voice.mjs list                  # voices already in the account (name, id, labels)
//   node scripts/mascot-voice.mjs design                # 3 designed previews saved as MP3 files to listen to (no voice is saved)
//   node scripts/mascot-voice.mjs create <generatedId>  # saves one preview as a permanent voice in the account
//   node scripts/mascot-voice.mjs sample <voiceId>      # renders a sample warning with the app's exact settings
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
for (const file of [".env.local", ".env"]) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && match[2] && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error("ELEVENLABS_API_KEY is not set in .env.local."); process.exit(1); }
const DESCRIPTION = "A small but brave guardian canary. Clear American English, slightly raspy and husky, warm yet firm, protective like a trusted older neighbour. Medium pitch, unhurried pace, crisp consonants, easy for an older listener on speakerphone to understand. Calm authority, never panicked, never cartoonish or squeaky.";
const SAMPLE = "Hold on. It's CallCanary. I'm sure this call is a scam. The caller wants gift cards, and real government offices never take gift cards. They also told you to keep it secret. Don't send money, and don't share any codes. Hang up, and call someone you trust.";
const outDir = path.join(os.tmpdir(), "callcanary-voice");
fs.mkdirSync(outDir, { recursive: true });
const api = async (url, init = {}) => {
  const response = await fetch(`https://api.elevenlabs.io${url}`, { ...init, headers: { "xi-api-key": key, "Content-Type": "application/json", ...init.headers } });
  if (!response.ok) { const error = new Error(`${url} -> HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`); error.status = response.status; throw error; }
  return response;
};
const [command, arg] = process.argv.slice(2);
if (command === "list") {
  const { voices } = await (await api("/v1/voices")).json();
  for (const v of voices) console.log(`${v.voice_id}\t${v.name}\t${v.category}\t${Object.values(v.labels || {}).join(", ")}`);
} else if (command === "design") {
  let data;
  try {
    data = await (await api("/v1/text-to-voice/design", { method: "POST", body: JSON.stringify({ voice_description: DESCRIPTION, text: SAMPLE, model_id: "eleven_multilingual_ttv_v2" }) })).json();
  } catch (error) {
    if (error.status !== 404) throw error;
    data = await (await api("/v1/text-to-voice/create-previews", { method: "POST", body: JSON.stringify({ voice_description: DESCRIPTION, text: SAMPLE }) })).json();
  }
  for (const [i, preview] of data.previews.entries()) {
    const file = path.join(outDir, `preview-${i + 1}.mp3`);
    fs.writeFileSync(file, Buffer.from(preview.audio_base_64, "base64"));
    console.log(`${file}\tgenerated_voice_id=${preview.generated_voice_id}`);
  }
  console.log("Listen, then run: node scripts/mascot-voice.mjs create <generated_voice_id>");
} else if (command === "create" && arg) {
  const body = JSON.stringify({ voice_name: "CallCanary Guardian", voice_description: DESCRIPTION, generated_voice_id: arg });
  let data;
  try { data = await (await api("/v1/text-to-voice", { method: "POST", body })).json(); }
  catch (error) { if (error.status !== 404) throw error; data = await (await api("/v1/text-to-voice/create-voice-from-preview", { method: "POST", body })).json(); }
  console.log(`Created voice. Set ELEVENLABS_MASCOT_VOICE_ID=${data.voice_id} in .env.local and in Vercel.`);
} else if (command === "sample" && arg) {
  const response = await api(`/v1/text-to-speech/${encodeURIComponent(arg)}?output_format=mp3_44100_128`, { method: "POST", headers: { Accept: "audio/mpeg" },
    body: JSON.stringify({ text: SAMPLE, model_id: process.env.ELEVENLABS_TTS_MODEL || "eleven_flash_v2_5", voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true, speed: 0.92 } }) });
  const file = path.join(outDir, `sample-${arg}.mp3`);
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  console.log(file);
} else {
  console.log("Usage: node scripts/mascot-voice.mjs list | design | create <generated_voice_id> | sample <voice_id>");
}
