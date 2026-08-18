import { db } from "@/lib/db";

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
  peca_piloto: "sim" | "nao" | "devolvido" | null;
  status: string;
  created_at: string;
  delivery_date: string | null;
  forecast_date: string | null;
  nf_out_number: string | null;
  op_interna: string | null;
};

export const PECA_PILOTO_OPTIONS = [
  { value: "sim", label: "SIM" },
  { value: "nao", label: "NÃO" },
  { value: "devolvido", label: "DEVOLVIDO" },
] as const;

export const PECA_PILOTO_LABEL: Record<string, string> = {
  sim: "SIM",
  nao: "NÃO",
  devolvido: "DEVOLVIDO",
};

/** ordena por OP interna crescente (numérica quando possível) */
export function sortByOpInterna<T extends { op_interna: string | null }>(list: T[]): T[] {
  const key = (v: string | null) => {
    const n = Number(String(v ?? "").replace(/\D/g, ""));
    return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : Number.POSITIVE_INFINITY;
  };
  return [...list].sort(
    (a, b) =>
      key(a.op_interna) - key(b.op_interna) ||
      String(a.op_interna ?? "").localeCompare(String(b.op_interna ?? "")),
  );
}


export type EsteiraItem = {
  id: string;
  produto_id: string;
  data_adicionado: string;
  status: string;
  op_interna: string | null;
  quantidade: number;
};

export const esteiraQuery = {
  queryKey: ["esteira_producao"],
  queryFn: async (): Promise<EsteiraItem[]> => {
    const { data, error } = await db
      .from("esteira_producao")
      .select("id,produto_id,data_adicionado,status,op_interna,quantidade")
      .eq("status", "ativo")
      .order("data_adicionado", { ascending: false });
    if (error) throw error;
    return data as EsteiraItem[];
  },
};

/** Uma fração (OP Interna) de um produto dentro da esteira. */
export type Lote = {
  /** id do registro na esteira */
  id: string;
  product: Product;
  opInterna: string | null;
  quantidade: number;
  dataAdicionado: string;
};

const opInternaKey = (v: string | null | undefined) => {
  const n = Number(String(v ?? "").replace(/\D/g, ""));
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : Number.POSITIVE_INFINITY;
};

/** Constrói as frações (produto + OP interna + quantidade), ordenadas por OP interna. */
export function buildLotes(esteira: EsteiraItem[], products: Product[]): Lote[] {
  const byId = new Map(products.map((p) => [p.id, p] as const));
  return esteira
    .map((e) => {
      const product = byId.get(e.produto_id);
      if (!product) return null;
      return {
        id: e.id,
        product,
        opInterna: e.op_interna,
        quantidade: e.quantidade || 0,
        dataAdicionado: e.data_adicionado,
      } satisfies Lote;
    })
    .filter((x): x is Lote => !!x)
    .sort(
      (a, b) =>
        opInternaKey(a.opInterna) - opInternaKey(b.opInterna) ||
        String(a.opInterna ?? "").localeCompare(String(b.opInterna ?? "")),
    );
}

/** Frações ativas de um produto, ordenadas por OP interna. */
export function lotesOfProduct(esteira: EsteiraItem[], productId: string): EsteiraItem[] {
  return esteira
    .filter((e) => e.produto_id === productId)
    .sort(
      (a, b) =>
        opInternaKey(a.op_interna) - opInternaKey(b.op_interna) ||
        String(a.op_interna ?? "").localeCompare(String(b.op_interna ?? "")),
    );
}

/** Rótulo agregado das OPs internas de um produto: "401-402-403". */
export function opInternaLabel(items: { op_interna: string | null }[]): string {
  const list = items.map((i) => (i.op_interna ?? "").trim()).filter(Boolean);
  return list.join("-");
}

/** Quantidade do produto ainda não distribuída entre as OPs internas ativas. */
export function remainingToDistribute(
  product: Pick<Product, "total_quantity">,
  lotesDoProduto: EsteiraItem[],
  ignoreLoteId?: string,
): number {
  const used = lotesDoProduto
    .filter((l) => l.id !== ignoreLoteId)
    .reduce((s, l) => s + (l.quantidade || 0), 0);
  return Math.max(0, (product.total_quantity ?? 0) - used);
}


export type Company = { id: string; name: string };

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });


export type Operation = {
  id: string;
  product_id: string;
  name: string;
  standard_time: number | null;
  catalog_operation_id: string | null;
  is_last_operation: boolean;
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
  numero_id: number;
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
  is_overtime: boolean;
  ocorrencia_id: string | null;
  created_at?: string;
};

export type Ocorrencia = { id: string; nome: string };

export const ocorrenciasQuery = {
  queryKey: ["ocorrencias"],
  queryFn: async (): Promise<Ocorrencia[]> => {
    const { data, error } = await db.from("ocorrencias").select("id,nome").order("nome");
    if (error) throw error;
    return data as Ocorrencia[];
  },
};

export type OvertimeSlot = {
  id: string;
  start_time: string;
  end_time: string;
};

export const overtimeSlotsQuery = {
  queryKey: ["overtime_slots"],
  queryFn: async (): Promise<OvertimeSlot[]> => {
    const { data, error } = await db
      .from("overtime_slots")
      .select("id,start_time,end_time")
      .order("start_time", { ascending: true });
    if (error) throw error;
    return data as OvertimeSlot[];
  },
};

export type Slot = {
  start: string;
  end: string;
  overtime?: boolean;
  /** minutos de trabalho efetivo da janela (descontando pausas) */
  workMinutes?: number;
  /** janela resultante da fusão de duas ou mais janelas cortadas por uma pausa */
  merged?: boolean;
  /** fusão que não resulta no tempo útil de uma janela inteira */
  ambiguous?: boolean;
};


