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
  /** dias encerrados manualmente (yyyy-mm-dd) */
  dias_encerrados: string[];
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
      .select("id,sector_id,mes,ano,meta_dia,feriados,dias_encerrados");
    if (error) throw error;
    return ((data as MetaSetorMes[]) ?? []).map((m) => ({
      ...m,
      meta_dia: Number(m.meta_dia ?? 0),
      feriados: m.feriados ?? [],
      dias_encerrados: m.dias_encerrados ?? [],
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
  /** meta - atingido (só faz sentido em dias vencidos) */
  resultado: number;
  /** dia já vencido (hoje ou anterior) — mostra o atingido */
  due: boolean;
  /** dia encerrado (anterior a hoje ou encerrado manualmente) — entra na redistribuição */
  closed: boolean;
  lines: DayProductLine[];
  /** meta impossível de diluir com coerência (ex: poucos dias restantes) */
  warning?: string | undefined;
};

/** data de hoje em ISO local (yyyy-mm-dd) */
export function todayIso(): string {
  const d = new Date();
  return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}


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
 * Monta o cálculo de valor por dia.
 * Regra: a quantidade real produzida (última operação do setor) é limitada à
 * quantidade total do produto — o excedente não gera valor.
 * Produtos hipotéticos da simulação não sofrem essa trava.
 */
function makeValueOf(params: {
  days: string[];
  entries: ProductionEntry[];
  opToProduct: Map<string, string>;
  products: Product[];
  allowedProductIds: Set<string>;
  simulated: SimEntry[];
}): (date: string) => DayProductLine[] {
  const { days, entries, opToProduct, products, allowedProductIds, simulated } = params;
  const productById = new Map(products.map((p) => [p.id, p] as const));

  const real = new Map<string, Map<string, number>>();
  const sim = new Map<string, Map<string, number>>();
  const add = (
    target: Map<string, Map<string, number>>,
    date: string,
    productId: string,
    qty: number,
  ) => {
    if (!allowedProductIds.has(productId)) return;
    const m = target.get(date) ?? new Map<string, number>();
    m.set(productId, (m.get(productId) ?? 0) + qty);
    target.set(date, m);
  };

  for (const e of entries) {
    const productId = opToProduct.get(e.operation_id);
    if (!productId) continue;
    add(real, e.entry_date, productId, e.quantity);
  }
  for (const s of simulated) add(sim, s.date, s.productId, s.quantity);

  // trava cumulativa: limita o real ao total do produto, em ordem cronológica
  const capped = new Map<string, Map<string, number>>();
  const used = new Map<string, number>();
  for (const date of [...days].sort()) {
    const dayMap = real.get(date);
    if (!dayMap) continue;
    const out = new Map<string, number>();
    for (const [productId, qty] of dayMap) {
      const total = Number(productById.get(productId)?.total_quantity ?? 0);
      const already = used.get(productId) ?? 0;
      const allowed = Math.max(0, Math.min(qty, total - already));
      used.set(productId, already + allowed);
      if (allowed > 0) out.set(productId, allowed);
    }
    capped.set(date, out);
  }

  return (date: string): DayProductLine[] => {
    const merged = new Map<string, number>(capped.get(date) ?? []);
    for (const [productId, qty] of sim.get(date) ?? []) {
      merged.set(productId, (merged.get(productId) ?? 0) + qty);
    }
    const lines: DayProductLine[] = [];
    for (const [productId, qty] of merged) {
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
    return lines;
  };
}

/**
 * Monta as linhas de dia.
 * - "Atingido" só é computado em dias vencidos (hoje ou anteriores).
 * - Dias anteriores a hoje mantêm a meta base; o saldo acumulado deles
 *   (atingido - meta) é redistribuído entre hoje e os dias seguintes.
 * - Na simulação (`allDue`) todos os dias são tratados como vencidos.
 */
export function buildMonthRows(params: {
  days: string[];
  metaDia: number;
  entries: ProductionEntry[];
  opToProduct: Map<string, string>;
  products: Product[];
  allowedProductIds: Set<string>;
  simulated?: SimEntry[];
  allDue?: boolean;
  today?: string;
  /** dias encerrados manualmente */
  closedDays?: string[];
}): { rows: DayRow[]; metaTotal: number; atingidoTotal: number } {
  const {
    days,
    metaDia,
    entries,
    opToProduct,
    products,
    allowedProductIds,
    simulated = [],
    allDue = false,
    today = todayIso(),
    closedDays = [],
  } = params;
  const manualClosed = new Set(closedDays);
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

  const valueOf = (date: string): DayProductLine[] => {
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
    return lines;
  };

  const isDue = (date: string) => allDue || date <= today;

  // saldo dos dias já encerrados (anteriores a hoje)
  const closed = days.filter((d) => d < today || manualClosed.has(d));
  const saldoFechado = closed.reduce(
    (s, d) => s + valueOf(d).reduce((a, l) => a + l.value, 0) - metaDia,
    0,
  );
  const abertos = days.filter((d) => !closed.includes(d));
  const ajuste = abertos.length > 0 ? -saldoFechado / abertos.length : 0;

  const rows: DayRow[] = [];
  let atingidoTotal = 0;

  for (const date of days) {
    const due = isDue(date);
    const fechado = closed.includes(date);
    let meta = fechado ? metaDia : metaDia + ajuste;
    let warning: string | undefined;
    if (meta < 0) {
      warning = "Meta do mês já superada — nada restante a diluir.";
      meta = 0;
    } else if (!fechado && abertos.length <= 2 && metaDia > 0 && meta > metaDia * 3) {
      warning = "Diferença grande para poucos dias úteis restantes.";
    }

    const lines = due ? valueOf(date) : [];
    const atingido = lines.reduce((s, l) => s + l.value, 0);
    if (due) atingidoTotal += atingido;
    rows.push({
      date,
      meta,
      atingido,
      resultado: atingido - meta,
      due,
      closed: fechado,
      lines,
      warning,
    });
  }

  return { rows, metaTotal, atingidoTotal };
}


/**
 * Linhas da SIMULAÇÃO.
 * - Mostra apenas hoje e dias futuros (dias vencidos são omitidos).
 * - A meta base de cada dia aberto é herdada do módulo real (já redistribuída
 *   com o saldo dos dias encerrados).
 * - Cada dia com produção simulada propaga a diferença (meta - atingido) para
 *   os dias seguintes, em ordem cronológica e de forma acumulada.
 */
export function buildSimulationRows(params: {
  days: string[];
  metaDia: number;
  entries: ProductionEntry[];
  opToProduct: Map<string, string>;
  products: Product[];
  allowedProductIds: Set<string>;
  simulated?: SimEntry[];
  today?: string;
  closedDays?: string[];
}): { rows: DayRow[]; metaTotal: number; atingidoTotal: number } {
  const {
    days,
    metaDia,
    entries,
    opToProduct,
    products,
    allowedProductIds,
    simulated = [],
    today = todayIso(),
    closedDays = [],
  } = params;
  const manualClosed = new Set(closedDays);

  const productById = new Map(products.map((p) => [p.id, p] as const));
  const perDay = new Map<string, Map<string, number>>();
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

  const valueOf = (date: string): DayProductLine[] => {
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
    return lines;
  };

  // saldo real dos dias já encerrados → meta base herdada dos dias abertos
  const closed = days.filter((d) => d < today || manualClosed.has(d));
  const abertos = days.filter((d) => !closed.includes(d));
  const saldoFechado = closed.reduce(
    (s, d) => s + valueOf(d).reduce((a, l) => a + l.value, 0) - metaDia,
    0,
  );
  const baseMeta = metaDia + (abertos.length > 0 ? -saldoFechado / abertos.length : 0);

  const rows: DayRow[] = [];
  let metaTotal = 0;
  let atingidoTotal = 0;
  let deficit = 0; // valor ainda a diluir nos dias restantes

  abertos.forEach((date, i) => {
    const restantes = abertos.length - i;
    let meta = baseMeta + deficit / restantes;
    let warning: string | undefined;
    if (meta < 0) {
      warning = "Meta do mês já superada — nada restante a diluir.";
      meta = 0;
    } else if (restantes <= 2 && metaDia > 0 && meta > metaDia * 3) {
      warning = "Diferença grande para poucos dias úteis restantes.";
    }

    const lines = valueOf(date);
    const atingido = lines.reduce((s, l) => s + l.value, 0);
    const hasData = lines.length > 0;

    deficit = (deficit * (restantes - 1)) / restantes + (hasData ? meta - atingido : 0);

    metaTotal += meta;
    atingidoTotal += atingido;
    rows.push({
      date,
      meta,
      atingido,
      resultado: atingido - meta,
      due: hasData,
      closed: false,
      lines,
      warning,
    });
  });

  return { rows, metaTotal, atingidoTotal };
}
