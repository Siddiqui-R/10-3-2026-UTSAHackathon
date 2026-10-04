import Link from "next/link";
import { Mail, Phone, ShieldCheck, LayoutDashboard } from "lucide-react";
export default function TopBar({ active, children }: { active: "call" | "email" | "demo"; children?: React.ReactNode }) {
  return <header className="topbar-wrap">
    <div className="topbar"><div className="brand"><div className="brand-mark"><ShieldCheck size={28} /></div>CallCanary</div>{children}</div>
    <nav className="tabs" aria-label="CallCanary tools">
      <Link href="/demo" className={active === "demo" ? "tab tab-active" : "tab"} aria-current={active === "demo" ? "page" : undefined}><LayoutDashboard size={24} />App demo</Link>
      <Link href="/" className={active === "call" ? "tab tab-active" : "tab"} aria-current={active === "call" ? "page" : undefined}><Phone size={24} />Listen to a call</Link>
      <Link href="/email" className={active === "email" ? "tab tab-active" : "tab"} aria-current={active === "email" ? "page" : undefined}><Mail size={24} />Check an email</Link>
    </nav>
  </header>;
}
