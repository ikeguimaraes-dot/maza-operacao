"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@kph/db/supabase/server";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import type { ActionResult } from "@/lib/result";
import type { PurchaseOrderRow, PurchaseOrderItemRow } from "@kph/db/types/database";

export type ProdutoCatalogo = {
  nome: string;
  categoria: string;
  unidade: string;
};

export type ItemPedido = {
  ingrediente_id: string;
  nome: string;
  unidade: string;
  quantidade: number;
};

export type PedidoComItens = PurchaseOrderRow & {
  purchase_order_items: PurchaseOrderItemRow[];
};

export async function getProdutos(unitId: string): Promise<ProdutoCatalogo[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  type Row = {
    item_descricao: string;
    desc_gerencial: string | null;
    unidade_medida: string | null;
  };

  const { data, error } = (await supabase
    .from("produtos_relatorio" as never)
    .select("item_descricao, desc_gerencial, unidade_medida")
    .eq("unit_id", unitId)
    .not("item_descricao", "is", null)
    .neq("item_descricao", "")
    .order("item_descricao")
    .order("ano_lancamento", { ascending: false })
    .order("mes_lancamento", { ascending: false })) as unknown as {
    data: Row[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("[getProdutos]", error.message);
    return [];
  }

  const seen = new Map<string, ProdutoCatalogo>();
  for (const row of data ?? []) {
    if (!seen.has(row.item_descricao)) {
      seen.set(row.item_descricao, {
        nome: row.item_descricao,
        categoria: row.desc_gerencial ?? "",
        unidade: (row.unidade_medida ?? "kg").toLowerCase(),
      });
    }
  }
  return [...seen.values()];
}

export async function getPedidosRecentes(unitId: string): Promise<PedidoComItens[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = (await supabase
    .from("purchase_orders" as never)
    .select("*, purchase_order_items(*)")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: false })
    .limit(15)) as unknown as {
    data: PedidoComItens[] | null;
    error: { message: string } | null;
  };
  if (error) {
    console.error("[getPedidosRecentes]", error.message);
    return [];
  }
  return data ?? [];
}

export async function criarPedido(
  itens: ItemPedido[],
  observacoes: string | null,
): Promise<ActionResult<PurchaseOrderRow>> {
  if (itens.length === 0) {
    return { ok: false, error: "Adicione pelo menos um item ao pedido." };
  }
  for (const item of itens) {
    if (item.quantidade <= 0) {
      return { ok: false, error: `Quantidade inválida para "${item.nome}".` };
    }
  }

  const user = await requireUser();
  const unit = await getCurrentUnit();

  if (!unit) return { ok: false, error: "Nenhuma unidade selecionada." };
  if (!unit.brand_id) return { ok: false, error: "Unidade sem marca associada." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Erro ao conectar ao banco de dados." };

  const { data: pedido, error: pedidoError } = (await supabase
    .from("purchase_orders" as never)
    .insert({
      unit_id: unit.id,
      brand_id: unit.brand_id,
      status: "enviado",
      observacoes,
      created_by: user.id,
    } as never)
    .select()
    .single()) as unknown as {
    data: PurchaseOrderRow | null;
    error: { message: string } | null;
  };

  if (pedidoError || !pedido) {
    console.error("[criarPedido] pedido", pedidoError?.message);
    return { ok: false, error: pedidoError?.message ?? "Erro ao criar pedido." };
  }

  const itensMapped = itens.map((item) => ({
    order_id: pedido.id,
    nome: item.nome,
    unidade: item.unidade,
    quantidade: item.quantidade,
    preco_unitario: 0,
  }));

  const { error: itensError } = (await supabase
    .from("purchase_order_items" as never)
    .insert(itensMapped as never)) as unknown as {
    data: PurchaseOrderItemRow[] | null;
    error: { message: string } | null;
  };

  if (itensError) {
    console.error("[criarPedido] itens", itensError.message);
    return { ok: false, error: itensError.message };
  }

  revalidatePath("/operacao/pedidos");
  return { ok: true, data: pedido };
}

// ── Recebimento ─────────────────────────────────────────────────────────────

export type RecebimentoItemInput = {
  pedido_item_id: string;
  nome: string;
  quantidade_pedida: number;
  quantidade_recebida: number;
  unidade: string;
  observacao?: string;
};

type RecebimentoItemData = {
  id: string;
  pedido_item_id: string;
  nome: string;
  quantidade_pedida: number;
  quantidade_recebida: number;
  unidade: string | null;
  status: string;
  observacao: string | null;
};

type RecebimentoData = {
  id: string;
  pedido_id: string;
  observacao: string | null;
  created_at: string;
  recebimento_itens: RecebimentoItemData[];
};

export type PedidoParaRecebimento = PedidoComItens & {
  recebimento: RecebimentoData | null;
};

export async function getPedidosParaRecebimento(
  unitId: string,
): Promise<PedidoParaRecebimento[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data: pedidos, error: pedidoError } = (await supabase
    .from("purchase_orders" as never)
    .select("*, purchase_order_items(*)")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: false })) as unknown as {
    data: PedidoComItens[] | null;
    error: { message: string } | null;
  };

  if (pedidoError || !pedidos) {
    console.error("[getPedidosParaRecebimento]", pedidoError?.message);
    return [];
  }
  if (pedidos.length === 0) return [];

  const pedidoIds = pedidos.map((p) => p.id);
  const { data: recebimentos } = (await supabase
    .from("recebimentos" as never)
    .select("*, recebimento_itens(*)")
    .in("pedido_id", pedidoIds)) as unknown as {
    data: RecebimentoData[] | null;
    error: { message: string } | null;
  };

  const recMap = new Map((recebimentos ?? []).map((r) => [r.pedido_id, r]));
  return pedidos.map((p) => ({ ...p, recebimento: recMap.get(p.id) ?? null }));
}

