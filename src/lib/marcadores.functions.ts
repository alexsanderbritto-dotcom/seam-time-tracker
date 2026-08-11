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

type Cargo = "usuario" | "admin";

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function signingKey(): Promise<CryptoKey> {
  const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_DB_URL"] ?? "";
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`marcador-session:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

async function issueToken(payload: { id: string; nome: string; cargo: Cargo }): Promise<string> {
  const body = b64url(
    new TextEncoder().encode(JSON.stringify({ ...payload, exp: Date.now() + SESSION_TTL_MS })),
  );
  const sig = await crypto.subtle.sign("HMAC", await signingKey(), new TextEncoder().encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

async function readToken(
  token: string | undefined,
): Promise<{ id: string; nome: string; cargo: Cargo; exp: number } | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await signingKey(),
    fromB64url(sig) as unknown as BufferSource,
    new TextEncoder().encode(body),
  );
  if (!valid) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromB64url(body))) as {
      id: string;
      nome: string;
      cargo: Cargo;
      exp: number;
    };
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function requireAdmin(token: string | undefined) {
  const claims = await readToken(token);
  if (!claims) throw new Error("Sessão expirada. Faça login novamente.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("marcadores")
    .select("id, cargo")
    .eq("id", claims.id)
    .maybeSingle();
  if (!data || data.cargo !== "admin") throw new Error("Acesso restrito a administradores.");
  return claims;
}

export const listMarcadores = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("marcadores")
      .select("id, nome, cargo, created_at")
      .order("nome");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createMarcador = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; nome: string; senha: string; cargo: Cargo }) => {
    const nome = data.nome?.trim() ?? "";
    const senha = data.senha ?? "";
    const cargo: Cargo = data.cargo === "admin" ? "admin" : "usuario";
    if (nome.length < 2 || nome.length > 60) throw new Error("Nome inválido (2 a 60 caracteres).");
    if (senha.length < 4 || senha.length > 100) throw new Error("Senha deve ter ao menos 4 caracteres.");
    return { token: data.token, nome, senha, cargo };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("marcadores")
      .select("id", { count: "exact", head: true });
    const isFirst = (count ?? 0) === 0;
    // O primeiro marcador do sistema é sempre criado como admin, sem exigir sessão.
    if (!isFirst) await requireAdmin(data.token);
    const senha_hash = await hashPassword(data.senha);
    const { error } = await supabaseAdmin
      .from("marcadores")
      .insert({ nome: data.nome, senha_hash, cargo: isFirst ? "admin" : data.cargo });
    if (error) {
      if (error.code === "23505") return { ok: false as const, error: "Já existe um marcador com esse nome." };
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  });

export const updateMarcadorCargo = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; id: string; cargo: Cargo }) => {
    if (!data.id) throw new Error("Marcador inválido.");
    return { token: data.token, id: data.id, cargo: data.cargo === "admin" ? "admin" : "usuario" };
  })
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.cargo === "usuario") {
      const { count } = await supabaseAdmin
        .from("marcadores")
        .select("id", { count: "exact", head: true })
        .eq("cargo", "admin");
      if ((count ?? 0) <= 1)
        return { ok: false as const, error: "É necessário manter ao menos um administrador." };
    }
    const { error } = await supabaseAdmin
      .from("marcadores")
      .update({ cargo: data.cargo })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const updateMarcadorSenha = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; id: string; senha: string }) => {
    if (!data.id) throw new Error("Marcador inválido.");
    if (!data.senha || data.senha.length < 4) throw new Error("Senha deve ter ao menos 4 caracteres.");
    return data;
  })
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
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
  .inputValidator((data: { token: string; id: string }) => data)
  .handler(async ({ data }) => {
    const claims = await requireAdmin(data.token);
    if (claims.id === data.id)
      return { ok: false as const, error: "Você não pode remover o próprio acesso." };
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
      .select("id, nome, cargo, senha_hash")
      .ilike("nome", data.nome)
      .maybeSingle();
    if (!row) {
      // constant-ish work to avoid trivial user enumeration by timing
      await hashPassword(data.senha);
      return { ok: false as const };
    }
    const valid = await verifyPassword(data.senha, row.senha_hash);
    if (!valid) return { ok: false as const };
    const cargo = (row.cargo === "admin" ? "admin" : "usuario") as Cargo;
    const token = await issueToken({ id: row.id, nome: row.nome, cargo });
    return { ok: true as const, marcador: { id: row.id, nome: row.nome, cargo, token } };
  });

export const hasMarcadores = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("marcadores")
    .select("id", { count: "exact", head: true });
  return { empty: (count ?? 0) === 0 };
});

