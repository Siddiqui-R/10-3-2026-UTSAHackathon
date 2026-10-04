import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Bricolage_Grotesque } from "next/font/google";
import Providers from "@/components/Providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Display: characterful grotesque with optical sizing for big headings. Body: designed by the Braille Institute for low vision.
const display = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz", "wdth"], variable: "--font-display", display: "swap" });
const body = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "CallCanary | Phone scam protection",
  description: "Your canary in the coal mine for phone scams.",
  icons: { icon: "/shield.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0c1f16" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body><Providers>{children}</Providers><Toaster /></body>
    </html>
  );
}
