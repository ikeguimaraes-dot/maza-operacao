import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const ROLES_PERMITIDOS = ["operacao", "founder", "administrativo"] as const;

export default async function PedidosPage() {
  const user = await requireUser();
  const temAcesso = user.roles.some((r) =>
    (ROLES_PERMITIDOS as readonly string[]).includes(r.role),
  );
  if (!temAcesso) redirect("/operacao");

  const unit = await getCurrentUnit();

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Operação · Pedidos
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            margin: "6px 0 4px",
            color: "var(--text)",
            letterSpacing: -0.4,
          }}
        >
          Pedidos
        </h1>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            margin: 0,
            lineHeight: 1.55,
            maxWidth: 720,
          }}
        >
          {unit ? `Unidade: ${unit.name}` : "Selecione uma unidade no topo para ver os pedidos."}
        </p>
      </header>

      <div
        style={{
          background: "var(--surface)",
          border: "1px dashed var(--border)",
          borderRadius: 8,
          padding: "32px 22px",
          textAlign: "center",
          color: "var(--text-3)",
          fontSize: 13,
        }}
      >
        Módulo de Pedidos em construção.
      </div>
    </div>
  );
}
