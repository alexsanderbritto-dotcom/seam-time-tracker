type Cargo = "usuario" | "admin" | "setor" | "painel";

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

export async function readToken(
  token: string | undefined,
): Promise<{ id: string; nome: string; cargo: Cargo } | null> {
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
    // Sem verificação de expiração: a sessão só termina no logout explícito.
    return JSON.parse(new TextDecoder().decode(fromB64url(body))) as {
      id: string;
      nome: string;
      cargo: Cargo;
      setorId?: string | null;
    };
  } catch {
    return null;
  }
}


export async function requireAdminClaims(token: string | undefined) {
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
