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
