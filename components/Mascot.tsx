import Image from "next/image";
export default function Mascot({ speaking = false, alert = false, sleeping = false }: { speaking?: boolean; alert?: boolean; sleeping?: boolean }) {
  return <div className={`mascot ${speaking ? "mascot-speaking" : ""} ${alert ? "mascot-alert" : ""}`}>
    <Image src={sleeping ? "/mascot-sleeping.png" : "/mascot.png"} alt={sleeping ? "CallCanary sleeping — protection is off" : "CallCanary awake, your yellow canary protector wearing a black mask"} width={400} height={400} priority />
    <span className="mascot-shadow" aria-hidden="true" />
  </div>;
}
