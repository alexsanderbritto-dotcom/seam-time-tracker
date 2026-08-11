import { createServerFn } from "@tanstack/react-start";

const ITERATIONS = 100_000;

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt);
  return `pbkdf2$${ITERATIONS}$${toHex(salt.buffer)}$${hash}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const salt = fromHex(parts[2] ?? "");
  const expected = parts[3] ?? "";
  const actual = await derive(password, salt);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export const listMarcadores = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("marcadores")
    .select("id, nome, created_at")
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createMarcador = createServerFn({ method: "POST" })
  .inputValidator((data: { nome: string; senha: string }) => {
    const nome = data.nome?.trim() ?? "";
    const senha = data.senha ?? "";
    if (nome.length < 2 || nome.length > 60) throw new Error("Nome inválido (2 a 60 caracteres).");
    if (senha.length < 4 || senha.length > 100) throw new Error("Senha deve ter ao menos 4 caracteres.");
    return { nome, senha };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const senha_hash = await hashPassword(data.senha);
    const { error } = await supabaseAdmin
      .from("marcadores")
      .insert({ nome: data.nome, senha_hash });
    if (error) {
      if (error.code === "23505") return { ok: false as const, error: "Já existe um marcador com esse nome." };
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  });

export const updateMarcadorSenha = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; senha: string }) => {
    if (!data.id) throw new Error("Marcador inválido.");
    if (!data.senha || data.senha.length < 4) throw new Error("Senha deve ter ao menos 4 caracteres.");
    return data;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const senha_hash = await hashPassword(data.senha);
    const { error } = await supabaseAdmin
      .from("marcadores")
      .update({ senha_hash })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const deleteMarcador = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("marcadores").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const loginMarcador = createServerFn({ method: "POST" })
  .inputValidator((data: { nome: string; senha: string }) => ({
    nome: (data.nome ?? "").trim(),
    senha: data.senha ?? "",
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("marcadores")
      .select("id, nome, senha_hash")
      .ilike("nome", data.nome)
      .maybeSingle();
    if (!row) {
      // constant-ish work to avoid trivial user enumeration by timing
      await hashPassword(data.senha);
      return { ok: false as const };
    }
    const valid = await verifyPassword(data.senha, row.senha_hash);
    if (!valid) return { ok: false as const };
    return { ok: true as const, marcador: { id: row.id, nome: row.nome } };
  });
