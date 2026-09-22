import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Notificação de novos avisos em tempo real.
 *
 * Usa um canal de broadcast do Realtime (não postgres_changes), porque o acesso
 * às tabelas passa pelo gateway de servidor e o cliente do navegador não tem
 * permissão de leitura direta em `avisos`. Quem cria o aviso avisa o canal;
 * todos os outros marcadores conectados recebem na hora.
 */
export type AvisoEvento = {
  id: string;
  texto: string;
  autor: string;
  autorId: string | null;
};

const CHANNEL = "avisos-notify";
const SOM_KEY = "avisos-som";
const VISTOS_KEY = "avisos-vistos";

export function broadcastNovoAviso(payload: AvisoEvento) {
  try {
    const channel = supabase.channel(CHANNEL);
    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      void channel.send({ type: "broadcast", event: "novo-aviso", payload });
      window.setTimeout(() => void supabase.removeChannel(channel), 1500);
    });
  } catch {
    // Notificação é complementar: nunca deve quebrar o registro do aviso.
  }
}

export function useNovoAvisoListener(onEvento: (evento: AvisoEvento) => void) {
  const ref = useRef(onEvento);
  ref.current = onEvento;

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(CHANNEL)
        .on("broadcast", { event: "novo-aviso" }, ({ payload }) => {
          ref.current(payload as AvisoEvento);
        })
        .subscribe();
    } catch {
      channel = null;
    }
    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);
}

/* ---------- avisos já visualizados (por marcador, no dispositivo) ---------- */

function vistosKey(marcadorId: string | undefined) {
  return `${VISTOS_KEY}:${marcadorId ?? "anon"}`;
}

export function readVistos(marcadorId: string | undefined): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(vistosKey(marcadorId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function markVistos(marcadorId: string | undefined, ids: string[]) {
  if (typeof window === "undefined") return;
  const set = new Set([...readVistos(marcadorId), ...ids]);
  // Mantém a lista enxuta.
  const next = Array.from(set).slice(-500);
  localStorage.setItem(vistosKey(marcadorId), JSON.stringify(next));
  window.dispatchEvent(new Event("avisos-vistos"));
}

/* ---------------------------- som + push ---------------------------- */

export function somAtivo(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(SOM_KEY) !== "off";
}

export function setSomAtivo(on: boolean) {
  localStorage.setItem(SOM_KEY, on ? "on" : "off");
  window.dispatchEvent(new Event("avisos-som"));
}

/** Bipe curto e discreto, gerado na hora (sem arquivo de áudio). */
export function tocarBipe() {
  if (!somAtivo()) return;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1180].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.16;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    // Navegador bloqueou áudio: o badge e o toast já cobrem o aviso.
  }
}

export function pedirPermissaoPush() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") void Notification.requestPermission();
}

export function notificarPush(titulo: string, corpo: string) {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    new Notification(titulo, { body: corpo, tag: "novo-aviso" });
  } catch {
    // Push é complementar.
  }
}
