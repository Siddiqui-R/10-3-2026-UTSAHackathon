"use client";
import { useEffect, useState } from "react";
import { MessageSquare, Phone, Share2, Shield, Trash2, Flag } from "lucide-react";
import type { Analysis } from "@/lib/analysis";

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
// A website cannot block numbers, edit call history or send texts by itself. These actions open the phone's own
// apps or show steps, and never claim that anything happened.
export default function SafetyActions({ result }: { result: Analysis }) {
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
  const toggle = (next: Panel) => setPanel(current => current === next ? null : next);
  const steps = (title: string, list: string[], note: string) => <div className="steps-card" role="region" aria-label={title}>
    <h3>{title}</h3><ol>{list.map(step => <li key={step}>{step}</li>)}</ol><p>{note}</p></div>;
  return <>
    <div className="action-grid" aria-label="Call safety actions">
      <button className="takeover-action" aria-expanded={panel === "block"} onClick={() => toggle("block")}><Shield size={28} />Block this number</button>
      <button className="takeover-action" aria-expanded={panel === "delete"} onClick={() => toggle("delete")}><Trash2 size={28} />Delete this call</button>
      <button className="takeover-action" aria-expanded={panel === "contact"} onClick={() => toggle("contact")}><Phone size={28} />Tell someone I trust</button>
      <button className="takeover-action" aria-expanded={panel === "report"} onClick={() => toggle("report")}><Flag size={28} />Report this scam</button>
    </div>
    {panel === "block" && steps("How to block this number", blockSteps[platform], "CallCanary is a website, so it can't block numbers for you. These steps use your phone's own blocking.")}
    {panel === "delete" && steps("How to delete this call", deleteSteps[platform], "CallCanary can't change your call history. Deleting is optional — blocking matters more.")}
    {panel === "contact" && <div className="steps-card" role="region" aria-label="Tell someone you trust">
      <h3>Tell someone you trust</h3>
      <div className="contact-form">
        <label htmlFor="contact-name">Their name</label>
        <input id="contact-name" autoComplete="name" value={contact.name} onChange={event => saveContact({ ...contact, name: event.target.value })} placeholder="e.g. Maria" />
        <label htmlFor="contact-phone">Their phone number</label>
        <input id="contact-phone" type="tel" inputMode="tel" autoComplete="tel" value={contact.phone} onChange={event => saveContact({ ...contact, phone: event.target.value })} placeholder="e.g. 210 555 0100" />
      </div>
      <div className="contact-links">
        {digits.length >= 7 ? <>
          <a href={smsHref}><MessageSquare size={24} />Write a text to {contact.name || "them"}</a>
          <a className="secondary" href={`tel:${digits}`}><Phone size={24} />Call {contact.name || "them"}</a>
        </> : <p>Enter a phone number to text or call them.</p>}
        {canShare && <button className="secondary" onClick={() => void navigator.share({ text: message }).catch(() => {})}><Share2 size={24} />Share with another app</button>}
      </div>
      <p>This opens your own messaging or phone app with the message ready. Nothing is sent until you press Send there. The number is saved only on this device.</p>
    </div>}
    {panel === "report" && <div className="steps-card" role="region" aria-label="Report this scam">
      <h3>Report this scam</h3>
      <ol><li>Report it to the FTC at <a href="https://reportfraud.ftc.gov" target="_blank" rel="noreferrer">ReportFraud.ftc.gov</a>.</li>
        <li>Free help from the AARP Fraud Watch Helpline: <a href="tel:18779083360">877-908-3360</a>.</li>
        <li>If you already paid or shared bank details, call your bank using the number on your card.</li></ol>
      <p>CallCanary does not send reports for you.</p>
    </div>}
  </>;
}