export async function finalizarRecebimento(
  pedidoId: string,
  itens: RecebimentoItemInput[],
  observacao: string | null,
): Promise<ActionResult<void>> {
  const user = await requireUser();
  const unit = await getCurrentUnit();
  if (!unit) return { ok: false, error: "Nenhuma unidade selecionada." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível." };

  type RecRow = { id: string };
  const { data: rec, error: recError } = (await supabase
    .from("recebimentos" as never)
    .insert({
      pedido_id: pedidoId,
      unit_id: unit.id,
      recebido_por: user.id,
      observacao,
    } as never)
    .select()
    .single()) as unknown as { data: RecRow | null; error: { message: string } | null };

  if (recError || !rec) {
    console.error("[finalizarRecebimento] header", recError?.message);
    return { ok: false, error: recError?.message ?? "Erro ao criar recebimento." };
  }

  const itensMapped = itens.map((i) => {
    const status: "ok" | "parcial" | "nao_recebido" =
      i.quantidade_recebida <= 0
        ? "nao_recebido"
        : i.quantidade_recebida < i.quantidade_pedida
          ? "parcial"
          : "ok";
    return {
      recebimento_id: rec.id,
      pedido_item_id: i.pedido_item_id,
      nome: i.nome,
      quantidade_pedida: i.quantidade_pedida,
      quantidade_recebida: i.quantidade_recebida,
      unidade: i.unidade,
      status,
      observacao: i.observacao ?? null,
    };
  });

  const { error: itensError } = (await supabase
    .from("recebimento_itens" as never)
    .insert(itensMapped as never)) as unknown as { error: { message: string } | null };

  if (itensError) {
    console.error("[finalizarRecebimento] itens", itensError.message);
    return { ok: false, error: itensError.message };
  }

  await (supabase
    .from("purchase_orders" as never)
    .update({ status: "recebido" } as never)
    .eq("id", pedidoId) as unknown as Promise<unknown>);

  revalidatePath("/operacao/pedidos");
  return { ok: true, data: undefined };
}

export async function deletarPedido(pedidoId: string): Promise<ActionResult<void>> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível." };

  const { error } = (await supabase
    .from("purchase_orders" as never)
    .delete()
    .eq("id", pedidoId)) as unknown as { error: { message: string } | null };

  if (error) {
    console.error("[deletarPedido]", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/operacao/pedidos");
  return { ok: true, data: undefined };
}
