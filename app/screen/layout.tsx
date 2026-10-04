import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Screen a caller | CallCanary",
  description: "CallCanary answers first, asks who is calling and why, and checks the number against FTC complaints.",
};
export default function ScreenLayout({ children }: { children: React.ReactNode }) { return children; }
