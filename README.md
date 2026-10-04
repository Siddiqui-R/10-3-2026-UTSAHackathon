# CallCanary

Your canary in the coal mine for phone scams.

Next.js 14, TypeScript and Tailwind app for the Rowdy Hacks SWIVEL Social Engineering Shield track. A masked canary watches for weighted scam phrases, verifies flagged audio with ElevenLabs Scribe and Google Gemini, then pops up and explains a confirmed scam using ElevenLabs speech.

## Interface

Visual identity: "the canary in the coal mine". Each page opens on a dark coal band lit by a canary-yellow lamp, with faint sound rings spreading from the light; content sits on meadow paper with a fine pine dot grid. Headings use Bricolage Grotesque; body text uses Atkinson Hyperlegible, designed by the Braille Institute for low-vision readers. Each page has one staggered load reveal (CSS only, off under reduced motion). On the call screen the glow takes the call's state, and scam screens use red alarm rings.

Built with [shadcn/ui](https://github.com/shadcn-ui/ui) (Radix UI + Tailwind; components live in `components/ui` and are sized for older users: 56px+ buttons, large type, a thick focus ring), [Motion](https://github.com/motiondivision/motion) for transitions (it follows the device's reduce-motion setting), [Sonner](https://github.com/emilkowalski/sonner) for confirmations, and [Phosphor](https://github.com/phosphor-icons/react) icons. A bottom tab bar (Screen, Listen, Email, Recent) keeps every tool within thumb reach. Screen a caller uses a phone-style call screen: caller ID, the canary in a status ring, and round call buttons.

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

## Android app (android/)

A native Android app that screens and blocks calls on the phone itself: it becomes Android's caller ID & spam app, checks every incoming call from a non-contact against your block list and the bundled FTC complaint list (offline), rejects or silences matches before the phone rings, and notifies you why. Share any link, text or email to it for the same checks as /email. See [android/README.md](android/README.md) to build and install.

## Product demo for videos (/demo)

A phone running the CallCanary app, built for recording. **Play full tour** runs eight scenes in about two and a half minutes: protected home, Gmail scan (phishing moved to Scam), a scam website blocked (rnicrosoft.com shown letter by letter against microsoft.com), a scam text, a reported robocall blocked before it rings, live call protection (you answer a fake "bank fraud department" call on the phone's own call screen; CallCanary listens with live captions and phrase scores, the AI confirms the scam, the canary explains out loud, and "Hang up & block" ends the call and blocks the number), the AI call screener (spoken greeting, caller audio, live checks, spoken goodbye) and the blocked list. Each scene can also be played on its own. Captions can be shown under the phone, and the DEMO label on the phone can be hidden; press **H** to hide the controls and **C** to toggle captions. The **Web** tab checks any address you type.

The verdicts are real: the email analyzer, link checker, FTC number list and AI call screener all run on the sample data. Reading Gmail, blocking numbers and blocking websites on a phone would need a native app, so the demo shows those without changing anything, and the phone's status bar always says DEMO. `tests/demo.cjs` keeps the demo's promises true (for example, that rnicrosoft.com is flagged as imitating Microsoft and microsoft.com is allowed).

## Screen a caller (/screen)

For calls from unknown numbers. Answer on speaker and tap **Answer with CallCanary**. The canary's voice asks the caller for their name and the reason for the call. Recording starts only after the greeting, so CallCanary never records itself. It stops when the caller goes quiet, after 20 seconds, or if they never speak. Then layered checks run (`lib/screening.ts`):

1. **Reported-number list:** the caller's number, if entered, is looked up in FTC Do Not Call complaint reports. A match decides the result ("Reported scam number"). Reported isn't proof, and caller ID can be faked; the page says so.
2. **What the caller said:** ElevenLabs transcription. Silence is a warning sign, not a verdict.
3. **Warning phrases:** the same weighted phrases as call listening. Context only; never decides alone.
4. **Trusted contacts:** family saved on this device (name + number). If the caller gives a saved name (fuzzy, so a misheard "Jack" still matches "Jake") from a different number, the result is "Is it really Jake?" with his saved number to call back. Contacts are compared for that one check; they are never stored on the server or sent to the AI.
5. **CallCanary's judgment:** Gemini judges the content (likely scam / unclear / real caller) and extracts the stated name and reason. The transcript is treated as untrusted data.

Each layer appears as soon as it finishes (the server streams progress), so the caller's words show before the final verdict. The result shows every layer and marks the one that **decided**. Without Gemini the result is never "safe". For scams, **Have CallCanary say goodbye** tells the caller the person isn't available. The number check also works on its own.

**Try a sample call** plays one of four recorded callers (an IRS scammer, grandson Jake, someone claiming to be Jake from a new number, and a caller from an FTC-reported number) through the same real checks, with a sample contact. No microphone needed. Re-record them with `node scripts/make-screen-demos.mjs`.

The FTC list ships with the app as `data/ftc-reported-numbers.tsv.gz` (about 196,000 numbers, 1.1 MB, binary-searched in memory), so there's no database to keep running. Refresh it with `node scripts/build-ftc-index.mjs 30` and redeploy. The page shows the dates it covers.

## Recent checks (/history)

Every screened call, number lookup, email check and call-listening verdict is saved as a short summary on this device only: verdict, name and reason, number, sender, counts of bad links and typos. Never recordings, full transcripts or email text. Newest first, grouped by day, at most 50. Sample runs are tagged. Delete one entry, clear everything (with a confirmation), or turn history off, which also deletes it. If browser storage is blocked, the tools work normally and nothing is saved.

## Check an email (/email)

Paste a whole email (plain text or HTML) or just a link. Two layers:
- **Link check, in code** (`lib/linkCheck.ts`): every link is pulled from the text, HTML `href`s, Markdown links and "url (display text: …)" notes. Each one is checked for where it claims to go versus where it really goes, look-alike brand domains (paypa1, rnicrosoft, usps-track-secure.ru; edit distance and character swaps against official domains), risky endings (.ru, .tk, .ml, .ga, .cf, .xyz, .top, .buzz), link shorteners, punycode (`xn--`), raw IP addresses, the "@" trick and stacked subdomains. It also compares the From display name with the real address, and checks for a different Reply-To. Links are never opened.
- **Gemini** (`lib/emailAnalysis.ts`) gets the email plus that link report. It finds typos, explains each link and the sender, and lists pressure tricks. Typos it can't quote from the email are dropped. The AI can raise a link's verdict but never lower it, and a dangerous link or spoofed sender always makes the email PHISHING. If Gemini is unavailable, the code result is shown and labelled as such.

"Delete this email" asks for confirmation, then shows how to delete it in Gmail, Outlook, iPhone Mail and Yahoo, because a website can't reach your inbox. "Report & save links" saves the report on this device only and shows how to report it (reportphishing@apwg.org, the FTC). It never claims anything was sent.

Gemini calls (`lib/gemini.ts`) are hedged. If a model hasn't answered within 5 seconds, the next one starts in parallel, the first valid answer wins, and the others are cancelled. Flash-Lite models are a last resort.

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

DATABASE_URL is reserved; no transcripts or recordings are stored in a database.

## Connected application demo

Open `/demo` (the **App demo** tab) for a repeatable Gmail and phone walkthrough. Connect the sample Gmail inbox, open a flagged message, hear its explanation, and move it to demo spam. Simulate an incoming IRS call, answer it, watch scripted captions and weighted phrases build, then hear the mascot warning and demonstrate hanging up or blocking. **Call Alex** demonstrates an outgoing call screen.

Gmail, telephone connections, messages, verdicts, spam, and blocking on this screen are client-side simulations. It requests no Gmail permissions, microphone access, or phone access and sends no messages or calls. Only **Hear why / Hear the mascot explain** uses the existing ElevenLabs speech route (with device voice fallback). Reset restores the original sample state. The real microphone and paste-an-email tools remain separate.
