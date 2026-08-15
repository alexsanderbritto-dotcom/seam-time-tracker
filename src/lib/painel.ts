import { useCallback, useEffect, useRef, useState } from "react";
import { fmt, type Slot } from "@/lib/production";

/** Índice da janela (slot) que contém o horário atual; -1 se nenhuma. */
export function findCurrentSlot(slots: Slot[], now = new Date()): number {
  const cur = now.getHours() * 60 + now.getMinutes();
  const min = (t: string) => {
    const [h, m] = fmt(t).split(":");
    return Number(h) * 60 + Number(m);
  };
  let idx = slots.findIndex((s) => cur >= min(s.start) && cur < min(s.end));
  if (idx >= 0) return idx;
  // fora de janela: usa a última janela já iniciada
  for (let i = slots.length - 1; i >= 0; i--) {
    if (cur >= min(slots[i]!.start)) return i;
  }
  return slots.length > 0 ? 0 : -1;
}

export type PerfLevel = "low" | "near" | "ok";

export function perfLevel(pct: number | null | undefined): PerfLevel {
  if (pct == null) return "low";
  if (pct >= 100) return "ok";
  if (pct >= 80) return "near";
  return "low";
}

export const PERF_COLOR: Record<PerfLevel, string> = {
  low: "#ef4444",
  near: "#f59e0b",
  ok: "#22c55e",
};

export const PERF_TEXT: Record<PerfLevel, string> = {
  low: "text-red-400",
  near: "text-amber-400",
  ok: "text-emerald-400",
};

/** Toca um som curto de comemoração usando WebAudio (sem arquivos externos). */
function playCheer() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.5);
    });
    window.setTimeout(() => void ctx.close(), 1500);
  } catch {
    /* áudio bloqueado pelo navegador */
  }
}

/**
 * Dispara celebração apenas na transição de "<100%" para ">=100%",
 * uma única vez por chave (colaborador/setor + janela).
 */
export function useCelebration(soundEnabled: boolean) {
  const fired = useRef<Set<string>>(new Set());
  const [active, setActive] = useState<Record<string, boolean>>({});
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const report = useCallback(
    (key: string, pct: number | null) => {
      if (pct == null) return;
      if (pct >= 100) {
        if (fired.current.has(key)) return;
        fired.current.add(key);
        setActive((s) => ({ ...s, [key]: true }));
        if (soundEnabled) playCheer();
        const t = window.setTimeout(
          () => setActive((s) => ({ ...s, [key]: false })),
          6000,
        );
        timers.current.push(t);
      } else {
        fired.current.delete(key);
      }
    },
    [soundEnabled],
  );

  const isCelebrating = useCallback((key: string) => !!active[key], [active]);

  return { report, isCelebrating };
}
