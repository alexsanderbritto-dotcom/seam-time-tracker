import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  name: string;
  reference: string;
  op_number: string;
  cliente: string | null;
  empresa: string | null;
  total_quantity: number;
  unit_value: number;
  entry_date: string | null;
  nf_number: string | null;
  photo_url: string | null;
  pilot_photos: string[] | null;
  status: string;
  created_at: string;
  delivery_date: string | null;
  forecast_date: string | null;
  nf_out_number: string | null;
  op_interna: string | null;
};

export type EsteiraItem = {
  id: string;
  produto_id: string;
  data_adicionado: string;
  status: string;
};

export const esteiraQuery = {
  queryKey: ["esteira_producao"],
  queryFn: async (): Promise<EsteiraItem[]> => {
    const { data, error } = await supabase
      .from("esteira_producao")
      .select("id,produto_id,data_adicionado,status")
      .eq("status", "ativo")
      .order("data_adicionado", { ascending: false });
    if (error) throw error;
    return data as EsteiraItem[];
  },
};

export type Company = { id: string; name: string };

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });


export type Operation = {
  id: string;
  product_id: string;
  name: string;
  standard_time: number | null;
  catalog_operation_id: string | null;
};

export type Sector = { id: string; name: string };

export type CatalogOperation = {
  id: string;
  sector_id: string;
  name: string;
  expected_per_hour: number | null;
  is_last_operation: boolean;
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

export const companiesQuery = {
  queryKey: ["companies"],
  queryFn: async (): Promise<Company[]> => {
    const { data, error } = await supabase.from("companies").select("id,name").order("name");
    if (error) throw error;
    return data as Company[];
  },
};


export const clientsQuery = {
  queryKey: ["clients"],
  queryFn: async (): Promise<Company[]> => {
    const { data, error } = await supabase.from("clients").select("id,name").order("name");
    if (error) throw error;
    return data as Company[];
  },
};

export const sectorsQuery = {
  queryKey: ["sectors"],
  queryFn: async (): Promise<Sector[]> => {
    const { data, error } = await supabase
      .from("sectors")
      .select("id,name")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data as Sector[];
  },
};

export const catalogOperationsQuery = {
  queryKey: ["catalog_operations"],
  queryFn: async (): Promise<CatalogOperation[]> => {
    const { data, error } = await supabase
      .from("catalog_operations")
      .select("id,sector_id,name,expected_per_hour,is_last_operation")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data as CatalogOperation[];
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

/* ---------- conclusão por operação ---------- */

export type OperationProgress = {
  operationId: string;
  name: string;
  produced: number;
  target: number;
  pct: number;
  done: boolean;
};

export function productCompletion(
  product: Pick<Product, "id" | "total_quantity">,
  operations: Operation[],
  entries: Pick<ProductionEntry, "product_id" | "operation_id" | "quantity">[],
): { pct: number; done: boolean; perOperation: OperationProgress[] } {
  const target = product.total_quantity ?? 0;
  const ops = operations.filter((o) => o.product_id === product.id);
  const perOperation: OperationProgress[] = ops.map((o) => {
    const produced = entries
      .filter((e) => e.operation_id === o.id)
      .reduce((s, e) => s + e.quantity, 0);
    const pct = target > 0 ? Math.min((produced / target) * 100, 100) : 0;
    return { operationId: o.id, name: o.name, produced, target, pct, done: target > 0 && produced >= target };
  });
  if (perOperation.length === 0 || target <= 0) return { pct: 0, done: false, perOperation };
  const pct = perOperation.reduce((s, o) => s + o.pct, 0) / perOperation.length;
  return { pct, done: perOperation.every((o) => o.done), perOperation };
}

export const STATUS_LABEL: Record<string, string> = {
  em_estoque: "Em estoque",
  em_producao: "Em produção",
  finalizado: "Finalizado",
};
