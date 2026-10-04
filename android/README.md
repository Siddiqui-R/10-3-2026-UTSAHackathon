# CallCanary for Android

A native Android app (Kotlin, Jetpack Compose) that brings CallCanary's protection onto the phone itself.

## What it does

- **Screens and blocks calls.** CallCanary asks to become Android's *caller ID & spam app* (the call screening role, Android 10+). Android then hands it every incoming call from a number that isn't in your contacts. Within milliseconds, on the phone, it checks:
  1. your own block list, then
  2. the FTC Do Not Call complaint list (about 196,000 numbers, bundled from `../data/ftc-reported-numbers.tsv.gz`, the same file the website uses; works offline).

  A match is rejected before the phone rings (or silenced, if you prefer), and CallCanary posts a notification with the reason, e.g. *"Blocked a scam call from (201) 266-3840 · Reported to the FTC 5 times"*. Contacts' calls are never screened, and numbers are never uploaded.
- **Checks links, texts and emails.** Share anything to CallCanary, select text and tap *Check with CallCanary*, or paste it in the Check tab. It's sent to the website's checker (`/api/analyze-email`): real link checks (look-alike domains like rnicrosoft.com, mismatched links, risky endings, shorteners) plus the AI for typos, fake senders and pressure tricks.
- **Block list, activity and settings:** add or remove numbers; see recent blocked/allowed calls and checks; choose reject vs silence, whether to block FTC-reported numbers, and whether to block hidden numbers.

- **Live call protection.** Android doesn't let apps tap call audio, so CallCanary listens the honest way: put the call on speaker and tap *Protect a call I'm on* (or the *Protect this call* notification that appears when an unknown number calls). Speech is turned into text **on the phone** with [Vosk](https://alphacephei.com/vosk/) (open source; the 40 MB English model downloads once, then it works offline) and scored with the website's scam phrases. On a scam: a red full-screen alert, a loud notification, vibration and, if you like, a spoken warning; *Hang up & block* ends the call and blocks the number. It stops by itself when the call ends.
- **Call recordings (optional, off by default).** Turn on *Save a recording of the call* and each protected call is kept on the phone as a WAV with a written transcript and the scam signals, under *Saved calls*. Recording laws differ by state: tell the other person you're recording.
- **Scam texts and emails, as they arrive.** Allow *Texts & emails* on the Connect tab (Android's notification access) and CallCanary checks each new message from Messages, Gmail, Outlook, WhatsApp and others on the phone: look-alike sites (rnicrosoft.com, chase-secure-login.top), "@" tricks, shorteners, scam endings and scam phrases. A scam gets a warning notification; *See why* runs the full check with the AI. Android 15 hides one-time-code messages from apps, so those aren't checked.

## Demo mode (Demo tab)

For presentations: **Play full tour** runs seven full-screen scenes in about two minutes, or tap one to show a single feature. Sound on.

1. **Gmail scan:** connects a sample inbox, checks each email, moves the fake PayPal and Microsoft emails to Scam, and opens one with its typos, fake link and fake sender.
2. **Scam website blocked:** a browser types rnicrosoft.com and CallCanary blocks it, comparing **rn**icrosoft.com with **m**icrosoft.com.
3. **Scam text:** a USPS fee text is flagged; tapping its link shows the block page.
4. **Reported robocall:** an incoming call from (201) 266-3840 is checked against the real FTC list and blocked before it rings, with a real notification.
5. **Live call protection:** you answer a fake bank-fraud call; CallCanary listens with live captions and warning chips, raises a SCAM CALL alert, explains out loud in its own voice, and hangs up and blocks.
6. **AI call screener:** CallCanary answers in its voice, the caller speaks, the checks tick off, it says goodbye and blocks the number.
7. **Summary:** today's counts and blocked numbers.

The scenes are scripted and work offline, with the voices bundled in res/raw, so a presentation never depends on the network. The numbers they block really appear in the Blocked tab and Recent activity; clear them in Blocked and Settings after a demo. Use the top-right buttons to skip a scene or close the tour.

## Testing without a real phone line

The emulator can fake calls and texts, so nothing needs a real account:

```bash
adb shell cmd notification allow_listener com.callcanary.app/com.callcanary.app.messages.MessageWatcher
adb emu sms send 8885550166 "Chase alert: your account is locked. Verify at chase-secure-login.top/verify"
adb emu gsm call 4155550142        # unknown caller: the "Protect this call" notification appears
```

On the emulator, Android 15 hides all message text from notification listeners. Allow it once (then toggle access off and on):
`adb shell appops set com.callcanary.app RECEIVE_SENSITIVE_NOTIFICATIONS allow`.

To test live listening with a recorded scam call instead of a microphone (debug builds only), drop 16 kHz mono PCM in the app's files; it plays once, at real-time speed, through the same recognizer:

```bash
ffmpeg -i ../public/demo/live-call.mp3 -ar 16000 -ac 1 -f s16le live-call.pcm
adb push live-call.pcm /data/local/tmp/ && adb shell run-as com.callcanary.app cp /data/local/tmp/live-call.pcm files/test-call.pcm
# then Home → Protect a call I'm on → Start listening
```

## Build

Requirements: JDK 17 or 21 (not newer: Gradle 8.11 can't run on JDK 24; Android Studio's bundled JDK works) and the Android SDK (platform 35, build tools 35). Put the SDK path in `local.properties` (`sdk.dir=…`).

```bash
./gradlew testDebugUnitTest   # unit tests: numbers, screening rules, FTC list, checker parsing
./gradlew assembleDebug       # → app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Try it on the emulator

```bash
emulator -avd <your-avd>
adb install -r app/build/outputs/apk/debug/app-debug.apk
# Open CallCanary → "Turn on call screening" → choose CallCanary → Set as default.
adb emu gsm call 2012663840     # on the FTC list → blocked, notification appears
adb emu gsm call 4155550142     # not listed → rings normally (adb emu gsm cancel 4155550142)
adb shell am start -a android.intent.action.SEND -t text/plain \
  --es android.intent.extra.TEXT "Secure your account: https://rnicrosoft.com/verify" -n com.callcanary.app/.CheckActivity
```

On a real phone: enable *Install unknown apps* for your file manager or browser, copy the APK over and open it.
