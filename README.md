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
- A 40-second text window adds each distinct rule's weight once, so repeating a phrase cannot inflate the score. Rules match common variations ("buy Google Play cards and read me the numbers", "Zelle me", "bitcoin ATM", "grandma, it's me… bail"). A plain mention ("a gift card for your birthday") scores far less than a payment demand ("pay with gift cards"). Negated phrases ("I will not send money") and talk *about* scams ("the news said scammers ask for gift cards") still show on screen but are labelled and down-weighted. A direct demand such as "read me the code" keeps full weight even when the caller says "scam" or "fraud department". A payment demand combined with pressure adds a +10 bonus. The full rule set is in `lib/scamSignals.ts`; `tests/scoring.cjs` lists the false-positive and missed-scam cases.
- At 35 points, CallCanary finalizes recent audio clips and calls ElevenLabs Scribe. Gemini then checks the transcript (plus the browser's trigger captions) in context. Phrase points only start an investigation. Only Gemini's verdict, with quoted evidence from the transcript, can produce a scam warning. Automatic checks are spaced at least 8 seconds apart.
- Audio rotates into independent 20-second files and holds one previous file. It never joins separate WebM containers into an invalid upload. Uploads are bounded below Vercel's request cap.
- If browser recognition is missing or unavailable due to a network error, the disclosed fallback transcribes audio every 20 seconds and applies the same weights before invoking Gemini. This uses provider quota even during ordinary conversation.
- Audio buffering continues while a check is in progress. Recognition resumes after safe/suspicious results. A confirmed scam releases the microphone before the mascot speaks, preventing its warning from triggering itself.
- Normal silence returns to listening. A failed or timed-out provider check keeps listening with an amber warning ("will try again, 1 of 3"). Three failures in a row stop protection. Offline and system-muted microphones show a warning. Microphone disconnection (including silently ended tracks, caught by a 1-second watchdog), page suspension and recorder failure stop protection with a dark **Protection is OFF** banner and a **Turn back on** button. Late asynchronous responses are ignored after stopping.
- If browser speech recognition keeps ending without hearing anything (6 times in 30 seconds), it switches to 20-second clip checks instead of looping. Restarts back off gradually.
- Memory is bounded: at most two ~20-second audio clips, 200 caption entries and 4,000 characters of text.
- While listening, the page asks the browser for a screen wake lock and shows whether it was granted.
- Listening continues until stopped or a scam intervention. Browser suspension, page closure, locked devices and browser permission policies can interrupt it. This web app cannot guarantee system-wide background monitoring or directly intercept telephone audio.

## Mascot and speech

See [mascot asset, moods and voice](docs/mascot.md). The mascot sleeps while protection is off. It is alert while listening, looks concerned (amber "?") while a check runs, and pops up with a red "!" to speak a warning. Reduced-motion users get the same states without animation.

The canary has one character voice: `ELEVENLABS_MASCOT_VOICE_ID` with fixed settings in `lib/voice.ts` (steady, slightly slower pace for older listeners). The spoken words come from `lib/warningText.ts` and follow the verdict: a confident warning for scams, a "slow down and check" line for suspicious calls, and a reassurance for safe ones. Each line uses up to three one-sentence reasons from that verdict. Scam warnings autoplay; if the browser blocks autoplay, a **Play** button and audio controls appear. A consistent device-voice backup is offered if ElevenLabs fails. Suspicious and safe results have a **Hear CallCanary explain** button; phrase triggers are held while it speaks, so the canary cannot trigger itself.

## Safety actions

A website cannot block numbers, delete call history or send texts on its own, so CallCanary does not pretend to:
- **Block this number** / **Delete this call** show step-by-step instructions for the detected phone (iPhone, Android, or both).
- **Tell someone I trust** saves a name and number on this device only. It opens the phone's own Messages app (sms: link) with a prepared message, or the dialer, or the share sheet. Nothing is sent until the user presses Send.
- **Report this scam** links to ReportFraud.ftc.gov and the AARP Fraud Watch Helpline.

## Verification

- `npm run build` — production compile, TypeScript and ESLint.
- `npm test` — all unit and integration tests (same as `node tests/api.cjs`).
- `npm run lint` — ESLint separately.
- `node tests/api.cjs` — provider mocks covering weighted phrases, duplicate words, score boundaries, malformed verdicts, model discovery, retries, contextual speech caching, uploads and silence; continuous-session tests cover automatic triggers, interim corrections, resumed recording, stop races, late permission results, disconnects and cleanup.
- Optional fixture-only UI preview after building: `node --require ./tests/preview-mocks.cjs node_modules/next/dist/bin/next start -p 3001`. It supplies mock verdicts and an unavailable ElevenLabs voice to test the fallback. It makes no live provider calls and is never used by production scripts.
- With real keys, speak an IRS example into a live microphone and confirm automatic transcription, Gemini's verdict and audible explanation. Also check a normal family conversation, manual Check now, stop, restart and denied permission.

## Deploy

Push to **Siddiqui-R/10-3-2026-UTSAHackathon**, import it in Vercel with the Next.js preset, add server environment variables, and deploy. Add **callcanary.us** and **www.callcanary.us** in project **Settings > Domains** and follow the DNS records displayed by Vercel. If moving nameservers to Vercel, preserve existing records first. Verify HTTPS and run all three demo examples on the live URL.

Set `GEMINI_MODEL` (for example `gemini-3.6-flash`) in Vercel to pin a model that answers quickly. Without it, the route discovers Flash models, tries the last one that worked first, and benches overloaded (503), rate-limited (429) or hanging models for two minutes.

Optional Tiger Data logging/dashboard is not implemented. DATABASE_URL is reserved for that stretch feature. No transcripts or recordings are stored in a database.
