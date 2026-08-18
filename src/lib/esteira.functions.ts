import { createServerFn } from "@tanstack/react-start";

type Lote = { id: string; op_interna: string | null; quantidade: number };

/**
 * products.op_interna deixa de ser um rótulo agregado: cada fração exibe a
 * sua própria OP Interna nos módulos. Mantemos a coluna apenas como
 * conveniência quando existe exatamente uma fração ativa.
 */
async function syncProductOpInterna(productId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("esteira_producao")
    .select("op_interna")
    .eq("produto_id", productId)
    .eq("status", "ativo");
  const list = ((data ?? []) as { op_interna: string | null }[])
    .map((r) => (r.op_interna ?? "").trim())
    .filter(Boolean);
  await supabaseAdmin
    .from("products")
    .update({ op_interna: list.length === 1 ? (list[0] as string) : null })
    .eq("id", productId);
}


export const addToEsteira = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      token: string;
      productId: string;
      opInterna: string;
      quantidade: number;
      /** quando informado, atualiza a fração existente em vez de criar nova */
      loteId?: string;
    }) => {
      if (!data.productId) throw new Error("Selecione um produto.");
      const op = (data.opInterna ?? "").trim();
      if (!op) throw new Error("Informe o número da OP Interna.");
      const qtd = Math.floor(Number(data.quantidade) || 0);
      if (qtd <= 0) throw new Error("Informe a quantidade da OP Interna.");
      return {
        token: data.token,
        productId: data.productId,
        opInterna: op,
        quantidade: qtd,
        loteId: data.loteId ?? null,
      };
    },
  )
  .handler(async ({ data }) => {
    const { requireAdminClaims } = await import("@/lib/marcador-auth.server");
    await requireAdminClaims(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: product, error: prodErr } = await supabaseAdmin
      .from("products")
      .select("id,total_quantity")
      .eq("id", data.productId)
      .maybeSingle();
    if (prodErr) return { ok: false as const, error: prodErr.message };
    if (!product) return { ok: false as const, error: "Produto não encontrado." };

    const { data: existing, error: listErr } = await supabaseAdmin
      .from("esteira_producao")
      .select("id,op_interna,quantidade")
      .eq("produto_id", data.productId)
      .eq("status", "ativo");
    if (listErr) return { ok: false as const, error: listErr.message };

    const lotes = (existing ?? []) as Lote[];
    const others = lotes.filter((l) => l.id !== data.loteId);

    if (others.some((l) => (l.op_interna ?? "").trim() === data.opInterna)) {
      return { ok: false as const, error: "Esta OP Interna já existe para este produto." };
    }

    const used = others.reduce((s, l) => s + (l.quantidade || 0), 0);
    const restante = Math.max(0, (product.total_quantity ?? 0) - used);
    if (restante <= 0) {
      return {
        ok: false as const,
        error: "Este produto já está totalmente distribuído entre as OPs Internas.",
      };
    }
    if (data.quantidade > restante) {
      return {
        ok: false as const,
        error: `Quantidade maior que o restante disponível (${restante} peças).`,
      };
    }

    if (data.loteId) {
      const { error } = await supabaseAdmin
        .from("esteira_producao")
        .update({ op_interna: data.opInterna, quantidade: data.quantidade })
        .eq("id", data.loteId);
      if (error) return { ok: false as const, error: error.message };
    } else {
      const { error } = await supabaseAdmin.from("esteira_producao").insert({
        produto_id: data.productId,
        op_interna: data.opInterna,
        quantidade: data.quantidade,
        status: "ativo",
        data_adicionado: new Date().toISOString(),
      });
      if (error) return { ok: false as const, error: error.message };
    }

    await syncProductOpInterna(data.productId);
    return { ok: true as const };
  });

export const removeFromEsteira = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; id: string }) => {
    if (!data.id) throw new Error("Item inválido.");
    return data;
  })
  .handler(async ({ data }) => {
    const { requireAdminClaims } = await import("@/lib/marcador-auth.server");
    await requireAdminClaims(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lote } = await supabaseAdmin
      .from("esteira_producao")
      .select("produto_id")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin
      .from("esteira_producao")
      .update({ status: "removido" })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    if (lote?.produto_id) await syncProductOpInterna(lote.produto_id);
    return { ok: true as const };
  });
