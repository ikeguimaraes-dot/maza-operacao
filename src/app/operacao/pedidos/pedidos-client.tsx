"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingBag, X, ChevronDown, ChevronRight } from "lucide-react";
import { formatDateBR } from "@/lib/format";
import type { PurchaseOrderItemRow, PurchaseOrderStatus } from "@kph/db/types/database";
import { criarPedido, deletarPedido } from "./actions";
import type { ProdutoCatalogo, PedidoComItens } from "./actions";

// ── Mapeamento de labels ─────────────────────────────────────────────────────

const LABEL_MAP: Record<string, string> = {
  proteina: "Proteína",
  verdura: "Verdura",
  legume: "Legume",
  fruta: "Fruta",
  graos: "Grãos e Cereais",
  laticinios: "Laticínios",
  panificacao: "Panificação",
  bebida_alcoolica: "Bebidas Alcoólicas",
  bebida_nao_alcoolica: "Bebidas Não Alcoólicas",
  tempero: "Tempero",
  oleo_gordura: "Óleo / Gordura",
  descartavel: "Descartável",
  limpeza: "Limpeza",
  outro: "Outros",
  hortifruti: "Hortifruti",
  proteinas: "Proteínas",
  secos: "Secos",
};

function getCatEmoji(cat: string): string {
  const c = cat.toLowerCase();
  if (c.includes("hortifruti")) return "🥬";
  if (c.includes("fruta") && !c.includes("fruto")) return "🍎";
  if (c.includes("bovino") || c.includes("proteina") || c.includes("carnes")) return "🥩";
  if (c.includes("queijo") || c.includes("latic")) return "🧀";
  if (c.includes("embutido")) return "🥓";
  if (c.includes("pescado") || c.includes("fruto")) return "🐟";
  if (c.includes("pao") || c.includes("pão") || c.includes("massa") || c.includes("salg")) return "🍞";
  if (c.includes("seco") || c.includes("conserva") || c.includes("grao") || c.includes("grão") || c.includes("panific")) return "🌾";
  if (c.includes("chopp") || c.includes("cerveja")) return "🍺";
  if (c.includes("vinho") || c.includes("destilado")) return "🍷";
  if ((c.includes("nao") || c.includes("não")) && c.includes("alco")) return "🧃";
  if (c.includes("alco")) return "🍷";
  if (c.includes("agua") || c.includes("água") || c.includes("cafe") || c.includes("café") || c.includes("lanche") || c.includes("suco")) return "☕";
  if (c.includes("bebida")) return "🧃";
  if (c.includes("alimenta") || c.includes("func")) return "🍱";
  if (c.includes("limpeza")) return "🧹";
  if (c.includes("descartav")) return "🗑️";
  if (c.includes("higiene")) return "🧴";
  if (c.includes("uniforme") || c.includes("epi")) return "👕";
  if (c.includes("escrit")) return "📎";
  if (c.includes("sistema") || c.includes("software")) return "💻";
  if (c.includes("combustivel") || c.includes("combustível")) return "⛽";
  return "📦";
}

const SUPPORTED_UNITS = ["kg", "g", "l", "ml", "un"] as const;
type SupportedUnit = (typeof SUPPORTED_UNITS)[number];

function normalizeUnidade(u: string): SupportedUnit {
  const lower = u.toLowerCase().trim();
  if ((SUPPORTED_UNITS as readonly string[]).includes(lower)) return lower as SupportedUnit;
  return "kg";
}

// ── Helpers do histórico ─────────────────────────────────────────────────────

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const parts = dateStr.split("-").map(Number);
      return new Date(parts[0]!, parts[1]! - 1, parts[2]!).toLocaleDateString("pt-BR");
    }
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function groupItemsByCategoria(
  items: PurchaseOrderItemRow[],
  produtosPorNome: Map<string, ProdutoCatalogo>,
): Map<string, PurchaseOrderItemRow[]> {
  const groups = new Map<string, PurchaseOrderItemRow[]>();
  for (const item of items) {
    const cat = produtosPorNome.get(item.nome)?.categoria ?? "";
    const label = (LABEL_MAP[cat] ?? cat) || "Outros";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  }
  return groups;
}

// ── Props / helpers ──────────────────────────────────────────────────────────

