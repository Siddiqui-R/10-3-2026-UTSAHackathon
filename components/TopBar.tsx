import Link from "next/link";
import { Mail, Phone, PhoneIncoming, ShieldCheck, LayoutDashboard } from "lucide-react";
type Tool = "call" | "email" | "demo" | "screen";
const tools: { id: Tool; href: string; label: string; Icon: typeof Phone }[] = [
  { id: "demo", href: "/demo", label: "App demo", Icon: LayoutDashboard },
  { id: "screen", href: "/screen", label: "Screen a caller", Icon: PhoneIncoming },
  { id: "call", href: "/", label: "Listen to a call", Icon: Phone },
  { id: "email", href: "/email", label: "Check an email", Icon: Mail },
];
export default function TopBar({ active, children }: { active: Tool; children?: React.ReactNode }) {
  return <header className="topbar-wrap">
    <div className="topbar"><div className="brand"><div className="brand-mark"><ShieldCheck size={28} /></div>CallCanary</div>{children}</div>
    <nav className="tabs" aria-label="CallCanary tools">
      {tools.map(({ id, href, label, Icon }) => <Link key={id} href={href} className={active === id ? "tab tab-active" : "tab"} aria-current={active === id ? "page" : undefined}><Icon size={24} />{label}</Link>)}
    </nav>
  </header>;
}
