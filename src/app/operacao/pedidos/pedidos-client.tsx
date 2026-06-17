"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, ChevronDown, ChevronRight } from "lucide-react";
import type { IngredienteCategoria } from "@kph/db/types/compras-ingredientes";
import { CATEGORIA_LABELS, INGREDIENTE_CATEGORIAS } from "@kph/db/types/compras-ingredientes";
import { formatDateBR } from "@/lib/format";
import type { PurchaseOrderItemRow, PurchaseOrderStatus } from "@kph/db/types/database";
import { criarPedido, atualizarEstoque } from "./actions";
import type { IngredienteComEstoque, ItemPedido, PedidoComItens } from "./actions";

interface Props {
  unit: { id: string; name: string; brand_id: string | null };
  userId: string;
  ingredientes: IngredienteComEstoque[];
  pedidosIniciais: PedidoComItens[];
}

function StatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const map: Record<PurchaseOrderStatus, { background: string; color: string }> = {
    enviado:  { background: "#1D4ED8", color: "#fff" },
    recebido: { background: "#15803D", color: "#fff" },
    parcial:  { background: "#92400E", color: "#fff" },
    cancelado:{ background: "#7F1D1D", color: "#fff" },
    rascunho: { background: "var(--surface-3)", color: "var(--text-3)" },
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

export function PedidosClient({ unit, ingredientes, pedidosIniciais }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const categoriasPresentes = INGREDIENTE_CATEGORIAS.filter((cat) =>
    ingredientes.some((i) => i.categoria === cat),
  );

  const [categoriaAtiva, setCategoriaAtiva] = useState<IngredienteCategoria | null>(
    categoriasPresentes[0] ?? null,
  );
  const [busca, setBusca] = useState("");
  const [qtds, setQtds] = useState<Record<string, string>>({});
  // estoque editado localmente: { minimo, real } como strings (para inputs)
  const [estoques, setEstoques] = useState<Record<string, { minimo: string; real: string }>>({});
  // unidade override por ingrediente (para o select de g/un)
  const [unidades, setUnidades] = useState<Record<string, string>>({});
  const [carrinho, setCarrinho] = useState<ItemPedido[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleCategoriaChange(cat: IngredienteCategoria) {
    setCategoriaAtiva(cat);
    setBusca("");
  }

  const produtosCategoria = categoriaAtiva
    ? ingredientes.filter((i) => i.categoria === categoriaAtiva)
    : [];

  const produtosFiltrados =
    busca === ""
      ? produtosCategoria
      : produtosCategoria.filter((i) =>
          i.nome.toLowerCase().includes(busca.toLowerCase()),
        );

  function getUnidade(ing: IngredienteComEstoque): string {
    return unidades[ing.id] ?? ing.unidade_padrao;
  }

  function handleUnidadeChange(ing: IngredienteComEstoque, novaUnidade: string) {
    setUnidades((prev) => ({ ...prev, [ing.id]: novaUnidade }));
    setCarrinho((prev) =>
      prev.map((i) =>
        i.ingrediente_id === ing.id ? { ...i, unidade: novaUnidade } : i,
      ),
    );
  }

  function handleAdicionar(ing: IngredienteComEstoque) {
    const numQtd = Number(qtds[ing.id] ?? "");
    if (numQtd <= 0) return;
    const unidade = getUnidade(ing);
    setCarrinho((prev) => {
      const idx = prev.findIndex((i) => i.ingrediente_id === ing.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx]!, quantidade: next[idx]!.quantidade + numQtd, unidade };
        return next;
      }
      return [
        ...prev,
        { ingrediente_id: ing.id, nome: ing.nome, unidade, quantidade: numQtd },
      ];
    });
    setQtds((prev) => ({ ...prev, [ing.id]: "" }));
  }

  function handleRemoverItem(ingrediente_id: string) {
    setCarrinho((prev) => prev.filter((i) => i.ingrediente_id !== ingrediente_id));
  }

  function handleQtdCarrinho(ingrediente_id: string, value: string) {
    const num = Number(value);
    if (num <= 0) return;
    setCarrinho((prev) =>
      prev.map((i) => (i.ingrediente_id === ingrediente_id ? { ...i, quantidade: num } : i)),
    );
  }

  function handleEstoqueBlur(ing: IngredienteComEstoque) {
    const minimoVal = estoques[ing.id]?.minimo;
    const realVal = estoques[ing.id]?.real;
    if (minimoVal === undefined && realVal === undefined) return;
    const minimo = Number(minimoVal ?? ing.estoque_minimo);
    const real = Number(realVal ?? ing.estoque_real);
    void atualizarEstoque(ing.id, unit.id, minimo, real).then((result) => {
      if (result.ok) {
        toast("Estoque atualizado", { duration: 2000 });
      } else {
        toast.error(result.error);
      }
    });
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

      {/* Card principal — duas colunas */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
          marginBottom: 32,
        }}
      >
        <div style={{ display: "flex", alignItems: "stretch" }}>
          {/* Coluna esquerda — categorias */}
          <nav
            style={{
              width: 196,
              flexShrink: 0,
              borderRight: "1px solid var(--border)",
              padding: "12px 8px",
            }}
          >
            {categoriasPresentes.length === 0 ? (
              <div style={{ padding: "12px 8px", color: "var(--text-3)", fontSize: 12 }}>
                Nenhum produto disponível.
              </div>
            ) : (
              categoriasPresentes.map((cat) => {
                const isActive = cat === categoriaAtiva;
                const criticos = ingredientes.filter((i) => {
                  const min = Number(estoques[i.id]?.minimo ?? i.estoque_minimo);
                  const real = Number(estoques[i.id]?.real ?? i.estoque_real);
                  return i.categoria === cat && min > 0 && real <= min;
                }).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoriaChange(cat)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                      width: "100%",
                      padding: "8px 10px",
                      marginBottom: 2,
                      background: isActive ? "var(--surface-2)" : "transparent",
                      border: "none",
                      borderRadius: 8,
                      color: isActive ? "var(--text)" : "var(--text-2)",
                      fontWeight: isActive ? 600 : 500,
                      fontSize: 13,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {CATEGORIA_LABELS[cat]}
                    </span>
                    {criticos > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          background: "#7F1D1D",
                          color: "#FCA5A5",
                          borderRadius: 99,
                          padding: "1px 6px",
                          flexShrink: 0,
                        }}
                      >
                        {criticos}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </nav>

          {/* Coluna direita — produtos e carrinho */}
          <div style={{ flex: 1, minWidth: 0, padding: "20px 24px" }}>
            {!categoriaAtiva ? (
              <div
                style={{
                  color: "var(--text-3)",
                  fontSize: 13,
                  padding: "32px 0",
                  textAlign: "center",
                }}
              >
                Selecione uma categoria à esquerda.
              </div>
            ) : (
              <>
                {/* Campo de busca */}
                <input
                  type="search"
                  placeholder="Buscar produto…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  style={{
                    width: "100%",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text)",
                    fontSize: 13,
                    padding: "7px 10px",
                    outline: "none",
                    marginBottom: 12,
                    boxSizing: "border-box",
                  }}
                />

                {/* Tabela de produtos */}
                {produtosFiltrados.length === 0 ? (
                  <div
                    style={{
                      color: "var(--text-3)",
                      fontSize: 13,
                      padding: "24px 0",
                      textAlign: "center",
                    }}
                  >
                    {busca
                      ? `Nenhum resultado para "${busca}".`
                      : "Nenhum produto nesta categoria."}
                  </div>
                ) : (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                      marginBottom: 24,
                    }}
                  >
                    <thead>
                      <tr>
                        {(
                          [
                            { label: "Produto", align: "left" as const, width: undefined },
                            { label: "Mín", align: "center" as const, width: 80 },
                            { label: "Real", align: "center" as const, width: 80 },
                            { label: "Qtd", align: "left" as const, width: 96 },
                            { label: "Un.", align: "left" as const, width: 70 },
                            { label: "", align: "left" as const, width: 110 },
                          ] as const
                        ).map((col, i) => (
                          <th
                            key={i}
                            style={{
                              textAlign: col.align,
                              fontSize: 11,
                              fontWeight: 700,
                              color: "var(--text-3)",
                              textTransform: "uppercase",
                              letterSpacing: 0.8,
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--border)",
                              width: col.width,
                            }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {produtosFiltrados.map((ing) => {
                        const minimoAtual = Number(
                          estoques[ing.id]?.minimo ?? ing.estoque_minimo,
                        );
                        const realAtual = Number(
                          estoques[ing.id]?.real ?? ing.estoque_real,
                        );
                        const critico = minimoAtual > 0 && realAtual <= minimoAtual;
                        const qtdVal = qtds[ing.id] ?? "";
                        const canAdd = Number(qtdVal) > 0;
                        return (
                          <tr
                            key={ing.id}
                            style={{
                              borderLeft: critico
                                ? "3px solid #EF4444"
                                : "3px solid transparent",
                            }}
                          >
                            {/* Nome */}
                            <td style={{ padding: "9px 8px", color: "var(--text)" }}>
                              {ing.nome}
                              {critico && (
                                <span
                                  style={{
                                    marginLeft: 8,
                                    fontSize: 10,
                                    color: "#EF4444",
                                    fontWeight: 700,
                                  }}
                                >
                                  ⚠ crítico
                                </span>
                              )}
                            </td>

                            {/* Estoque mínimo — editável */}
                            <td style={{ padding: "9px 8px", textAlign: "center" }}>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={estoques[ing.id]?.minimo ?? ing.estoque_minimo}
                                onChange={(e) =>
                                  setEstoques((prev) => ({
                                    ...prev,
                                    [ing.id]: {
                                      real:
                                        prev[ing.id]?.real ??
                                        String(ing.estoque_real),
                                      minimo: e.target.value,
                                    },
                                  }))
                                }
                                onBlur={() => handleEstoqueBlur(ing)}
                                style={{
                                  width: 64,
                                  background: "var(--surface-2)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 6,
                                  color: "var(--text-3)",
                                  fontSize: 12,
                                  padding: "4px 6px",
                                  outline: "none",
                                  textAlign: "center",
                                }}
                              />
                            </td>

                            {/* Estoque real — editável */}
                            <td style={{ padding: "9px 8px", textAlign: "center" }}>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={estoques[ing.id]?.real ?? ing.estoque_real}
                                onChange={(e) =>
                                  setEstoques((prev) => ({
                                    ...prev,
                                    [ing.id]: {
                                      minimo:
                                        prev[ing.id]?.minimo ??
                                        String(ing.estoque_minimo),
                                      real: e.target.value,
                                    },
                                  }))
                                }
                                onBlur={() => handleEstoqueBlur(ing)}
                                style={{
                                  width: 64,
                                  background: "var(--surface-2)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 6,
                                  color: critico ? "#EF4444" : "var(--text-2)",
                                  fontSize: 12,
                                  fontWeight: critico ? 700 : 400,
                                  padding: "4px 6px",
                                  outline: "none",
                                  textAlign: "center",
                                }}
                              />
                            </td>

                            {/* Qtd */}
                            <td style={{ padding: "9px 8px" }}>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={qtdVal}
                                onChange={(e) =>
                                  setQtds((prev) => ({
                                    ...prev,
                                    [ing.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleAdicionar(ing);
                                }}
                                style={{
                                  width: 80,
                                  background: "var(--surface-2)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 6,
                                  color: "var(--text)",
                                  fontSize: 13,
                                  padding: "5px 8px",
                                  outline: "none",
                                }}
                              />
                            </td>

                            {/* Unidade — select g/un */}
                            <td style={{ padding: "9px 8px" }}>
                              <select
                                value={getUnidade(ing)}
                                onChange={(e) =>
                                  handleUnidadeChange(ing, e.target.value)
                                }
                                style={{
                                  width: "100%",
                                  background: "var(--surface-2)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 6,
                                  color: "var(--text-3)",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "5px 4px",
                                  outline: "none",
                                }}
                              >
                                <option value="g">g</option>
                                <option value="un">un</option>
                              </select>
                            </td>

                            {/* Botão adicionar */}
                            <td style={{ padding: "9px 8px" }}>
                              <button
                                type="button"
                                onClick={() => handleAdicionar(ing)}
                                disabled={!canAdd}
                                style={{
                                  background: canAdd
                                    ? "var(--brand)"
                                    : "var(--surface-3)",
                                  color: canAdd ? "#fff" : "var(--text-3)",
                                  border: "none",
                                  borderRadius: 6,
                                  padding: "5px 12px",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: canAdd ? "pointer" : "not-allowed",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                + Adicionar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {/* Carrinho */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-3)",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  marginBottom: 12,
                }}
              >
                Carrinho{carrinho.length > 0 ? ` (${carrinho.length})` : ""}
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Produto", "Qtd", "Un.", ""].map((col) => (
                      <th
                        key={col}
                        style={{
                          textAlign: "left",
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--text-3)",
                          textTransform: "uppercase",
                          letterSpacing: 0.8,
                          padding: "5px 8px",
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
                          padding: "14px 8px",
                          color: "var(--text-3)",
                          fontSize: 12,
                          textAlign: "center",
                        }}
                      >
                        Nenhum item adicionado.
                      </td>
                    </tr>
                  ) : (
                    carrinho.map((item) => (
                      <tr key={item.ingrediente_id}>
                        <td style={{ padding: "7px 8px", color: "var(--text)" }}>
                          {item.nome}
                        </td>
                        <td style={{ padding: "7px 8px" }}>
                          <input
                            type="number"
                            min="0.01"
                            value={item.quantidade}
                            onChange={(e) =>
                              handleQtdCarrinho(item.ingrediente_id, e.target.value)
                            }
                            style={{
                              width: 70,
                              background: "var(--surface-2)",
                              border: "1px solid var(--border)",
                              borderRadius: 6,
                              color: "var(--text)",
                              fontSize: 13,
                              padding: "4px 7px",
                              outline: "none",
                            }}
                          />
                        </td>
                        <td
                          style={{
                            padding: "7px 8px",
                            color: "var(--text-3)",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {item.unidade}
                        </td>
                        <td style={{ padding: "7px 8px" }}>
                          <button
                            type="button"
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
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div style={{ marginTop: 14 }}>
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

              <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={handleEnviar}
                  disabled={carrinho.length === 0 || isPending}
                  style={{
                    background: "#22C55E",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 28px",
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
          </div>
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

        {pedidosIniciais.length === 0 ? (
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
