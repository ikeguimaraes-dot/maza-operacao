"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@kph/db/supabase/server";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import type { ActionResult } from "@/lib/result";
import type { IngredienteCategoria, UnidadePadrao } from "@kph/db/types/compras-ingredientes";
import type { PurchaseOrderRow, PurchaseOrderItemRow } from "@kph/db/types/database";

export type IngredienteComEstoque = {
  id: string;
  nome: string;
  categoria: IngredienteCategoria;
  unidade_padrao: UnidadePadrao;
  estoque_minimo: number;
  estoque_real: number;
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

export async function getIngredientes(unitId: string): Promise<IngredienteComEstoque[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  type IngRow = {
    id: string;
    nome: string;
    categoria: IngredienteCategoria;
    unidade_padrao: UnidadePadrao;
  };
  type StockRow = {
    ingredient_id: string;
    estoque_minimo: number | string;
    estoque_real: number | string;
  };

  const { data: ings, error: errIng } = (await supabase
    .from("ingredients" as never)
    .select("id, nome, categoria, unidade_padrao")
    .eq("ativo", true)
    .order("categoria")
    .order("nome")) as unknown as {
    data: IngRow[] | null;
    error: { message: string } | null;
  };

  if (errIng) {
    console.error("[getIngredientes] ings:", errIng.message);
    return [];
  }

  const { data: stocks } = (await supabase
    .from("ingredient_stock" as never)
    .select("ingredient_id, estoque_minimo, estoque_real")
    .eq("unit_id", unitId)) as unknown as {
    data: StockRow[] | null;
    error: { message: string } | null;
  };

  const stockMap = new Map((stocks ?? []).map((s) => [s.ingredient_id, s]));

  return (ings ?? []).map((i) => {
    const s = stockMap.get(i.id);
    return {
      id: i.id,
      nome: i.nome,
      categoria: i.categoria,
      unidade_padrao: i.unidade_padrao,
      estoque_minimo: Number(s?.estoque_minimo ?? 0),
      estoque_real: Number(s?.estoque_real ?? 0),
    };
  });
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

export async function atualizarEstoque(
  ingredienteId: string,
  unitId: string,
  estoqueMinimo: number,
  estoqueReal: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível." };

  const { error } = (await supabase
    .from("ingredient_stock" as never)
    .upsert(
      {
        ingredient_id: ingredienteId,
        unit_id: unitId,
        estoque_minimo: estoqueMinimo,
        estoque_real: estoqueReal,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "ingredient_id,unit_id" },
    )) as unknown as { error: { message: string } | null };

  if (error) {
    console.error("[atualizarEstoque]", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