interface Props {
  unit: { id: string; name: string; brand_id: string | null };
  userId: string;
  produtos: ProdutoCatalogo[];
  pedidosIniciais: PedidoComItens[];
}

function StatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const map: Record<PurchaseOrderStatus, { background: string; color: string }> = {
    enviado:   { background: "#1D4ED8", color: "#fff" },
    recebido:  { background: "#15803D", color: "#fff" },
    parcial:   { background: "#92400E", color: "#fff" },
    cancelado: { background: "#7F1D1D", color: "#fff" },
    rascunho:  { background: "var(--surface-3)", color: "var(--text-3)" },
  };
  const s = map[status] ?? map.rascunho;
  return (
    <span
      style={{
        ...s,
        borderRadius: 99,
        padding: "2px 10px",
        fontSize: 11,
        fontWeight: 700,
        display: "inline-block",
        flexShrink: 0,
      }}
    >
      {status}
    </span>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export function PedidosClient({ unit, produtos, pedidosIniciais }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const categorias = useMemo(
    () => [...new Set(produtos.map((p) => p.categoria))].sort(),
    [produtos],
  );

  // ── Estado do formulário ──
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(
    categorias[0] ?? null,
  );
  const [busca, setBusca] = useState("");
  const [qtds, setQtds] = useState<Record<string, number>>({});
  const [unidades, setUnidades] = useState<Record<string, string>>({});
  const [observacoes, setObservacoes] = useState("");
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);

  // ── Estado do histórico ──
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deleteChecked, setDeleteChecked] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  // ── Dados derivados ──
  const carrinho = useMemo(
    () =>
      Object.entries(qtds)
        .filter(([, v]) => v > 0)
        .map(([nome, quantidade]) => ({
          ingrediente_id: nome,
          nome,
          quantidade,
          unidade: unidades[nome] ?? "kg",
        })),
    [qtds, unidades],
  );

  const produtosPorNome = useMemo(
    () => new Map(produtos.map((p) => [p.nome, p])),
    [produtos],
  );

  const pedidosVisiveis = useMemo(
    () => pedidosIniciais.filter((p) => !deletedIds.includes(p.id)),
    [pedidosIniciais, deletedIds],
  );

  const produtosFiltrados = useMemo(() => {
    if (busca.trim() === "") {
      return categoriaAtiva
        ? produtos.filter((p) => p.categoria === categoriaAtiva)
        : [];
    }
    return produtos.filter((p) =>
      p.nome.toLowerCase().includes(busca.toLowerCase().trim()),
    );
  }, [produtos, busca, categoriaAtiva]);

  // ── Handlers do formulário ──

  function getUnidade(prod: ProdutoCatalogo): string {
    return unidades[prod.nome] ?? normalizeUnidade(prod.unidade);
  }

  function handleCategoriaChange(cat: string) {
    setCategoriaAtiva(cat);
    setBusca("");
  }

  function handleQtdChange(nome: string, val: string) {
    const n = parseFloat(val);
    setQtds((prev) => ({ ...prev, [nome]: isNaN(n) || n < 0 ? 0 : n }));
  }

  function handleIncrement(prod: ProdutoCatalogo) {
    setQtds((prev) => ({ ...prev, [prod.nome]: (prev[prod.nome] ?? 0) + 1 }));
  }

  function handleDecrement(prod: ProdutoCatalogo) {
    setQtds((prev) => ({
      ...prev,
      [prod.nome]: Math.max(0, (prev[prod.nome] ?? 0) - 1),
    }));
  }

  function handleUnidadeChange(prod: ProdutoCatalogo, val: string) {
    setUnidades((prev) => ({ ...prev, [prod.nome]: val }));
  }

  function handleRemoverItem(nome: string) {
    setQtds((prev) => {
      const next = { ...prev };
      delete next[nome];
      return next;
    });
  }

  function handleEnviar() {
    startTransition(async () => {
      const result = await criarPedido(carrinho, observacoes || null);
      if (result.ok) {
        setQtds({});
        setObservacoes("");
        setCarrinhoAberto(false);
        toast.success("Pedido enviado com sucesso!");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  // ── Handlers do histórico ──

  function handlePdfExport(p: PedidoComItens) {
    const groups = groupItemsByCategoria(p.purchase_order_items, produtosPorNome);

    let categoriesHtml = "";
    for (const [cat, items] of groups) {
      const rows = items
        .map(
          (i) =>
            `<tr><td>${i.nome}</td><td style="text-align:center;width:60px">${i.quantidade}</td><td style="text-align:center;width:52px">${i.unidade ?? ""}</td></tr>`,
        )
        .join("");
      categoriesHtml += `
        <div class="cat">
          <div class="cat-title">${cat} <span class="cat-count">(${items.length})</span></div>
          <table><thead><tr><th>Item</th><th>Qtd</th><th>Un.</th></tr></thead><tbody>${rows}</tbody></table>
        </div>`;
    }

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Requisição – ${unit.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; padding: 32px; color: #111; font-size: 13px; }
  h1 { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 12px; }
  .meta { display: flex; gap: 32px; font-size: 12px; color: #555; margin-bottom: 16px; flex-wrap: wrap; }
  .meta strong { color: #111; }
  hr { border: none; border-top: 2px solid #111; margin: 16px 0 20px; }
  .cat { margin-bottom: 20px; }
  .cat-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #333; padding-bottom: 6px; border-bottom: 1px solid #ddd; margin-bottom: 8px; }
  .cat-count { font-weight: 400; color: #777; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.6px; padding: 3px 6px; border-bottom: 1px solid #eee; }
  td { padding: 5px 6px; border-bottom: 1px solid #f0f0f0; font-size: 12px; }
  .obs { background: #f7f7f7; border-left: 3px solid #ccc; padding: 10px 12px; margin-top: 20px; font-size: 12px; color: #555; font-style: italic; border-radius: 2px; }
  .footer { margin-top: 32px; font-size: 10px; color: #aaa; text-align: right; border-top: 1px solid #eee; padding-top: 8px; }
  @media print { @page { margin: 16mm; } }
</style>
</head>
<body>
  <h1>REQUISIÇÃO DE COMPRAS</h1>
  <div class="meta">
    <span><strong>Unidade:</strong> ${unit.name}</span>
    <span><strong>Data:</strong> ${formatDateTime(p.data_pedido)}</span>
    <span><strong>Nº:</strong> ${p.id.slice(0, 8).toUpperCase()}</span>
    <span><strong>Status:</strong> ${p.status}</span>
  </div>
  <hr>
  ${categoriesHtml}
  ${p.observacoes ? `<div class="obs">Obs: ${p.observacoes}</div>` : ""}
  <div class="footer">Gerado em ${new Date().toLocaleString("pt-BR")} via KPH-OS</div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=820,height=680");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  }

  async function handleDeleteConfirm(id: string) {
    setDeletingId(id);
    const result = await deletarPedido(id);
    setDeletingId(null);
    if (result.ok) {
      setDeletedIds((prev) => [...prev, id]);
      setConfirmingDelete(null);
      setDeleteChecked(false);
      toast.success("Pedido excluído.");
    } else {
      toast.error(result.error);
    }
  }

  const totalItens = carrinho.length;
  const footerResumo =
    totalItens === 0
      ? "Nenhum item adicionado"
      : carrinho
          .slice(0, 2)
          .map((i) => i.nome)
          .join(", ") + (totalItens > 2 ? ` +${totalItens - 2}` : "");

  // ── Estilos reutilizáveis ──

  const smallBtn = (active = true, danger = false) => ({
    height: 32,
    padding: "0 12px",
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid var(--border)",
    borderRadius: 6,
    background: danger ? "#7F1D1D" : "var(--surface-2)",
    color: danger ? "#FCA5A5" : active ? "var(--text-2)" : "var(--text-3)",
    cursor: active ? "pointer" : "not-allowed",
    opacity: active ? 1 : 0.4,
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  });

  return (
    <div>
      {/* ══ TRÊS ZONAS FIXAS ════════════════════════════════════════════════ */}
      <div
        style={{
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* HEADER ────────────────────────────────────────────────────────── */}
        <header
          style={{
            height: 64,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <input
            type="search"
            placeholder="Buscar produto…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{
              flex: 1,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              color: "var(--text)",
              fontSize: 15,
              padding: "10px 14px",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => setCarrinhoAberto(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 44,
              background: totalItens > 0 ? "var(--brand)" : "var(--surface-2)",
              color: totalItens > 0 ? "#fff" : "var(--text-2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "0 16px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            <ShoppingBag size={18} />
            {totalItens > 0 ? `Carrinho (${totalItens})` : "Carrinho"}
          </button>
        </header>

        {/* CONTEÚDO CENTRAL ───────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          {/* Coluna esquerda — Categorias */}
          <nav
            style={{
              width: 160,
              flexShrink: 0,
              overflowY: "auto",
              borderRight: "1px solid var(--border)",
              background: "var(--surface)",
              padding: "8px 6px",
            }}
          >
            {categorias.length === 0 ? (
              <div
                style={{ padding: 12, color: "var(--text-3)", fontSize: 12, textAlign: "center" }}
              >
                Nenhum produto.
              </div>
            ) : (
              categorias.map((cat) => {
                const isActive = cat === categoriaAtiva;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoriaChange(cat)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      width: "100%",
                      minHeight: 72,
                      padding: "10px 8px",
                      marginBottom: 4,
                      background: isActive ? "var(--brand)" : "var(--surface-2)",
                      border: "none",
                      borderRadius: 10,
                      color: isActive ? "#fff" : "var(--text-2)",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <span style={{ fontSize: 28, lineHeight: 1 }}>{getCatEmoji(cat)}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        lineHeight: 1.3,
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                      }}
                    >
                      {LABEL_MAP[cat] ?? cat}
                    </span>
                  </button>
                );
              })
            )}
          </nav>

          {/* Coluna direita — Produtos */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
            {!categoriaAtiva && busca.trim() === "" ? (
              <div
                style={{
                  color: "var(--text-3)",
                  fontSize: 14,
                  textAlign: "center",
                  paddingTop: 48,
                }}
              >
                Selecione uma categoria.
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div
                style={{
                  color: "var(--text-3)",
                  fontSize: 14,
                  textAlign: "center",
                  paddingTop: 48,
                }}
              >
                Nenhum produto encontrado.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {produtosFiltrados.map((prod) => {
                  const qty = qtds[prod.nome] ?? 0;
                  const inCart = qty > 0;
                  return (
                    <div
                      key={prod.nome}
                      style={{
                        minHeight: 72,
                        padding: "14px 16px",
                        background: "var(--surface)",
                        border: inCart
                          ? "1px solid var(--brand)"
                          : "1px solid var(--border)",
                        borderLeft: inCart
                          ? "3px solid var(--brand)"
                          : "1px solid var(--border)",
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                      }}
                    >
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: "var(--text)",
                            lineHeight: 1.3,
                          }}
                        >
                          {prod.nome}
                        </span>
                        {busca.trim() !== "" && (
                          <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                            {LABEL_MAP[prod.categoria] ?? prod.categoria}
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleDecrement(prod)}
                          disabled={qty <= 0}
                          style={{
                            width: 44, height: 44, display: "flex", alignItems: "center",
                            justifyContent: "center", border: "1px solid var(--border)",
                            borderRadius: 8, background: "var(--surface-2)", color: "var(--text)",
                            fontSize: 20, fontWeight: 700, flexShrink: 0,
                            cursor: qty <= 0 ? "not-allowed" : "pointer",
                            opacity: qty <= 0 ? 0.3 : 1,
                          }}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          value={qty === 0 ? "" : qty}
                          placeholder="0"
                          onChange={(e) => handleQtdChange(prod.nome, e.target.value)}
                          style={{
                            width: 52, height: 44, background: "var(--surface-2)",
                            border: "1px solid var(--border)", borderRadius: 8,
                            color: "var(--text)", fontSize: 16, fontWeight: 700,
                            textAlign: "center", outline: "none", padding: "0 4px",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleIncrement(prod)}
                          style={{
                            width: 44, height: 44, display: "flex", alignItems: "center",
                            justifyContent: "center", border: "1px solid var(--border)",
                            borderRadius: 8, background: "var(--surface-2)", color: "var(--text)",
                            fontSize: 20, fontWeight: 700, cursor: "pointer", flexShrink: 0,
                          }}
                        >
                          +
                        </button>
                        <select
                          value={getUnidade(prod)}
                          onChange={(e) => handleUnidadeChange(prod, e.target.value)}
                          style={{
                            height: 44, background: "var(--surface-2)",
                            border: "1px solid var(--border)", borderRadius: 8,
                            color: "var(--text-3)", fontSize: 13, fontWeight: 600,
                            padding: "0 6px", outline: "none", flexShrink: 0,
                          }}
                        >
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="l">l</option>
                          <option value="ml">ml</option>
                          <option value="un">un</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER ────────────────────────────────────────────────────────── */}
        <footer
          style={{
            height: 72,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "0 16px",
            borderTop: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: totalItens > 0 ? "var(--text-2)" : "var(--text-3)",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {footerResumo}
          </span>
          <button
            type="button"
            onClick={handleEnviar}
            disabled={totalItens === 0 || isPending}
            style={{
              height: 48,
              minWidth: 160,
              background: "#22C55E",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "0 24px",
              fontSize: 15,
              fontWeight: 700,
              cursor: totalItens === 0 || isPending ? "not-allowed" : "pointer",
              opacity: totalItens === 0 || isPending ? 0.4 : 1,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {isPending ? "Enviando…" : "Enviar Pedido"}
          </button>
        </footer>
      </div>

      {/* ══ CARRINHO DRAWER ═════════════════════════════════════════════════ */}
      {carrinhoAberto && (
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }}
            onClick={() => setCarrinhoAberto(false)}
          />
          <div
            style={{
              position: "fixed",
              top: 0, right: 0,
              height: "100dvh",
              width: 320,
              background: "var(--surface)",
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              boxShadow: "-8px 0 32px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0 16px", height: 64, borderBottom: "1px solid var(--border)", flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                Carrinho{totalItens > 0 ? ` (${totalItens})` : ""}
              </span>
              <button
                type="button"
                onClick={() => setCarrinhoAberto(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 8, display: "flex", alignItems: "center" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {carrinho.length === 0 ? (
                <div style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", paddingTop: 32 }}>
                  Nenhum item adicionado.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {carrinho.map((item) => (
                    <div
                      key={item.ingrediente_id}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8 }}
                    >
                      <span style={{ flex: 1, fontSize: 13, color: "var(--text)", lineHeight: 1.3 }}>
                        {item.nome}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={item.quantidade}
                        onChange={(e) => handleQtdChange(item.nome, e.target.value)}
                        style={{
                          width: 52, height: 36, background: "var(--surface)",
                          border: "1px solid var(--border)", borderRadius: 6,
                          color: "var(--text)", fontSize: 14, fontWeight: 700,
                          textAlign: "center", outline: "none", padding: "0 4px",
                        }}
                      />
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", minWidth: 22, textAlign: "center" }}>
                        {item.unidade}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoverItem(item.nome)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: 4, display: "flex", alignItems: "center", flexShrink: 0 }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 16 }}>
                <textarea
                  placeholder="Observações (opcional)…"
                  rows={3}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  style={{
                    width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)",
                    borderRadius: 8, color: "var(--text)", fontSize: 13, padding: "10px 12px",
                    outline: "none", resize: "vertical", boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
              <button
                type="button"
                onClick={handleEnviar}
                disabled={totalItens === 0 || isPending}
                style={{
                  width: "100%", height: 48, background: "#22C55E", color: "#fff",
                  border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700,
                  cursor: totalItens === 0 || isPending ? "not-allowed" : "pointer",
                  opacity: totalItens === 0 || isPending ? 0.4 : 1,
                }}
              >
                {isPending ? "Enviando…" : "Enviar Pedido"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══ HISTÓRICO ═══════════════════════════════════════════════════════ */}
      <div style={{ padding: "32px 16px" }}>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 24, marginBottom: 20 }}>
          <h2
            style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0, letterSpacing: -0.2 }}
          >
            Histórico de Pedidos
          </h2>
        </div>

        {pedidosVisiveis.length === 0 ? (
          <div style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
            Nenhum pedido encontrado para esta unidade.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {pedidosVisiveis.map((p) => {
              const isExpanded = expandedId === p.id;
              const isConfirming = confirmingDelete === p.id;
              const isDeleting = deletingId === p.id;

              return (
                <div
                  key={p.id}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  }}
                >
                  {/* Card header — clicável para expandir */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 10,
                      padding: "12px 16px",
                      cursor: "pointer",
                      borderBottom: isExpanded ? "1px solid var(--border)" : "none",
                      background: isExpanded ? "var(--surface-2)" : "var(--surface)",
                    }}
                  >
                    {/* Chevron */}
                    <span style={{ color: "var(--text-3)", display: "flex", flexShrink: 0 }}>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>

                    {/* Data */}
                    <span style={{ fontSize: 13, color: "var(--text-2)", flexShrink: 0 }}>
                      {formatDateTime(p.data_pedido)}
                    </span>

                    {/* Status */}
                    <StatusBadge status={p.status} />

                    {/* Contagem */}
                    <span style={{ fontSize: 12, color: "var(--text-3)", flexShrink: 0 }}>
                      {p.purchase_order_items.length} {p.purchase_order_items.length === 1 ? "item" : "itens"}
                    </span>

                    {/* Ações — stop propagation para não expandir/colapsar */}
                    <div
                      style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Botão PDF */}
                      <button
                        type="button"
                        onClick={() => handlePdfExport(p)}
                        style={smallBtn()}
                      >
                        📄 PDF
                      </button>

                      {/* Exclusão inline */}
                      {isConfirming ? (
                        <>
                          <label
                            style={{
                              display: "flex", alignItems: "center", gap: 6,
                              fontSize: 12, color: "var(--text-2)", cursor: "pointer", userSelect: "none",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={deleteChecked}
                              onChange={(e) => setDeleteChecked(e.target.checked)}
                            />
                            Confirmar exclusão
                          </label>
                          <button
                            type="button"
                            onClick={() => { setConfirmingDelete(null); setDeleteChecked(false); }}
                            style={smallBtn()}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={!deleteChecked || isDeleting}
                            onClick={() => handleDeleteConfirm(p.id)}
                            style={smallBtn(deleteChecked && !isDeleting, true)}
                          >
                            {isDeleting ? "Excluindo…" : "Excluir"}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setConfirmingDelete(p.id); setDeleteChecked(false); }}
                          style={smallBtn()}
                        >
                          🗑️ Excluir
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card body — expansível */}
                  {isExpanded && (
                    <div style={{ padding: "16px 20px" }}>
                      {p.purchase_order_items.length === 0 ? (
                        <div style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", padding: "8px 0" }}>
                          Sem itens registrados.
                        </div>
                      ) : (
                        Array.from(
                          groupItemsByCategoria(p.purchase_order_items, produtosPorNome),
                        ).map(([cat, items]) => (
                          <div key={cat} style={{ marginBottom: 16 }}>
                            {/* Título da categoria */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                paddingBottom: 6,
                                marginBottom: 6,
                                borderBottom: "1px solid var(--border)",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: "var(--text-3)",
                                  textTransform: "uppercase",
                                  letterSpacing: 0.7,
                                }}
                              >
                                {cat}
                              </span>
                              <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                                ({items.length})
                              </span>
                            </div>

                            {/* Linhas de itens */}
                            {items.map((item: PurchaseOrderItemRow) => (
                              <div
                                key={item.id}
                                style={{
                                  display: "flex",
                                  alignItems: "baseline",
                                  gap: 8,
                                  padding: "5px 0",
                                  borderBottom: "1px solid var(--border)",
                                }}
                              >
                                <span style={{ flex: 1, fontSize: 13, color: "var(--text)" }}>
                                  {item.nome}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", flexShrink: 0 }}>
                                  {item.quantidade}
                                </span>
                                <span style={{ fontSize: 11, color: "var(--text-3)", width: 28, textAlign: "right", flexShrink: 0 }}>
                                  {item.unidade ?? ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        ))
                      )}

                      {/* Observações */}
                      {p.observacoes && (
                        <div
                          style={{
                            marginTop: 12,
                            background: "var(--surface-2)",
                            border: "1px solid var(--border)",
                            borderLeft: "3px solid var(--text-3)",
                            borderRadius: 6,
                            padding: "10px 12px",
                            fontSize: 13,
                            color: "var(--text-3)",
                            fontStyle: "italic",
                          }}
                        >
                          Obs: {p.observacoes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
