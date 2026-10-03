# CallCanary

Your canary in the coal mine for phone scams.

Next.js 14, TypeScript and Tailwind app for the Rowdy Hacks SWIVEL Social Engineering Shield track. A masked canary watches for weighted scam phrases, verifies flagged audio with ElevenLabs Scribe and Google Gemini, then pops up and explains a confirmed scam using ElevenLabs speech.

## Start locally

1. Run `npm install` (or `npm.cmd install` in Windows PowerShell).
2. Copy `.env.example` to `.env.local`.
3. Set `ELEVENLABS_API_KEY`, `GEMINI_API_KEY` and `ELEVENLABS_VOICE_ID`. Optionally set `ELEVENLABS_MASCOT_VOICE_ID` for a dedicated character voice.
4. Run `npm run dev` and open http://localhost:3000.
5. Read the listening disclosure, enable its checkbox, tap **Start protection**, and allow microphone access. Put the call on speaker and keep the page open and your device awake.
6. **Stop listening** releases the microphone. **Check now** verifies the current audio without waiting for a keyword trigger.

The connection badge reports configuration presence, not authentication success. Missing transcription or analysis configuration prevents starting protection. API errors stop monitoring and display a clear error rather than leave a false active status. A missing voice still permits analysis with the labeled device-voice backup.

The ElevenLabs key needs Text to Speech, Speech to Text, Voices read and Models access. Select a voice from the authenticated GET /v1/voices response. All provider keys stay server-side; environment and Tiger Data credential files are ignored by Git.

## Listening flow

- Browser SpeechRecognition produces provisional words where supported. This service may send microphone audio to the browser vendor's speech service; it is not guaranteed on-device or offline.
- A 40-second text window adds each distinct rule's weight once. Gift-card payments: +35; arrest threats: +30; secrecy: +25; private codes: +35; urgent payment: +15. The full rule set is in `lib/scamSignals.ts`.
- At 35 points, CallCanary finalizes recent audio clips and calls ElevenLabs Scribe. Gemini then checks the confirmed transcript and context. Heuristic points trigger review; they are not a fraud verdict.
- Audio rotates into independent 20-second files and holds one previous file. It never joins separate WebM containers into an invalid upload. Uploads are bounded below Vercel's request cap.
- If browser recognition is missing or unavailable due to a network error, the disclosed fallback transcribes audio every 20 seconds and applies the same weights before invoking Gemini. This uses provider quota even during ordinary conversation.
- Audio buffering continues while a check is in progress. Recognition resumes after safe/suspicious results. A confirmed scam releases the microphone before the mascot speaks, preventing its warning from triggering itself.
- Normal silence returns to listening. Permission denial, microphone disconnection, transcription failure and provider timeouts stop protection visibly. Late asynchronous responses are ignored after stopping.
- Listening continues until stopped or a scam intervention. Browser suspension, page closure, locked devices and browser permission policies can interrupt it. This web app cannot guarantee system-wide background monitoring or directly intercept telephone audio.

## Mascot and speech

See [mascot asset and generation prompt](docs/mascot.md). The image is a transparent adaptation of the provided canary drawing. The mascot pops up on a scam and animates while speech plays. An image cannot establish an exact voice; its configured ElevenLabs voice speaks the current verdict's reasons.

Warnings are cached by voice and explanation in a bounded per-instance cache. Different scams receive different explanations. Browser autoplay restrictions are handled with visible audio controls; an explicit device-voice backup is offered if ElevenLabs fails.

Delete/block/contact buttons remain labeled demo actions. They cannot change phone history, block an actual number or send notifications.

## Verification

- `npm run build` — production compile, TypeScript and ESLint.
- `npm run lint` — ESLint separately.
- `node tests/api.cjs` — provider mocks covering weighted phrases, duplicate words, score boundaries, malformed verdicts, model discovery, retries, contextual speech caching, uploads and silence; continuous-session tests cover automatic triggers, interim corrections, resumed recording, stop races, late permission results, disconnects and cleanup.
- Optional fixture-only UI preview after building: `node --require ./tests/preview-mocks.cjs node_modules/next/dist/bin/next start -p 3001`. It supplies mock verdicts and an unavailable ElevenLabs voice to test the fallback. It makes no live provider calls and is never used by production scripts.
- With real keys, speak an IRS example into a live microphone and confirm automatic transcription, Gemini's verdict and audible explanation. Also check a normal family conversation, manual Check now, stop, restart and denied permission.

## Deploy

Push to **Siddiqui-R/10-3-2026-UTSAHackathon**, import it in Vercel with the Next.js preset, add server environment variables, and deploy. Add **callcanary.us** and **www.callcanary.us** in project **Settings > Domains** and follow the DNS records displayed by Vercel. If moving nameservers to Vercel, preserve existing records first. Verify HTTPS and run all three demo examples on the live URL.

Optional Tiger Data logging/dashboard is not implemented. DATABASE_URL is reserved for that stretch feature. No transcripts or recordings are stored in a database.
