import { readToken } from "@/lib/marcador-auth.server";
import type { Filter, MutatePayload, SelectPayload } from "@/lib/data.functions";

const READABLE = new Set([
  "products",
  "operations",
  "employees",
  "schedule_config",
  "production_entries",
  "companies",
  "clients",
  "sectors",
  "catalog_operations",
  "overtime_slots",
  "esteira_producao",
  "faturamento_meses",
  "faturamento_mes_produtos",
  "meta_setor_mes",
  "meta_producao_setor_dia",
  "ocorrencias",
  "schedule_day_config",
  "feriados",
]);

// Tables any signed-in marcador (usuario or admin) may write to.
const USER_WRITABLE = new Set(["production_entries", "ocorrencias"]);

const BUCKET = "product-files";
const SAFE_PATH = /^(fichas|piloto)\/[A-Za-z0-9._-]+$/;

type Claims = { id: string; cargo: "usuario" | "admin" };

async function auth(token: string | undefined): Promise<Claims> {
  const claims = await readToken(token);
  if (!claims) throw new Error("Sessão expirada. Faça login novamente.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("marcadores")
    .select("id, cargo")
    .eq("id", claims.id)
    .maybeSingle();
  if (!data) throw new Error("Sessão inválida. Faça login novamente.");
  return { id: data.id, cargo: (data.cargo === "admin" ? "admin" : "usuario") };
}

function applyFilters<T>(query: T, filters: Filter[]): T {
  let q = query as never as {
    eq: (c: string, v: unknown) => unknown;
    neq: (c: string, v: unknown) => unknown;
    gte: (c: string, v: unknown) => unknown;
    lte: (c: string, v: unknown) => unknown;
    in: (c: string, v: unknown) => unknown;
  };
  for (const f of filters ?? []) {
    q = q[f.op](f.col, f.value) as typeof q;
  }
  return q as never as T;
}

export async function runSelect(data: SelectPayload) {
  try {
    await auth(data.token);
    if (!READABLE.has(data.table)) throw new Error("Recurso não permitido.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q: never = supabaseAdmin.from(data.table as never).select(data.columns || "*") as never;
    q = applyFilters(q, data.filters);
    if (data.order) {
      q = (q as never as { order: (c: string, o: { ascending: boolean }) => never }).order(
        data.order.col,
        { ascending: data.order.asc },
      );
    }
    if (typeof data.limit === "number") {
      q = (q as never as { limit: (n: number) => never }).limit(data.limit);
    }
    const runner = q as never as {
      single: () => Promise<{ data: unknown; error: { message: string } | null }>;
      maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const res =
      data.mode === "single"
        ? await runner.single()
        : data.mode === "maybeSingle"
          ? await runner.maybeSingle()
          : await (q as never as Promise<{ data: unknown; error: { message: string } | null }>);
    return { data: res.data ?? null, error: res.error ? { message: res.error.message } : null };
  } catch (e) {
    return { data: null, error: { message: (e as Error).message } };
  }
}

export async function runMutate(data: MutatePayload) {
  try {
    const claims = await auth(data.token);
    if (!READABLE.has(data.table)) throw new Error("Recurso não permitido.");
    if (claims.cargo !== "admin" && !USER_WRITABLE.has(data.table)) {
      throw new Error("Acesso restrito a administradores.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = supabaseAdmin.from(data.table as never);
    let q: never;
    if (data.action === "insert") q = (table as never as { insert: (v: unknown) => never }).insert(data.values);
    else if (data.action === "upsert")
      q = (table as never as { upsert: (v: unknown, o?: unknown) => never }).upsert(
        data.values,
        data.onConflict ? { onConflict: data.onConflict } : undefined,
      );
    else if (data.action === "update")
      q = applyFilters(
        (table as never as { update: (v: unknown) => never }).update(data.values),
        data.filters,
      );
    else q = applyFilters((table as never as { delete: () => never }).delete(), data.filters);

    if (data.returning === "single") {
      const res = await (q as never as { select: () => { single: () => Promise<{ data: unknown; error: { message: string } | null }> } })
        .select()
        .single();
      return { data: res.data ?? null, error: res.error ? { message: res.error.message } : null };
    }
    const res = await (q as never as Promise<{ error: { message: string } | null }>);
    return { data: null, error: res.error ? { message: res.error.message } : null };
  } catch (e) {
    return { data: null, error: { message: (e as Error).message } };
  }
}

export async function runUpload(data: { token: string; path: string; contentType: string; base64: string }) {
  try {
    const claims = await auth(data.token);
    if (claims.cargo !== "admin") throw new Error("Acesso restrito a administradores.");
    if (!SAFE_PATH.test(data.path)) throw new Error("Caminho de arquivo inválido.");
    const bin = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(data.path, bin, { contentType: data.contentType || "application/octet-stream" });
    return { error: error ? { message: error.message } : null };
  } catch (e) {
    return { error: { message: (e as Error).message } };
  }
}

export async function runSignedUrl(data: { token: string; path: string }) {
  try {
    await auth(data.token);
    if (!SAFE_PATH.test(data.path)) throw new Error("Caminho de arquivo inválido.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(data.path, 60 * 60);
    return { url: signed?.signedUrl ?? null, error: error ? { message: error.message } : null };
  } catch (e) {
    return { url: null, error: { message: (e as Error).message } };
  }
}
