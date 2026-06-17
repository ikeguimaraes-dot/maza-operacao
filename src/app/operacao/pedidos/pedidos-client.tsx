"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { formatDateBR } from "@/lib/format";
import type { PurchaseOrderItemRow, PurchaseOrderStatus } from "@kph/db/types/database";
import { criarPedido } from "./actions";
import type { ProdutoCatalogo, ItemPedido, PedidoComItens } from "./actions";

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

interface Props {
  unit: { id: string; name: string; brand_id: string | null };
  userId: string;
  produtos: ProdutoCatalogo[];
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
  const [qtds, setQtds] = useState<Record<string, string>>({});
  const [unidades, setUnidades] = useState<Record<string, string>>({});
  const [carrinho, setCarrinho] = useState<ItemPedido[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleCategoriaChange(cat: string) {
    setCategoriaAtiva(cat);
    setBusca("");
  }

  const produtosCategoria = categoriaAtiva
    ? produtos.filter((p) => p.categoria === categoriaAtiva)
    : [];

  const produtosFiltrados =
    busca === ""
      ? produtosCategoria
      : produtosCategoria.filter((p) =>
          p.nome.toLowerCase().includes(busca.toLowerCase()),
        );

  function getUnidade(prod: ProdutoCatalogo): string {
    return unidades[prod.nome] ?? prod.unidade;
  }

  function handleUnidadeChange(prod: ProdutoCatalogo, novaUnidade: string) {
    setUnidades((prev) => ({ ...prev, [prod.nome]: novaUnidade }));
    setCarrinho((prev) =>
      prev.map((i) =>
        i.ingrediente_id === prod.nome ? { ...i, unidade: novaUnidade } : i,
      ),
    );
  }

  function handleAdicionar(prod: ProdutoCatalogo) {
    const numQtd = Number(qtds[prod.nome] ?? "");
    if (numQtd <= 0) return;
    const unidade = getUnidade(prod);
    setCarrinho((prev) => {
      const idx = prev.findIndex((i) => i.ingrediente_id === prod.nome);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx]!, quantidade: next[idx]!.quantidade + numQtd, unidade };
        return next;
      }
      return [
        ...prev,
        { ingrediente_id: prod.nome, nome: prod.nome, unidade, quantidade: numQtd },
      ];
    });
    setQtds((prev) => ({ ...prev, [prod.nome]: "" }));
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
            {categorias.length === 0 ? (
              <div style={{ padding: "12px 8px", color: "var(--text-3)", fontSize: 12 }}>
                Nenhum produto disponível.
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
                      alignItems: "center",
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
                      {produtosFiltrados.map((prod) => {
                        const qtdVal = qtds[prod.nome] ?? "";
                        const canAdd = Number(qtdVal) > 0;
                        return (
                          <tr key={prod.nome}>
                            {/* Nome */}
                            <td style={{ padding: "9px 8px", color: "var(--text)" }}>
                              {prod.nome}
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
                                    [prod.nome]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleAdicionar(prod);
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

                            {/* Unidade */}
                            <td style={{ padding: "9px 8px" }}>
                              <select
                                value={getUnidade(prod)}
                                onChange={(e) =>
                                  handleUnidadeChange(prod, e.target.value)
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
                                <option value="kg">kg</option>
                                <option value="g">g</option>
                                <option value="l">l</option>
                                <option value="ml">ml</option>
                                <option value="un">un</option>
                              </select>
                            </td>

                            {/* Botão adicionar */}
                            <td style={{ padding: "9px 8px" }}>
                              <button
                                type="button"
                                onClick={() => handleAdicionar(prod)}
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
