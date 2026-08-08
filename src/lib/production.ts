import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  name: string;
  reference: string;
  op_number: string;
  brand: string | null;
  total_quantity: number;
  status: string;
  created_at: string;
};

export type Operation = {
  id: string;
  product_id: string;
  name: string;
  standard_time: number | null;
};

export type Employee = {
  id: string;
  name: string;
  role: string | null;
  active: boolean;
};

export type Break = { start: string; end: string; label: string };

export type ScheduleConfig = {
  id: string;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  breaks: Break[];
};

export type ProductionEntry = {
  id: string;
  employee_id: string;
  product_id: string;
  operation_id: string;
  slot_start: string;
  slot_end: string;
  quantity: number;
  entry_date: string;
};

export type Slot = { start: string; end: string };

export const toMinutes = (t: string) => {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
};

export const toTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export const fmt = (t: string) => t.slice(0, 5);

export function buildSlots(config: ScheduleConfig | null | undefined): Slot[] {
  if (!config) return [];
  const start = toMinutes(config.start_time);
  const end = toMinutes(config.end_time);
  const step = config.slot_minutes || 60;
  const breaks = (config.breaks ?? []).map((b) => ({
    start: toMinutes(b.start),
    end: toMinutes(b.end),
  }));
  const slots: Slot[] = [];
  for (let cur = start; cur + step <= end; cur += step) {
    const overlaps = breaks.some((b) => cur < b.end && cur + step > b.start);
    if (!overlaps) slots.push({ start: toTime(cur), end: toTime(cur + step) });
  }
  return slots;
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ---------- queries ---------- */

export const productsQuery = {
  queryKey: ["products"],
  queryFn: async (): Promise<Product[]> => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Product[];
  },
};

export const operationsQuery = {
  queryKey: ["operations"],
  queryFn: async (): Promise<Operation[]> => {
    const { data, error } = await supabase
      .from("operations")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data as Operation[];
  },
};

export const employeesQuery = {
  queryKey: ["employees"],
  queryFn: async (): Promise<Employee[]> => {
    const { data, error } = await supabase.from("employees").select("*").order("name");
    if (error) throw error;
    return data as Employee[];
  },
};

export const scheduleQuery = {
  queryKey: ["schedule_config"],
  queryFn: async (): Promise<ScheduleConfig | null> => {
    const { data, error } = await supabase.from("schedule_config").select("*").limit(1).maybeSingle();
    if (error) throw error;
    return data as ScheduleConfig | null;
  },
};

export const entriesQuery = (date?: string) => ({
  queryKey: ["production_entries", date ?? "all"],
  queryFn: async (): Promise<ProductionEntry[]> => {
    let q = supabase.from("production_entries").select("*");
    if (date) q = q.eq("entry_date", date);
    const { data, error } = await q.order("slot_start");
    if (error) throw error;
    return data as ProductionEntry[];
  },
});
