import { useEffect, useState } from "react";

export const MARCADOR_STORAGE_KEY = "marcador-sessao";

/** admin = acesso total · usuario = só marcação · setor = marcação + dashboard do setor */
export type MarcadorCargo = "usuario" | "admin" | "setor";

export type MarcadorSession = {
  id: string;
  nome: string;
  cargo: MarcadorCargo;
  setorId?: string | null;
  setorNome?: string | null;
  token: string;
};

export function readSession(): MarcadorSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(MARCADOR_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MarcadorSession;
    if (!parsed?.id || !parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: MarcadorSession) {
  localStorage.setItem(MARCADOR_STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("marcador-session"));
}

export function clearSession() {
  localStorage.removeItem(MARCADOR_STORAGE_KEY);
  window.dispatchEvent(new Event("marcador-session"));
}

export function useMarcadorSession() {
  const [session, setSession] = useState<MarcadorSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setSession(readSession());
    sync();
    setReady(true);
    window.addEventListener("marcador-session", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("marcador-session", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const isAdmin = session?.cargo === "admin";
  const isSetor = session?.cargo === "setor" && !!session?.setorId;

  return {
    session,
    ready,
    isAdmin,
    isSetor,
    setorId: isSetor ? (session?.setorId ?? null) : null,
    setorNome: isSetor ? (session?.setorNome ?? null) : null,
  };
}
