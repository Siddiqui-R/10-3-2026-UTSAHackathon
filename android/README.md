# CallCanary for Android

A native Android app (Kotlin, Jetpack Compose) that brings CallCanary's protection onto the phone itself.

## What it does

- **Screens and blocks calls.** CallCanary asks to become Android's *caller ID & spam app* (the call screening role, Android 10+). Android then hands it every incoming call from a number that isn't in your contacts. Within milliseconds, on the phone, it checks:
  1. your own block list, then
  2. the FTC Do Not Call complaint list (about 196,000 numbers, bundled from `../data/ftc-reported-numbers.tsv.gz`, the same file the website uses; works offline).

  A match is rejected before the phone rings (or silenced, if you prefer), and CallCanary posts a notification with the reason, e.g. *"Blocked a scam call from (201) 266-3840 · Reported to the FTC 5 times"*. Contacts' calls are never screened, and numbers are never uploaded.
- **Checks links, texts and emails.** Share anything to CallCanary, select text and tap *Check with CallCanary*, or paste it in the Check tab. It's sent to the website's checker (`/api/analyze-email`): real link checks (look-alike domains like rnicrosoft.com, mismatched links, risky endings, shorteners) plus the AI for typos, fake senders and pressure tricks.
- **Block list, activity and settings:** add or remove numbers; see recent blocked/allowed calls and checks; choose reject vs silence, whether to block FTC-reported numbers, and whether to block hidden numbers.

What it can't do: Android doesn't let third-party apps hear call audio, so in-call listening stays on the website (with the call on speaker, ideally on a second device).

## Build

Requirements: JDK 17 or 21 and the Android SDK (platform 35, build tools 35). Put the SDK path in `local.properties` (`sdk.dir=…`).

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
