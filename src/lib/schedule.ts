import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { buildSlots, fmt, type Break, type Slot } from "@/lib/production";

export type DaySchedule = {
  id: string;
  weekday: number; // 0 = domingo … 6 = sábado
  start_time: string;
  end_time: string;
  slot_minutes: number;
  breaks: Break[];
  is_folga: boolean;
};

export type Feriado = { id: string; data: string; nome: string | null };

export const WEEKDAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export const daySchedulesQuery = {
  queryKey: ["schedule_day_config"],
  queryFn: async (): Promise<DaySchedule[]> => {
    const { data, error } = await db
      .from("schedule_day_config")
      .select("id,weekday,start_time,end_time,slot_minutes,breaks,is_folga")
      .order("weekday", { ascending: true });
    if (error) throw error;
    return ((data as DaySchedule[]) ?? []).map((d) => ({
      ...d,
      start_time: fmt(d.start_time),
      end_time: fmt(d.end_time),
      slot_minutes: Number(d.slot_minutes) || 60,
      breaks: (d.breaks ?? []).map((b) => ({ ...b, start: fmt(b.start), end: fmt(b.end) })),
    }));
  },
};

export const feriadosQuery = {
  queryKey: ["feriados"],
  queryFn: async (): Promise<Feriado[]> => {
    const { data, error } = await db
      .from("feriados")
      .select("id,data,nome")
      .order("data", { ascending: true });
    if (error) throw error;
    return (data as Feriado[]) ?? [];
  },
};

/** Dia da semana (0-6) de uma data ISO, sem depender de fuso horário. */
export const weekdayOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).getDay();
};

export type DaySlots = {
  slots: Slot[];
  /** dia da semana marcado como folga */
  folga: boolean;
  /** data cadastrada como feriado */
  feriado: boolean;
  /** nome do feriado, quando houver */
  feriadoNome: string | null;
  /** todas as marcações do dia são hora extra */
  forcedOvertime: boolean;
  slotMinutes: number;
};

export function buildDaySlots(
  days: DaySchedule[],
  feriados: Feriado[],
  date: string,
): DaySlots {
  const weekday = weekdayOf(date);
  const cfg = days.find((d) => d.weekday === weekday) ?? null;
  const feriado = feriados.find((f) => f.data === date) ?? null;
  const folga = Boolean(cfg?.is_folga);
  const forcedOvertime = folga || Boolean(feriado);

  // Em folga/feriado usamos a estrutura de um dia útil como referência visual.
  const reference = forcedOvertime ? (days.find((d) => !d.is_folga) ?? cfg) : cfg;
  const slots = buildSlots(reference).map((s) => ({ ...s, overtime: forcedOvertime }));

  return {
    slots,
    folga,
    feriado: Boolean(feriado),
    feriadoNome: feriado?.nome ?? null,
    forcedOvertime,
    slotMinutes: reference?.slot_minutes ?? 60,
  };
}

/** Janelas de marcação de uma data específica. */
export function useDaySlots(date: string) {
  const daysQ = useQuery(daySchedulesQuery);
  const feriadosQ = useQuery(feriadosQuery);
  const days = useMemo(() => daysQ.data ?? [], [daysQ.data]);
  const feriados = useMemo(() => feriadosQ.data ?? [], [feriadosQ.data]);
  const result = useMemo(() => buildDaySlots(days, feriados, date), [days, feriados, date]);
  return {
    ...result,
    days,
    feriados,
    isLoading: daysQ.isLoading || feriadosQ.isLoading,
    isError: daysQ.isError || feriadosQ.isError,
  };
}
