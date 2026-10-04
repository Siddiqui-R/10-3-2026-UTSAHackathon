import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Check an email | CallCanary",
  description: "Paste a suspicious email or link. CallCanary shows where links really go, spelling mistakes and fake senders.",
};
export default function EmailLayout({ children }: { children: React.ReactNode }) { return children; }
