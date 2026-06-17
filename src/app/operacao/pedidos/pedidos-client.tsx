"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, ChevronDown, ChevronRight } from "lucide-react";
import type { Ingredient, IngredienteCategoria } from "@kph/db/types/compras-ingredientes";
import { CATEGORIA_LABELS, INGREDIENTE_CATEGORIAS } from "@kph/db/types/compras-ingredientes";
import { formatDateBR } from "@/lib/format";
import type { PurchaseOrderItemRow, PurchaseOrderStatus } from "@kph/db/types/database";
import { criarPedido } from "./actions";
import type { ItemPedido, PedidoComItens } from "./actions";

interface Props {
  unit: { id: string; name: string; brand_id: string | null };
  userId: string;
  ingredientes: Ingredient[];
  pedidosIniciais: PedidoComItens[];
}

function StatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const styles: Record<PurchaseOrderStatus, { background: string; color: string }> = {
    enviado: { background: "#1D4ED8", color: "#fff" },
    recebido: { background: "#15803D", color: "#fff" },
    parcial: { background: "#92400E", color: "#fff" },
    cancelado: { background: "#7F1D1D", color: "#fff" },
    rascunho: { background: "var(--surface-3)", color: "var(--text-3)" },
  };
  const s = styles[status] ?? styles.rascunho;
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

export function PedidosClient({ unit, ingredientes, pedidosIniciais }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [carrinho, setCarrinho] = useState<ItemPedido[]>([]);
  const [selectedIngId, setSelectedIngId] = useState<string>("");
  const [qtd, setQtd] = useState<string>("");
  const [observacoes, setObservacoes] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pedidos = pedidosIniciais;

  const selectedIng = ingredientes.find((i) => i.id === selectedIngId) ?? null;

  function handleAdicionar() {
    if (!selectedIng || Number(qtd) <= 0) return;
    const numQtd = Number(qtd);
    setCarrinho((prev) => {
      const idx = prev.findIndex((i) => i.ingrediente_id === selectedIng.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx]!, quantidade: updated[idx]!.quantidade + numQtd };
        return updated;
      }
      return [
        ...prev,
        {
          ingrediente_id: selectedIng.id,
          nome: selectedIng.nome,
          unidade: selectedIng.unidade_padrao,
          quantidade: numQtd,
        },
      ];
    });
    setQtd("");
  }

  function handleRemoverItem(ingrediente_id: string) {
    setCarrinho((prev) => prev.filter((i) => i.ingrediente_id !== ingrediente_id));
  }

  function handleQtdChange(ingrediente_id: string, value: string) {
    const num = Number(value);
    if (num <= 0) return;
    setCarrinho((prev) =>
      prev.map((i) => (i.ingrediente_id === ingrediente_id ? { ...i, quantidade: num } : i)),
    );
  }

  function handleEnviar() {
    startTransition(async () => {
      const result = await criarPedido(carrinho, observacoes || null);
      if (result.ok) {
        setCarrinho([]);
        setObservacoes("");
        toast.success("Pedido enviado com sucesso!");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const categoriaComIngredientes = INGREDIENTE_CATEGORIAS.filter((cat) =>
    ingredientes.some((i) => i.categoria === cat),
  );

  return (
    <div>
      {/* Header */}
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
          Novo Pedido
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.55 }}>
          {unit.name}
        </p>
      </header>

      {/* Formulário */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "20px 24px",
          marginBottom: 24,
        }}
      >
        {/* Row seleção */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginBottom: 20 }}>
          {/* Produto */}
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--text-3)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Produto
            </label>
            <select
              value={selectedIngId}
              onChange={(e) => setSelectedIngId(e.target.value)}
              style={{
                width: "100%",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
                fontSize: 13,
                padding: "8px 10px",
                outline: "none",
              }}
            >
              <option value="">Selecione um produto…</option>
              {categoriaComIngredientes.map((cat) => (
                <optgroup
                  key={cat}
                  label={CATEGORIA_LABELS[cat as IngredienteCategoria]}
                >
                  {ingredientes
                    .filter((i) => i.categoria === cat)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nome}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Qtd */}
          <div style={{ width: 140 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--text-3)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Qtd
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={qtd}
              onChange={(e) => setQtd(e.target.value)}
              style={{
                width: "100%",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
                fontSize: 13,
                padding: "8px 10px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
              {selectedIng ? selectedIng.unidade_padrao : "—"}
            </div>
          </div>

          {/* Botão Adicionar */}
          <div>
            <button
              onClick={handleAdicionar}
              disabled={!selectedIng || Number(qtd) <= 0}
              style={{
                background: "var(--brand)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "9px 18px",
                fontSize: 13,
                fontWeight: 700,
                cursor: !selectedIng || Number(qtd) <= 0 ? "not-allowed" : "pointer",
                opacity: !selectedIng || Number(qtd) <= 0 ? 0.5 : 1,
              }}
            >
              Adicionar
            </button>
          </div>
        </div>

        {/* Tabela do carrinho */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr>
              {["Produto", "Unidade", "Qtd", ""].map((col) => (
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
            {carrinho.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    padding: "16px 8px",
                    color: "var(--text-3)",
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  Nenhum item adicionado ainda.
                </td>
              </tr>
            ) : (
              carrinho.map((item) => (
                <tr key={item.ingrediente_id}>
                  <td style={{ padding: "8px 8px", color: "var(--text)" }}>{item.nome}</td>
                  <td style={{ padding: "8px 8px", color: "var(--text-2)" }}>{item.unidade}</td>
                  <td style={{ padding: "8px 8px" }}>
                    <input
                      type="number"
                      min="0.01"
                      value={item.quantidade}
                      onChange={(e) => handleQtdChange(item.ingrediente_id, e.target.value)}
                      style={{
                        width: 80,
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        color: "var(--text)",
                        fontSize: 13,
                        padding: "4px 8px",
                        outline: "none",
                      }}
                    />
                  </td>
                  <td style={{ padding: "8px 8px" }}>
                    <button
                      onClick={() => handleRemoverItem(item.ingrediente_id)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#EF4444",
                        padding: 4,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Observações */}
        <div style={{ marginTop: 16 }}>
          <textarea
            placeholder="Observações (opcional)…"
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            style={{
              width: "100%",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text)",
              fontSize: 13,
              padding: "8px 10px",
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Botão Enviar */}
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={handleEnviar}
            disabled={carrinho.length === 0 || isPending}
            style={{
              background: "#22C55E",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 700,
              cursor: carrinho.length === 0 || isPending ? "not-allowed" : "pointer",
              opacity: carrinho.length === 0 || isPending ? 0.5 : 1,
            }}
          >
            {isPending ? "Enviando…" : "Enviar Pedido"}
          </button>
        </div>
      </div>

      {/* Histórico de pedidos */}
      <div>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "var(--text)",
            margin: "0 0 12px",
            letterSpacing: -0.2,
          }}
        >
          Pedidos Recentes
        </h2>

        {pedidos.length === 0 ? (
          <div
            style={{
              color: "var(--text-3)",
              fontSize: 13,
              padding: "24px 0",
              textAlign: "center",
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
              {pedidos.map((p) => (
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
                        onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
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
                        style={{
                          padding: "8px 16px 16px",
                          background: "var(--surface-2)",
                        }}
                      >
                        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                          {p.purchase_order_items.map((item: PurchaseOrderItemRow) => (
                            <li
                              key={item.id}
                              style={{
                                fontSize: 12,
                                color: "var(--text-2)",
                                padding: "3px 0",
                              }}
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
