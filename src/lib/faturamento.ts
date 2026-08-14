import { db } from "@/lib/db";
import type { CatalogOperation, Operation, Product, ProductionEntry } from "@/lib/production";

/* ---------- tipos ---------- */

export type FaturamentoMes = {
  id: string;
  mes: number;
  ano: number;
  created_at: string;
};

export type FaturamentoMesProduto = {
  id: string;
  mes_id: string;
  product_id: string;
};

export type MetaSetorMes = {
  id: string;
  sector_id: string;
  mes: number;
  ano: number;
  meta_dia: number;
  feriados: string[];
};

/* ---------- queries ---------- */

export const faturamentoMesesQuery = {
  queryKey: ["faturamento_meses"],
  queryFn: async (): Promise<FaturamentoMes[]> => {
    const { data, error } = await db
      .from("faturamento_meses")
      .select("id,mes,ano,created_at")
      .order("ano", { ascending: false });
    if (error) throw error;
    return (data as FaturamentoMes[]) ?? [];
  },
};

export const faturamentoMesProdutosQuery = {
  queryKey: ["faturamento_mes_produtos"],
  queryFn: async (): Promise<FaturamentoMesProduto[]> => {
    const { data, error } = await db
      .from("faturamento_mes_produtos")
      .select("id,mes_id,product_id");
    if (error) throw error;
    return (data as FaturamentoMesProduto[]) ?? [];
  },
};

export const metaSetorMesQuery = {
  queryKey: ["meta_setor_mes"],
  queryFn: async (): Promise<MetaSetorMes[]> => {
    const { data, error } = await db
      .from("meta_setor_mes")
      .select("id,sector_id,mes,ano,meta_dia,feriados");
    if (error) throw error;
    return ((data as MetaSetorMes[]) ?? []).map((m) => ({
      ...m,
      meta_dia: Number(m.meta_dia ?? 0),
      feriados: m.feriados ?? [],
    }));
  },
};

/* ---------- datas ---------- */

export const MES_NOMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const mesLabel = (mes: number, ano: number) => `${MES_NOMES[mes - 1]} / ${ano}`;

export const isoDate = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

/** Dias úteis (seg-sex) do mês, excluindo os feriados sinalizados. */
export function workingDays(mes: number, ano: number, feriados: string[] = []): string[] {
  const holidays = new Set(feriados);
  const last = new Date(ano, mes, 0).getDate();
  const days: string[] = [];
  for (let d = 1; d <= last; d++) {
    const weekday = new Date(ano, mes - 1, d).getDay();
    if (weekday === 0 || weekday === 6) continue;
    const iso = isoDate(ano, mes, d);
    if (holidays.has(iso)) continue;
    days.push(iso);
  }
  return days;
}

export const fmtDayLabel = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

/* ---------- realizado por setor ---------- */

export type DayProductLine = {
  productId: string;
  opInterna: string | null;
  name: string;
  quantity: number;
  value: number;
};

export type DayRow = {
  date: string;
  meta: number;
  atingido: number;
  lines: DayProductLine[];
  /** meta impossível de diluir com coerência (ex: poucos dias restantes) */
  warning?: string | undefined;
};

/**
 * Operações (do produto) que são a última operação do setor informado.
 * Reaproveita a mesma regra usada no módulo de Gargalo.
 */
export function lastOpsOfSector(
  sectorId: string,
  operations: Operation[],
  catalogOps: CatalogOperation[],
): Map<string, string> {
  const catSector = new Map(catalogOps.map((c) => [c.id, c.sector_id] as const));
  const map = new Map<string, string>(); // operation_id -> product_id
  for (const o of operations) {
    if (!o.is_last_operation || !o.catalog_operation_id) continue;
    if (catSector.get(o.catalog_operation_id) !== sectorId) continue;
    map.set(o.id, o.product_id);
  }
  return map;
}

export type SimEntry = { date: string; productId: string; quantity: number };

/**
 * Monta as linhas de dia com meta redistribuída.
 * A meta de cada dia usa o que ainda falta para o total do mês dividido pelos
 * dias restantes — sobras reduzem e faltas aumentam a meta dos dias seguintes.
 */
export function buildMonthRows(params: {
  days: string[];
  metaDia: number;
  entries: ProductionEntry[];
  opToProduct: Map<string, string>;
  products: Product[];
  allowedProductIds: Set<string>;
  simulated?: SimEntry[];
}): { rows: DayRow[]; metaTotal: number; atingidoTotal: number } {
  const { days, metaDia, entries, opToProduct, products, allowedProductIds, simulated = [] } = params;
  const productById = new Map(products.map((p) => [p.id, p] as const));
  const metaTotal = metaDia * days.length;

  const perDay = new Map<string, Map<string, number>>(); // date -> productId -> qty
  const push = (date: string, productId: string, qty: number) => {
    if (!allowedProductIds.has(productId)) return;
    const m = perDay.get(date) ?? new Map<string, number>();
    m.set(productId, (m.get(productId) ?? 0) + qty);
    perDay.set(date, m);
  };

  for (const e of entries) {
    const productId = opToProduct.get(e.operation_id);
    if (!productId) continue;
    push(e.entry_date, productId, e.quantity);
  }
  for (const s of simulated) push(s.date, s.productId, s.quantity);

  const rows: DayRow[] = [];
  let realizadoAcumulado = 0;

  days.forEach((date, i) => {
    const restante = days.length - i;
    const faltante = metaTotal - realizadoAcumulado;
    let meta = faltante / restante;
    let warning: string | undefined;
    if (meta < 0) {
      warning = "Meta do mês já superada — nada restante a diluir.";
      meta = 0;
    } else if (restante <= 2 && meta > metaDia * 3 && metaDia > 0) {
      warning = "Diferença grande para poucos dias úteis restantes.";
    }

    const lines: DayProductLine[] = [];
    const dayMap = perDay.get(date);
    if (dayMap) {
      for (const [productId, qty] of dayMap) {
        const p = productById.get(productId);
        if (!p) continue;
        lines.push({
          productId,
          opInterna: p.op_interna,
          name: p.name,
          quantity: qty,
          value: qty * Number(p.unit_value ?? 0),
        });
      }
      lines.sort((a, b) => b.value - a.value);
    }
    const atingido = lines.reduce((s, l) => s + l.value, 0);
    realizadoAcumulado += atingido;
    rows.push({ date, meta, atingido, lines, warning });
  });

  return { rows, metaTotal, atingidoTotal: realizadoAcumulado };
}
