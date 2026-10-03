import Image from "next/image";
export type MascotMood = "sleeping" | "alert" | "concerned" | "warning" | "speaking";
const descriptions: Record<MascotMood, string> = {
  sleeping: "CallCanary asleep — protection is off",
  alert: "CallCanary awake and listening, your masked yellow canary protector",
  concerned: "CallCanary looking concerned while it checks the call",
  warning: "CallCanary on alert with a scam warning",
  speaking: "CallCanary speaking its scam warning",
};
// Two drawings, five moods: motion and a small badge carry the difference, and still read with reduced motion.
export default function Mascot({ mood }: { mood: MascotMood }) {
  return <div className={`mascot mascot-${mood}`} role="img" aria-label={descriptions[mood]}>
    {mood === "alert" && <span className="mascot-ears" aria-hidden="true" />}
    {mood === "concerned" && <span className="mascot-badge mascot-badge-concerned" aria-hidden="true">?</span>}
    {(mood === "warning" || mood === "speaking") && <span className="mascot-badge mascot-badge-warning" aria-hidden="true">!</span>}
    <Image src={mood === "sleeping" ? "/mascot-sleeping.png" : "/mascot.png"} alt="" width={400} height={400} priority />
    <span className="mascot-shadow" aria-hidden="true" />
  </div>;
}
