// Records the sample caller replies for "Screen a caller" with ElevenLabs stock voices (never the mascot's voice).
//   node scripts/make-screen-demos.mjs
// Reads ELEVENLABS_API_KEY from .env.local; writes public/demo/screen-<id>.mp3.
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const env = Object.fromEntries(fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)
  .map(line => line.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].trim().replace(/^["']|["']$/g, "")]));
const key = env.ELEVENLABS_API_KEY;
if (!key) { console.error("ELEVENLABS_API_KEY is not set in .env.local."); process.exit(1); }
// The demo list lives in TypeScript; read the plain data out of it.
const source = fs.readFileSync(path.join(root, "lib/screenDemos.ts"), "utf8");
const demos = [...source.matchAll(/id: "(\w+)"[\s\S]*?audio: "([^"]+)", voice: \[([^\]]+)\],\s*text: "([^"]+)"/g)]
  .map(m => ({ id: m[1], audio: m[2], voices: m[3].match(/"([^"]+)"/g).map(v => v.slice(1, -1)), text: m[4] }));
const { voices } = await (await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } })).json();
const mascot = env.ELEVENLABS_MASCOT_VOICE_ID || env.ELEVENLABS_VOICE_ID;
const callers = voices.filter(v => v.voice_id !== mascot);
for (const demo of demos) {
  const voice = demo.voices.map(name => callers.find(v => v.name.startsWith(name))).find(Boolean) || callers[0];
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.voice_id}?output_format=mp3_22050_32`, {
    method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: demo.text, model_id: "eleven_flash_v2_5" }),
  });
  if (!response.ok) { console.error(`${demo.id}: HTTP ${response.status}`); process.exitCode = 1; continue; }
  const file = path.join(root, "public", demo.audio);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  console.log(`${demo.id}: ${voice.name.split(" - ")[0]} -> ${demo.audio} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
}
