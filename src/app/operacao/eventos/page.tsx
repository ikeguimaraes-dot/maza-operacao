import { getCurrentUnit } from "@kph/auth/unit";
import { redirect } from "next/navigation";

const MEET_AND_EAT = "674eac8c-5a38-4a42-aa60-0a666387909b";

export default async function EventosPage() {
  const unit = await getCurrentUnit();
  if (unit?.id !== MEET_AND_EAT) redirect("/operacao");

  return (
    <iframe
      src="/eventos/index.html"
      style={{ width: "100%", height: "calc(100vh - 64px)", border: "none" }}
      title="Gestão de Eventos"
    />
  );
}
