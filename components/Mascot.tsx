import Image from "next/image";
export default function Mascot({ speaking = false, alert = false }: { speaking?: boolean; alert?: boolean }) {
  return <div className={`mascot ${speaking ? "mascot-speaking" : ""} ${alert ? "mascot-alert" : ""}`}>
    <Image src="/mascot.png" alt="CallCanary, your yellow canary protector wearing a black mask" width={400} height={400} priority />
    <span className="mascot-shadow" aria-hidden="true" />
  </div>;
}
