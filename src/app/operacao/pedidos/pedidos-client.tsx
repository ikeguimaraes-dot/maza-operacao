"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingBag, X, ChevronDown, ChevronRight } from "lucide-react";
import { formatDateBR } from "@/lib/format";
import type { PurchaseOrderItemRow, PurchaseOrderStatus } from "@kph/db/types/database";
import { criarPedido } from "./actions";
import type { ProdutoCatalogo, PedidoComItens } from "./actions";

// ── Mapeamento de labels legíveis ────────────────────────────────────────────

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

// Normaliza unidade do banco para as opções suportadas pelo select
const SUPPORTED_UNITS = ["kg", "g", "l", "ml", "un"] as const;
type SupportedUnit = (typeof SUPPORTED_UNITS)[number];

function normalizeUnidade(u: string): SupportedUnit {
  const lower = u.toLowerCase().trim();
  if ((SUPPORTED_UNITS as readonly string[]).includes(lower)) return lower as SupportedUnit;
  return "kg";
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

  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(
    categorias[0] ?? null,
  );
  const [busca, setBusca] = useState("");
  const [qtds, setQtds] = useState<Record<string, number>>({});
  const [unidades, setUnidades] = useState<Record<string, string>>({});
  const [observacoes, setObservacoes] = useState("");
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Carrinho derivado — todos os produtos com qty > 0
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

  const produtosCategoria = useMemo(
    () => (categoriaAtiva ? produtos.filter((p) => p.categoria === categoriaAtiva) : []),
    [produtos, categoriaAtiva],
  );

  const produtosFiltrados = useMemo(
    () =>
      busca === ""
        ? produtosCategoria
        : produtosCategoria.filter((p) =>
            p.nome.toLowerCase().includes(busca.toLowerCase()),
          ),
    [produtosCategoria, busca],
  );

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

  const totalItens = carrinho.length;
  const footerResumo =
    totalItens === 0
      ? "Nenhum item adicionado"
      : carrinho
          .slice(0, 2)
          .map((i) => i.nome)
          .join(", ") + (totalItens > 2 ? ` +${totalItens - 2}` : "");

  return (
    <div>
      {/* ══ TRÊS ZONAS FIXAS (100dvh) ══════════════════════════════════════ */}
      <div
        style={{
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* HEADER ──────────────────────────────────────────────────────── */}
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

        {/* CONTEÚDO CENTRAL ────────────────────────────────────────────── */}
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
            {!categoriaAtiva ? (
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
                      <span
                        style={{
                          flex: 1,
                          fontSize: 15,
                          fontWeight: 600,
                          color: "var(--text)",
                          lineHeight: 1.3,
                        }}
                      >
                        {prod.nome}
                      </span>

                      {/* Controles ± */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexShrink: 0,
                        }}
                      >
                        {/* Botão − */}
                        <button
                          type="button"
                          onClick={() => handleDecrement(prod)}
                          disabled={qty <= 0}
                          style={{
                            width: 44,
                            height: 44,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            background: "var(--surface-2)",
                            color: "var(--text)",
                            fontSize: 20,
                            fontWeight: 700,
                            cursor: qty <= 0 ? "not-allowed" : "pointer",
                            flexShrink: 0,
                            opacity: qty <= 0 ? 0.3 : 1,
                          }}
                        >
                          −
                        </button>

                        {/* Quantidade */}
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          value={qty === 0 ? "" : qty}
                          placeholder="0"
                          onChange={(e) => handleQtdChange(prod.nome, e.target.value)}
                          style={{
                            width: 52,
                            height: 44,
                            background: "var(--surface-2)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            color: "var(--text)",
                            fontSize: 16,
                            fontWeight: 700,
                            textAlign: "center",
                            outline: "none",
                            padding: "0 4px",
                          }}
                        />

                        {/* Botão + */}
                        <button
                          type="button"
                          onClick={() => handleIncrement(prod)}
                          style={{
                            width: 44,
                            height: 44,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            background: "var(--surface-2)",
                            color: "var(--text)",
                            fontSize: 20,
                            fontWeight: 700,
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          +
                        </button>

                        {/* Select de unidade */}
                        <select
                          value={getUnidade(prod)}
                          onChange={(e) => handleUnidadeChange(prod, e.target.value)}
                          style={{
                            height: 44,
                            background: "var(--surface-2)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            color: "var(--text-3)",
                            fontSize: 13,
                            fontWeight: 600,
                            padding: "0 6px",
                            outline: "none",
                            flexShrink: 0,
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

        {/* FOOTER ──────────────────────────────────────────────────────── */}
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

      {/* ══ CARRINHO DRAWER ════════════════════════════════════════════════ */}
      {carrinhoAberto && (
        <>
          {/* Overlay */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 40,
            }}
            onClick={() => setCarrinhoAberto(false)}
          />

          {/* Painel lateral */}
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              height: "100dvh",
              width: 320,
              background: "var(--surface)",
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              boxShadow: "-8px 0 32px rgba(0,0,0,0.3)",
            }}
          >
            {/* Drawer header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 16px",
                height: 64,
                borderBottom: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                Carrinho{totalItens > 0 ? ` (${totalItens})` : ""}
              </span>
              <button
                type="button"
                onClick={() => setCarrinhoAberto(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-3)",
                  padding: 8,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {carrinho.length === 0 ? (
                <div
                  style={{
                    color: "var(--text-3)",
                    fontSize: 13,
                    textAlign: "center",
                    paddingTop: 32,
                  }}
                >
                  Nenhum item adicionado.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {carrinho.map((item) => (
                    <div
                      key={item.ingrediente_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 12px",
                        background: "var(--surface-2)",
                        borderRadius: 8,
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: 13,
                          color: "var(--text)",
                          lineHeight: 1.3,
                        }}
                      >
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
                          width: 52,
                          height: 36,
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          color: "var(--text)",
                          fontSize: 14,
                          fontWeight: 700,
                          textAlign: "center",
                          outline: "none",
                          padding: "0 4px",
                        }}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--text-3)",
                          minWidth: 22,
                          textAlign: "center",
                        }}
                      >
                        {item.unidade}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoverItem(item.nome)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#EF4444",
                          padding: 4,
                          display: "flex",
                          alignItems: "center",
                          flexShrink: 0,
                        }}
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
                    width: "100%",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text)",
                    fontSize: 13,
                    padding: "10px 12px",
                    outline: "none",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* Drawer footer */}
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={handleEnviar}
                disabled={totalItens === 0 || isPending}
                style={{
                  width: "100%",
                  height: 48,
                  background: "#22C55E",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
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

      {/* ══ HISTÓRICO ══════════════════════════════════════════════════════ */}
      <div style={{ padding: "32px 16px" }}>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 24, marginBottom: 16 }}>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--text)",
              margin: 0,
              letterSpacing: -0.2,
            }}
          >
            Histórico de Pedidos
          </h2>
        </div>

        {pedidosIniciais.length === 0 ? (
          <div
            style={{
              color: "var(--text-3)",
              fontSize: 13,
              textAlign: "center",
              padding: "24px 0",
            }}
          >
            Nenhum pedido encontrado para esta unidade.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Data", "Itens", "Status", ""].map((col) => (
                  <th
                    key={col}
                    style={{
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-3)",
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      padding: "6px 8px",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pedidosIniciais.map((p) => (
                <Fragment key={p.id}>
                  <tr>
                    <td style={{ padding: "10px 8px", color: "var(--text)" }}>
                      {formatDateBR(p.data_pedido)}
                    </td>
                    <td style={{ padding: "10px 8px", color: "var(--text-2)" }}>
                      {p.purchase_order_items.length}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <StatusBadge status={p.status} />
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(expandedId === p.id ? null : p.id)
                        }
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-3)",
                          padding: 4,
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        {expandedId === p.id ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </button>
                    </td>
                  </tr>
                  {expandedId === p.id && (
                    <tr>
                      <td
                        colSpan={4}
                        style={{ padding: "8px 16px 16px", background: "var(--surface-2)" }}
                      >
                        {p.observacoes && (
                          <p
                            style={{
                              fontSize: 12,
                              color: "var(--text-3)",
                              margin: "0 0 8px",
                              fontStyle: "italic",
                            }}
                          >
                            {p.observacoes}
                          </p>
                        )}
                        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                          {p.purchase_order_items.map((item: PurchaseOrderItemRow) => (
                            <li
                              key={item.id}
                              style={{ fontSize: 12, color: "var(--text-2)", padding: "3px 0" }}
                            >
                              {item.nome} — {item.quantidade} {item.unidade ?? ""}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
