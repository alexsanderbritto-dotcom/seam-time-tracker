import { createServerFn } from "@tanstack/react-start";

export const addToEsteira = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; productId: string; opInterna: string }) => {
    if (!data.productId) throw new Error("Selecione um produto.");
    return {
      token: data.token,
      productId: data.productId,
      opInterna: (data.opInterna ?? "").trim(),
    };
  })
  .handler(async ({ data }) => {
    const { requireAdminClaims } = await import("@/lib/marcador-auth.server");
    await requireAdminClaims(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: upErr } = await supabaseAdmin
      .from("products")
      .update({ op_interna: data.opInterna || null })
      .eq("id", data.productId);
    if (upErr) return { ok: false as const, error: upErr.message };

    const { error } = await supabaseAdmin
      .from("esteira_producao")
      .upsert(
        {
          produto_id: data.productId,
          status: "ativo",
          data_adicionado: new Date().toISOString(),
        },
        { onConflict: "produto_id" },
      );
    if (error) return { ok: false as const, error: error.message };
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
    const { error } = await supabaseAdmin
      .from("esteira_producao")
      .update({ status: "removido" })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
