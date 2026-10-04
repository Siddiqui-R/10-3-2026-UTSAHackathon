import { at } from "@/lib/utils";
// The coal band at the top of each page. Content below overlaps its lower edge (-mt-10 on the next block).
export default function PageHero({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle?: string; children?: React.ReactNode }) {
  return <section className="mine px-4 pb-20 pt-9 text-center">
    <div className="mx-auto grid max-w-3xl justify-items-center gap-3">
      <p className="reveal text-sm font-bold uppercase tracking-[0.18em] text-lamp" style={at(0)}>{eyebrow}</p>
      <h1 className="reveal text-balance font-display text-[clamp(2.5rem,10vw,4.25rem)] font-extrabold leading-[0.95] tracking-[-0.025em] [font-stretch:86%]" style={at(1)}>{title}</h1>
      {subtitle && <p className="reveal max-w-xl text-pretty text-xl leading-relaxed text-[#d6e2d0]" style={at(2)}>{subtitle}</p>}
      {children}
    </div>
  </section>;
}
