# CallCanary

Your canary in the coal mine for phone scams.

A Next.js 14, TypeScript and Tailwind app for the Rowdy Hacks SWIVEL Social Engineering Shield track. Record up to two minutes of a call on speaker, then tap **Hang Up** to transcribe it with ElevenLabs Scribe and check its words with Google Gemini. A scam verdict opens a red intervention screen, plays an ElevenLabs voice warning, and explains the exact warning phrases in plain language.

## Local setup

1. Run `npm install` (on Windows PowerShell, use `npm.cmd` if script execution is disabled).
2. Copy `.env.example` to `.env.local` and set `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, and `GEMINI_API_KEY`.
3. Run `npm run dev` and open http://localhost:3000.
4. Tap **Try a demo call** for the IRS, romance, or phishing examples. These use the real analysis route and require a Gemini key.

Choose a calm premade voice using ElevenLabs' authenticated GET /v1/voices endpoint. The ElevenLabs key needs Text to Speech, Speech to Text, Voices read, and Models access. Gemini discovers the newest available Flash model supporting generateContent, excluding image/audio/live/TTS/Lite variants.

Keys are server-side only. Environment files and the supplied Tiger Data credential file are ignored by Git. Never use NEXT_PUBLIC_ for a key.

## Checks

- `npm run build`: production compile, TypeScript and lint validation.
- `npm run lint`: ESLint.
- `node tests/api.cjs`: isolated API tests with mocked providers, including invalid JSON, score boundaries, fabricated quotes, model discovery, analysis retry and fallback, speech caching, upload limits, transcription retry and Scribe recovery.
- With real keys, run all three demos and a normal family-call recording. Confirm scam warnings, audible playback, education text, and the safe result.

## Deploy to Vercel

Push this repository to GitHub. In Vercel select **Add New > Project**, import **Siddiqui-R/10-3-2026-UTSAHackathon**, and choose the Next.js framework preset. Add the three required variables to Production (and Preview/Development if used), then deploy. The repository includes function duration configuration.

Add **callcanary.us** and **www.callcanary.us** under project **Settings > Domains**. Follow the DNS records Vercel displays. If moving DNS to Vercel as specified in the brief, first preserve any existing DNS records, then change the Porkbun nameservers to **ns1.vercel-dns.com** and **ns2.vercel-dns.com**. Verify both domains have valid configuration and HTTPS before the live demo.

## Behavior and limits

- MediaRecorder prefers WebM Opus, then MP4 or Ogg, then the browser's default audio format. It stops at 120 seconds. Audio files over 4 MiB are rejected to leave room below Vercel's multipart request cap.
- Audio goes to ElevenLabs; transcribed words go to Google. The app does not store recordings or transcripts in a database.
- Analysis happens after recording stops. The app does not answer an actual telephone call or monitor it continuously.
- Provider failures or invalid model output yield a suspicious, inconclusive result. Missing keys display a setup error; canned demos are not substituted for a real verdict.
- Browsers may block autoplay. The warning includes a visible audio player to play it manually.
- Delete, block and contact buttons are explicitly labeled demo actions. They show the brief's requested confirmations but cannot alter phone call history, block a number or notify a contact.
- Warning audio is cached in memory per server instance. Only the fixed safety warning is accepted by the speech route.
- Optional Tiger Data logging/dashboard is not implemented. DATABASE_URL is reserved for that stretch feature.

