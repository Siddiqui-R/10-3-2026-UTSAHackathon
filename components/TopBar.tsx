"use client";
import Link from "next/link";
import { ClockCounterClockwise, DeviceMobile, EnvelopeSimple, Ear, PhoneIncoming, ShieldCheck } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Tool = "call" | "email" | "demo" | "screen" | "history";
// Four large tabs within thumb reach, like a phone app. The app demo stays one tap away in the header.
const tabs: { id: Exclude<Tool, "demo">; href: string; label: string; Icon: typeof Ear }[] = [
  { id: "screen", href: "/screen", label: "Screen", Icon: PhoneIncoming },
  { id: "call", href: "/", label: "Listen", Icon: Ear },
  { id: "email", href: "/email", label: "Email", Icon: EnvelopeSimple },
  { id: "history", href: "/history", label: "Recent", Icon: ClockCounterClockwise },
];
export default function TopBar({ active, children }: { active: Tool; children?: React.ReactNode }) {
  return <>
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b-2 border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-3xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg font-display text-2xl font-extrabold text-[hsl(152_71%_15%)]">
          <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck size={28} weight="fill" /></span>
          CallCanary
        </Link>
        <div className="flex items-center gap-2">
          {children}
          <Link href="/demo" aria-current={active === "demo" ? "page" : undefined}
            aria-label="App demo" className={cn("inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border-2 px-3 text-sm font-bold",
              active === "demo" ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted")}>
            <DeviceMobile size={22} weight={active === "demo" ? "fill" : "regular"} aria-hidden="true" /><span className="hidden sm:inline">App demo</span>
          </Link>
        </div>
      </div>
    </header>
    <nav aria-label="CallCanary tools" className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-card pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-6px_20px_rgba(0,0,0,0.06)]">
      <ul className="mx-auto grid max-w-3xl grid-cols-4 gap-1 px-2 pt-2 pb-2">
        {tabs.map(({ id, href, label, Icon }) => {
          const on = active === id;
          return <li key={id}>
            <Link href={href} aria-current={on ? "page" : undefined}
              className={cn("flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl text-[15px] font-bold transition-colors",
                on ? "bg-secondary text-[hsl(152_71%_15%)]" : "text-muted-foreground hover:bg-muted")}>
              <Icon size={30} weight={on ? "fill" : "regular"} aria-hidden="true" />{label}
            </Link>
          </li>;
        })}
      </ul>
    </nav>
  </>;
}
