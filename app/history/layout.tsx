import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Recent checks | CallCanary",
  description: "Calls, numbers and emails CallCanary checked, saved only on this device.",
};
export default function HistoryLayout({ children }: { children: React.ReactNode }) { return children; }
