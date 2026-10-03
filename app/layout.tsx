import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CallCanary | Phone scam protection",
  description: "Your canary in the coal mine for phone scams.",
  icons: { icon: "/shield.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
