import { Suspense } from "react";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const ROLES_PERMITIDOS = ["operacao"] as const;

export default async function ManutencaoPage() {
  const user = await requireUser();
  const temAcesso = user.roles.some((r) =>
    (ROLES_PERMITIDOS as readonly string[]).includes(r.role),
  );
  if (!temAcesso) redirect("/operacao");

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <Suspense
        fallback={
          <div style={{ color: "var(--text-3)", fontSize: 13 }}>
            Carregando…
          </div>
        }
      >
        <ManutencaoSection />
      </Suspense>
    </div>
  );
}

async function ManutencaoSection() {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div
        style={{
          color: "var(--text-3)",
          fontSize: 13,
          padding: "32px 0",
          textAlign: "center",
        }}
      >
        Selecione uma unidade no topo para ver a manutenção.
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
        Manutenção
      </h1>
      <div
        style={{
          color: "var(--text-3)",
          fontSize: 13,
          padding: "32px 0",
          textAlign: "center",
        }}
      >
        Em construção.
      </div>
    </div>
  );
}
