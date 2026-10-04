import type { TrustedContact } from "./contacts";
// Sample callers for "Screen a caller". Each plays a recorded reply (public/demo/screen-*.mp3, made by
// scripts/make-screen-demos.mjs) through the real checks: ElevenLabs transcription, the FTC list and Gemini.
export const DEMO_CONTACTS: TrustedContact[] = [{ name: "Jake", phone: "2105550147" }];
export const SCREEN_DEMOS = [
  { id: "scam", label: "IRS scam caller", phone: "(415) 555-0142", audio: "/demo/screen-scam.mp3", voice: ["Brian", "Daniel", "Roger"],
    text: "Hello, this is Officer Daniels with the IRS. There's a warrant out for your arrest over unpaid taxes. You need to pay today with Apple gift cards, and do not tell anyone about this call." },
  { id: "family", label: "Grandson Jake (saved)", phone: "(210) 555-0147", audio: "/demo/screen-family.mp3", voice: ["Liam", "Will", "Charlie"],
    text: "Hi Grandma, it's Jake! I'm just calling to see if you still want to get lunch on Saturday. Call me back when you can. Love you." },
  { id: "impostor", label: "Someone claiming to be Jake", phone: "(737) 555-0199", audio: "/demo/screen-impostor.mp3", voice: ["Chris", "Eric", "Callum"],
    text: "Hi Grandma, it's Jake. I got a new phone, so this is my new number. Can you call me back on this one? I need to ask you something important." },
  // A real number from the bundled FTC complaint list (tests check it is still listed after a refresh).
  { id: "reported", label: "Caller from a reported number", phone: "(201) 266-3840", audio: "/demo/screen-reported.mp3", voice: ["George", "Bill", "Adam"],
    text: "Hello, this is Mark from Senior Benefits Services, calling about your Medicare card. Please call us back at your earliest convenience." },
] as const;
export type ScreenDemo = typeof SCREEN_DEMOS[number];
