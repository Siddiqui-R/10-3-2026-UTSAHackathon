import { DEMO_PHISHING_EMAIL } from "./demoTranscripts";
// Sample data for the phone-app demo (/demo). The checks on this data are real: the email analyzer, link checker,
// FTC number list and call screener all run. Only the phone integrations (Gmail access, blocking) are simulated.
export type DemoEmail = { id: string; from: string; address: string; subject: string; preview: string; time: string; text: string; link?: { label: string; href: string } };
export const DEMO_EMAILS: DemoEmail[] = [
  { id: "paypal", from: "PayPal Support", address: "support@paypa1-secure.ru", subject: "Urgent: Your PayPal account has been suspended",
    preview: "We have detected unusual activty on your account…", time: "9:12 AM", text: DEMO_PHISHING_EMAIL,
    link: { label: "www.paypal.com/signin", href: "https://paypa1-secure.ru/verify" } },
  { id: "sarah", from: "Sarah Miller", address: "sarah.miller@gmail.com", subject: "Photos from the lake",
    preview: "Hi Mom! Here are the photos from our trip…", time: "8:47 AM",
    text: "From: Sarah Miller <sarah.miller@gmail.com>\nSubject: Photos from the lake\n\nHi Mom! Here are the photos from our trip: https://photos.google.com/share/lake2026\nThe kids loved the boat. Are we still on for dinner Sunday? Love, Sarah",
    link: { label: "photos.google.com/share/lake2026", href: "https://photos.google.com/share/lake2026" } },
  { id: "pharmacy", from: "CVS Pharmacy", address: "noreply@cvs.com", subject: "Your prescription is ready",
    preview: "Your refill is ready for pickup at your usual store.", time: "Yesterday",
    text: "From: CVS Pharmacy <noreply@cvs.com>\nSubject: Your prescription is ready\n\nYour refill is ready for pickup at your usual CVS. Bring your ID. Questions? Call your store or visit https://www.cvs.com/pharmacy" },
];
// Arrives live during the tour, then gets scanned.
export const DEMO_LIVE_EMAIL: DemoEmail = {
  id: "microsoft", from: "Microsoft Account Team", address: "no-reply@rnicrosoft-support.com", subject: "Unusual sign-in activity",
  preview: "We detected a sign-in from a new device. Secure your account now…", time: "Now",
  text: `From: Microsoft Account Team <no-reply@rnicrosoft-support.com>
Subject: Unusual sign-in activity

<p>We detected a sign-in to your Microsoft account from a new device in another country.</p>
<p>If this wasn't you, <a href="https://rnicrosoft.com/account/verify">Secure your account</a> now.</p>
<p>If you do not verify within 24 hours your account will be permanantly locked and your files deleted.</p>
<p>Microsoft Account Team</p>`,
  link: { label: "Secure your account", href: "https://rnicrosoft.com/account/verify" },
};
export const DEMO_TEXT = {
  from: "+1 (833) 555-0172", time: "10:03 AM",
  text: "USPS: Your package could not be delivered due to an incomplete address. Pay the $0.30 redelivery fee today: usps-track-secure.ru/pay",
  link: "https://usps-track-secure.ru/pay",
};
// A real number from the bundled FTC complaint list (tests keep it listed).
export const DEMO_ROBOCALL = { number: "(201) 266-3840" };
export const DEMO_SCREEN_CALL = { number: "(415) 555-0142", audio: "/demo/screen-scam.mp3",
  caption: "Hello, this is Officer Daniels with the IRS. There's a warrant out for your arrest over unpaid taxes. You need to pay today with Apple gift cards, and do not tell anyone about this call." };
export const DEMO_SITES = ["rnicrosoft.com", "paypa1.com", "bit.ly/3xPrize", "apple-support-center.com", "microsoft.com"];
export type TourScene = { id: string; title: string; caption: string };
export const TOUR: TourScene[] = [
  { id: "home", title: "Protected home", caption: "CallCanary lives on your phone and watches your calls, texts, email and web." },
  { id: "gmail", title: "Gmail scan", caption: "Connect Gmail and CallCanary checks every email, moving phishing to Scam." },
  { id: "web", title: "Scam website blocked", caption: "rnicrosoft.com looks like Microsoft. CallCanary sees the trick and blocks it." },
  { id: "text", title: "Scam text", caption: "Texts with fake delivery fees and look-alike links are flagged." },
  { id: "robocall", title: "Reported robocall", caption: "Numbers reported to the FTC are blocked before your phone rings." },
  { id: "screener", title: "AI call screener", caption: "Unknown callers talk to CallCanary first. Its AI decides if it's a scam." },
  { id: "blocked", title: "Blocked list", caption: "Every blocked number, website and sender, with the reason why." },
];
