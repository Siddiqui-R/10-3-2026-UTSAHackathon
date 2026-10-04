import type { Metadata, Viewport } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import Providers from "@/components/Providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const display = Manrope({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display", display: "swap" });
const body = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "CallCanary | Phone scam protection",
  description: "Your canary in the coal mine for phone scams.",
  icons: { icon: "/shield.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#145c3a" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body><Providers>{children}</Providers><Toaster /></body>
    </html>
  );
}
