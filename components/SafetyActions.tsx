"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChatText, Flag, Phone, ShareNetwork, ShieldSlash, Trash } from "@phosphor-icons/react";
import type { Analysis } from "@/lib/analysis";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Platform = "ios" | "android" | "other";
type Panel = "block" | "delete" | "contact" | "report" | null;
const CONTACT_KEY = "callcanary.trustedContact";
const scamNames: Record<Analysis["scam_type"], string> = {
  irs: "a fake government or tax call", romance: "a romance money scam", tech_support: "a fake tech-support call",
  lottery: "a fake prize or lottery call", phishing: "a phishing message", other: "a scam", none: "a scam",
};
function detectPlatform(): Platform {
  const agent = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1)) return "ios";
  return /Android/.test(agent) ? "android" : "other";
}
const blockSteps: Record<Platform, string[]> = {
  ios: ["Open the Phone app and tap Recents.", "Find this call and tap the ⓘ button next to it.", "Scroll down and tap Block this Caller, then Block Contact."],
  android: ["Open the Phone app and tap Recents.", "Press and hold this call.", "Tap Block / report spam, then tap Block."],
  other: ["iPhone: Phone app → Recents → ⓘ next to the call → Block this Caller.", "Android: Phone app → Recents → press and hold the call → Block / report spam.", "Home phone: ask your phone company about call blocking."],
};
const deleteSteps: Record<Platform, string[]> = {
  ios: ["Open the Phone app and tap Recents.", "Swipe left on this call.", "Tap Delete."],
  android: ["Open the Phone app and tap Recents.", "Press and hold this call.", "Tap Delete, then confirm."],
  other: ["iPhone: Phone app → Recents → swipe left on the call → Delete.", "Android: Phone app → Recents → press and hold the call → Delete."],
};
const actions = [
  { id: "block", label: "Block this number", Icon: ShieldSlash },
  { id: "delete", label: "Delete this call", Icon: Trash },
  { id: "contact", label: "Tell someone I trust", Icon: Phone },
  { id: "report", label: "Report this scam", Icon: Flag },
] as const;
// A website cannot block numbers, edit call history or send texts by itself. These actions open the phone's own
// apps or show steps, and never claim that anything happened.
export default function SafetyActions({ result, tone = "light" }: { result: Analysis; tone?: "light" | "alarm" }) {
  const [platform, setPlatform] = useState<Platform>("other");
  const [panel, setPanel] = useState<Panel>(null);
  const [contact, setContact] = useState({ name: "", phone: "" });
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setPlatform(detectPlatform()); setCanShare(typeof navigator.share === "function");
    try { const saved = JSON.parse(localStorage.getItem(CONTACT_KEY) || "null"); if (saved?.phone) setContact(saved); } catch { /* storage unavailable */ }
  }, []);
  function saveContact(next: typeof contact) {
    setContact(next);
    try { localStorage.setItem(CONTACT_KEY, JSON.stringify(next)); } catch { /* storage unavailable: still usable this visit */ }
  }
  const message = `CallCanary warning: I just got what looks like ${scamNames[result.scam_type]}. I have hung up. Can you call me when you get this?`;
  const digits = contact.phone.replace(/[^\d+]/g, "");
  const smsHref = `sms:${digits}${platform === "ios" ? "&" : "?"}body=${encodeURIComponent(message)}`;
  const steps = (title: string, list: string[], note: string) => <Card><CardHeader className="pb-2"><CardTitle>{title}</CardTitle></CardHeader>
    <CardContent className="grid gap-3 text-left"><ol className="list-decimal space-y-2 pl-6 text-xl leading-relaxed">{list.map(step => <li key={step}>{step}</li>)}</ol>
      <p className="text-lg text-muted-foreground">{note}</p></CardContent></Card>;
  return <div className="grid w-full gap-4">
    <div className="grid grid-cols-2 gap-3" role="group" aria-label="Call safety actions">
      {actions.map(({ id, label, Icon }) => <Button key={id} variant={tone === "alarm" ? "outline" : "outline-danger"} aria-expanded={panel === id}
        onClick={() => setPanel(current => current === id ? null : id)}
        className={cn("h-auto min-h-[104px] flex-col whitespace-normal py-4 text-lg leading-tight",
          tone === "alarm" && "border-white bg-white text-destructive hover:bg-white/90", panel === id && "ring-4 ring-ring")}>
        <Icon size={32} weight={panel === id ? "fill" : "bold"} aria-hidden="true" />{label}
      </Button>)}
    </div>
    <AnimatePresence mode="wait" initial={false}>
      {panel && <motion.div key={panel} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="text-foreground">
        {panel === "block" && steps("How to block this number", blockSteps[platform], "CallCanary is a website, so it can't block numbers for you. These steps use your phone's own blocking.")}
        {panel === "delete" && steps("How to delete this call", deleteSteps[platform], "CallCanary can't change your call history. Deleting is optional — blocking matters more.")}
        {panel === "contact" && <Card><CardHeader className="pb-2"><CardTitle>Tell someone you trust</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-left">
            <Label htmlFor="contact-name">Their name</Label>
            <Input id="contact-name" autoComplete="name" value={contact.name} onChange={event => saveContact({ ...contact, name: event.target.value })} placeholder="e.g. Maria" />
            <Label htmlFor="contact-phone">Their phone number</Label>
            <Input id="contact-phone" type="tel" inputMode="tel" autoComplete="tel" value={contact.phone} onChange={event => saveContact({ ...contact, phone: event.target.value })} placeholder="e.g. 210 555 0100" />
            <div className="grid gap-3 pt-1">
              {digits.length >= 7 ? <>
                <Button asChild size="lg"><a href={smsHref}><ChatText weight="bold" />Write a text to {contact.name || "them"}</a></Button>
                <Button asChild size="lg" variant="secondary"><a href={`tel:${digits}`}><Phone weight="bold" />Call {contact.name || "them"}</a></Button>
              </> : <p className="text-lg text-muted-foreground">Enter a phone number to text or call them.</p>}
              {canShare && <Button size="lg" variant="outline" onClick={() => void navigator.share({ text: message }).catch(() => {})}><ShareNetwork weight="bold" />Share with another app</Button>}
            </div>
            <p className="text-lg text-muted-foreground">This opens your own messaging or phone app with the message ready. Nothing is sent until you press Send there. The number is saved only on this device.</p>
          </CardContent></Card>}
        {panel === "report" && <Card><CardHeader className="pb-2"><CardTitle>Report this scam</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-left">
            <ol className="list-decimal space-y-2 pl-6 text-xl leading-relaxed">
              <li>Report it to the FTC at <a className="font-bold text-primary underline" href="https://reportfraud.ftc.gov" target="_blank" rel="noreferrer">ReportFraud.ftc.gov</a>.</li>
              <li>Free help from the AARP Fraud Watch Helpline: <a className="font-bold text-primary underline" href="tel:18779083360">877-908-3360</a>.</li>
              <li>If you already paid or shared bank details, call your bank using the number on your card.</li></ol>
            <p className="text-lg text-muted-foreground">CallCanary does not send reports for you.</p>
          </CardContent></Card>}
      </motion.div>}
    </AnimatePresence>
  </div>;
}