export const toMinutes = (t: string) => {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
};

export const toTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export const fmt = (t: string) => t.slice(0, 5);

type SlotSource = Pick<ScheduleConfig, "start_time" | "end_time" | "slot_minutes" | "breaks">;

/**
 * Gera as janelas de marcação. Pausas alinhadas ao início/fim das janelas
 * simplesmente removem a janela; pausas desalinhadas fundem as janelas
 * atingidas em uma única janela, cujo tempo útil é a soma dos minutos
 * trabalhados antes e depois da pausa.
 */
export function buildSlots(config: SlotSource | null | undefined): Slot[] {
  if (!config) return [];
  const start = toMinutes(config.start_time);
  const end = toMinutes(config.end_time);
  // A non-positive step would loop forever and freeze/crash the tab.
  const rawStep = Number(config.slot_minutes);
  const step = Number.isFinite(rawStep) && rawStep > 0 ? rawStep : 60;
  const breaks = (config.breaks ?? [])
    .map((b) => ({ start: toMinutes(b.start), end: toMinutes(b.end) }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start);

  const grid: { s: number; e: number; work: number }[] = [];
  for (let cur = start; cur + step <= end; cur += step) {
    const busy = breaks.reduce(
      (acc, b) => acc + Math.max(0, Math.min(cur + step, b.end) - Math.max(cur, b.start)),
      0,
    );
    grid.push({ s: cur, e: cur + step, work: Math.max(0, step - busy) });
  }

  // união das janelas cortadas por uma mesma pausa desalinhada
  const parent = grid.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  for (const b of breaks) {
    const touched = grid
      .map((g, i) => ({ g, i }))
      .filter(({ g }) => g.s < b.end && g.e > b.start)
      .map(({ i }) => i);
    if (touched.length < 2) continue;
    // pausa alinhada: todas as janelas atingidas ficam sem tempo útil
    if (touched.every((i) => grid[i]!.work === 0)) continue;
    for (const i of touched) union(touched[0]!, i);
  }

  const groups = new Map<number, number[]>();
  grid.forEach((_, i) => {
    const root = find(i);
    const list = groups.get(root);
    if (list) list.push(i);
    else groups.set(root, [i]);
  });

  const slots: Slot[] = [];
  for (const [, idx] of Array.from(groups.entries()).sort((a, b) => a[0] - b[0])) {
    const work = idx.reduce((sum, i) => sum + grid[i]!.work, 0);
    if (work <= 0) continue;
    const first = grid[idx[0]!]!;
    const last = grid[idx[idx.length - 1]!]!;
    const merged = idx.length > 1;
    slots.push({
      start: toTime(first.s),
      end: toTime(last.e),
      workMinutes: work,
      merged,
      ambiguous: merged && work !== step,
    });
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
    const { data, error } = await db
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
    const { data, error } = await db.from("companies").select("id,name").order("name");
    if (error) throw error;
    return data as Company[];
  },
};


export const clientsQuery = {
  queryKey: ["clients"],
  queryFn: async (): Promise<Company[]> => {
    const { data, error } = await db.from("clients").select("id,name").order("name");
    if (error) throw error;
    return data as Company[];
  },
};

export const sectorsQuery = {
  queryKey: ["sectors"],
  queryFn: async (): Promise<Sector[]> => {
    const { data, error } = await db
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
    const { data, error } = await db
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
    const { data, error } = await db
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
    const { data, error } = await db.from("employees").select("*").order("name");
    if (error) throw error;
    return data as Employee[];
  },
};

export const scheduleQuery = {
  queryKey: ["schedule_config"],
  queryFn: async (): Promise<ScheduleConfig | null> => {
    const { data, error } = await db.from("schedule_config").select("*").limit(1).maybeSingle();
    if (error) throw error;
    return data as ScheduleConfig | null;
  },
};

export const entriesQuery = (date?: string) => ({
  queryKey: ["production_entries", date ?? "all"],
  queryFn: async (): Promise<ProductionEntry[]> => {
    let q = db.from("production_entries").select("*");
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

/* ---------- meta de produção (peças) por setor e dia ---------- */

export type MetaProducaoDia = {
  id: string;
  sector_id: string;
  data: string;
  product_id: string;
  quantidade: number;
};

export const metaProducaoQuery = (date: string) => ({
  queryKey: ["meta_producao_setor_dia", date],
  queryFn: async (): Promise<MetaProducaoDia[]> => {
    const { data, error } = await db
      .from("meta_producao_setor_dia")
      .select("id,sector_id,data,product_id,quantidade")
      .eq("data", date);
    if (error) throw error;
    return data as MetaProducaoDia[];
  },
});

/** Peças já produzidas na "última operação" do setor para um produto. */
export function producedInSector(
  productId: string,
  sectorId: string,
  operations: Operation[],
  catalogOps: CatalogOperation[],
  entries: Pick<ProductionEntry, "operation_id" | "quantity">[],
): number {
  const catSector = new Map(catalogOps.map((c) => [c.id, c.sector_id]));
  const opIds = new Set(
    operations
      .filter(
        (o) =>
          o.product_id === productId &&
          o.is_last_operation &&
          o.catalog_operation_id &&
          catSector.get(o.catalog_operation_id) === sectorId,
      )
      .map((o) => o.id),
  );
  return entries
    .filter((e) => opIds.has(e.operation_id))
    .reduce((s, e) => s + e.quantity, 0);
}
