import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { MetaProducaoDialog } from "@/components/MetaProducaoDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDaySlots } from "@/lib/schedule";
import { SearchableSelect, type SearchableOption } from "@/components/SearchableSelect";


import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  catalogOperationsQuery,
  employeesQuery,
  entriesQuery,
  buildLotes,
  esteiraQuery,
  fmt,
  metaProducaoQuery,
  ocorrenciasQuery,
  operationsQuery,
  overtimeSlotsQuery,
  productCompletion,
  productsQuery,
  sectorsQuery,
  todayISO,
  type Slot,
} from "@/lib/production";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard de Produção | Controle de Confecção" },
      {
        name: "description",
        content:
          "Acompanhe a produção do dia por colaborador, por horário e o avanço de cada ordem de produção.",
      },
      { property: "og:title", content: "Dashboard de Produção | Controle de Confecção" },
      {
        property: "og:description",
        content: "Produção por colaborador, por horário e avanço de cada OP.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [date, setDate] = useState(todayISO());
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [operationFilter, setOperationFilter] = useState("all");
  const [movementFilter, setMovementFilter] = useState("all");
  const [ocorrenciaFilter, setOcorrenciaFilter] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [metaOpen, setMetaOpen] = useState(false);


  const { data: employees = [] } = useQuery(employeesQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const { data: operations = [] } = useQuery(operationsQuery);
  const { data: dayEntries = [] } = useQuery(entriesQuery(date));
  const { data: allEntries = [] } = useQuery(entriesQuery());
  const { data: sectors = [] } = useQuery(sectorsQuery);
  const { data: catalogOps = [] } = useQuery(catalogOperationsQuery);
  const { data: esteira = [] } = useQuery(esteiraQuery);
  const { data: metas = [] } = useQuery(metaProducaoQuery(date));
  const { data: ocorrencias = [] } = useQuery(ocorrenciasQuery);

  const ocorrenciaName = useMemo(
    () => new Map(ocorrencias.map((o) => [o.id, o.nome] as const)),
    [ocorrencias],
  );

  const ocorrenciaOptions = useMemo<SearchableOption[]>(
    () => [
      { value: "all", label: "Todas", alwaysShow: true },
      { value: "any", label: "Com ocorrência", alwaysShow: true },
      ...ocorrencias.map((o) => ({ value: o.id, label: o.nome })),
    ],
    [ocorrencias],
  );

  /** frações (OP interna) ativas na esteira, ordenadas por OP interna */
  const esteiraLotes = useMemo(() => buildLotes(esteira, products), [esteira, products]);

  const employeeOptions = useMemo<SearchableOption[]>(
    () => [
      { value: "all", label: "Todos", alwaysShow: true },
      ...employees.map((e) => ({ value: e.id, label: e.name })),
    ],
    [employees],
  );

  const productOptions = useMemo<SearchableOption[]>(
    () => [
      { value: "all", label: "Todos", alwaysShow: true },
      ...products.map((p) => ({
        value: p.id,
        label: `${p.name} · OP ${p.op_number}`,
        searchText: `${p.op_number} ${p.op_interna ?? ""} ${p.reference}`,
      })),
    ],
    [products],
  );

  const operationOptions = useMemo<SearchableOption[]>(() => {
    const sectorName = new Map(sectors.map((s) => [s.id, s.name]));
    return [
      { value: "all", label: "Todas", alwaysShow: true },
      ...catalogOps.map((c) => ({
        value: c.id,
        label: c.name,
        searchText: sectorName.get(c.sector_id) ?? "",
        node: (
          <span>
            {c.name}{" "}
            <span className="text-xs text-muted-foreground">
              {sectorName.get(c.sector_id) ?? ""}
            </span>
          </span>
        ),
      })),
    ];
  }, [catalogOps, sectors]);

  const movementOptions = useMemo<SearchableOption[]>(
    () => [
      { value: "all", label: "Todos" },
      { value: "movimento", label: "Em movimento" },
      { value: "parado", label: "Parado" },
    ],
    [],
  );


  const { data: overtimeSlots = [] } = useQuery(overtimeSlotsQuery);

  const { slots: normalSlots, slotMinutes: daySlotMinutes } = useDaySlots(date);

  // janelas de hora extra só aparecem quando houve marcação com quantidade
  const slots = useMemo<Slot[]>(() => {
    const usedKeys = new Set(
      dayEntries
        .filter((e) => e.is_overtime && e.quantity > 0)
        .map((e) => fmt(e.slot_start)),
    );
    const extras = overtimeSlots
      .filter((o) => usedKeys.has(fmt(o.start_time)))
      .map((o) => ({ start: fmt(o.start_time), end: fmt(o.end_time), overtime: true }));
    return [
      ...normalSlots.map((s) => ({ ...s, overtime: false })),
      ...extras.sort((a, b) => a.start.localeCompare(b.start)),
    ];
  }, [normalSlots, overtimeSlots, dayEntries]);

  const inSlot = (e: { slot_start: string; is_overtime: boolean }, s: Slot) =>
    fmt(e.slot_start) === fmt(s.start) && Boolean(e.is_overtime) === Boolean(s.overtime);

  const slotKey = (s: Slot) => `${s.start}-${s.overtime ? "x" : "n"}`;

  const SlotHead = ({ s }: { s: Slot }) => (
    <>
      {s.start}–{s.end}
      {s.overtime ? (
        <span className="ml-1 text-[9px] font-sans text-muted-foreground">(extra)</span>
      ) : null}
    </>
  );

  // operação do produto -> setor, apenas quando é a última operação do setor no produto
  const opSector = useMemo(() => {
    const catSector = new Map(catalogOps.map((c) => [c.id, c.sector_id]));
    const map = new Map<string, string>();
    for (const o of operations) {
      if (!o.is_last_operation || !o.catalog_operation_id) continue;
      const sectorId = catSector.get(o.catalog_operation_id);
      if (sectorId) map.set(o.id, sectorId);
    }
    return map;
  }, [operations, catalogOps]);


  const opCatalog = useMemo(
    () => new Map(operations.map((o) => [o.id, o.catalog_operation_id] as const)),
    [operations],
  );

  // operation id -> sector id (via catalog_operation)
  const opSectorAll = useMemo(() => {
    const catSector = new Map(catalogOps.map((c) => [c.id, c.sector_id]));
    const map = new Map<string, string>();
    for (const o of operations) {
      if (o.catalog_operation_id) {
        const sid = catSector.get(o.catalog_operation_id);
        if (sid) map.set(o.id, sid);
      }
    }
    return map;
  }, [operations, catalogOps]);

  const matchesOp = useCallback(
    (operationId: string) =>
      operationFilter === "all" || opCatalog.get(operationId) === operationFilter,
    [operationFilter, opCatalog],
  );

  const visibleOperations = useMemo(
    () =>
      operationFilter === "all"
        ? operations
        : operations.filter((o) => o.catalog_operation_id === operationFilter),
    [operations, operationFilter],
  );

  const sectorSlotTotal = (sectorId: string, slot: Slot) =>
    dayEntries
      .filter(
        (e) =>
          opSector.get(e.operation_id) === sectorId && matchesOp(e.operation_id) && inSlot(e, slot),
      )
      .reduce((s, e) => s + e.quantity, 0);

  const filtered = useMemo(
    () =>
      dayEntries.filter(
        (e) =>
          (employeeFilter === "all" || e.employee_id === employeeFilter) &&
          (productFilter === "all" || e.product_id === productFilter) &&
          (operationFilter === "all" || opCatalog.get(e.operation_id) === operationFilter) &&
          (ocorrenciaFilter === "all" ||
            (ocorrenciaFilter === "any"
              ? !!e.ocorrencia_id
              : e.ocorrencia_id === ocorrenciaFilter)),
      ),
    [dayEntries, employeeFilter, productFilter, operationFilter, ocorrenciaFilter, opCatalog],
  );



  const total = filtered.reduce((s, e) => s + e.quantity, 0);

  const expectedPerHour = useMemo(() => {
    const byCatalog = new Map(catalogOps.map((c) => [c.id, c.expected_per_hour]));
    const map = new Map<string, number | null>();
    for (const o of operations) {
      map.set(o.id, o.catalog_operation_id ? (byCatalog.get(o.catalog_operation_id) ?? null) : null);
    }
    return map;
  }, [operations, catalogOps]);

  const slotHours = daySlotMinutes / 60;

  const productivity = useMemo(() => {
    const emps = employees.filter(
      (e) => employeeFilter === "all" || e.id === employeeFilter,
    );
    // Agrupa por operação de catálogo (mesma operação em produtos diferentes = 1 linha)
    const opKeyOf = (operationId: string) =>
      opCatalog.get(operationId) ?? `op:${operationId}`;
    const opName = new Map<string, string>();
    for (const o of operations) if (!opName.has(opKeyOf(o.id))) opName.set(opKeyOf(o.id), o.name);

    // Resolve lote -> OP Interna (e fallback produto -> OP Interna master) para o tooltip
    const loteOpInterna = new Map<string, string>();
    for (const l of esteiraLotes) loteOpInterna.set(l.id, l.opInterna ?? "");
    const productOpInterna = new Map<string, string>();
    for (const p of products) productOpInterna.set(p.id, p.op_interna ?? "");

    return emps
      .map((emp) => {
        const empEntries = filtered.filter((e) => e.employee_id === emp.id);
        const opKeys = Array.from(new Set(empEntries.map((e) => opKeyOf(e.operation_id))));

        // Para cada janela: soma direta das frações (produzido / meta original).
        // A "meta ajustada" é apenas explicativa e segue a ordem cronológica de lançamento.
        const slotInfo = slots.map((s) => {
          const worked = [...empEntries.filter((e) => inSlot(e, s))].sort((a, b) =>
            (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id),
          );
          const byOp = new Map<
            string,
            {
              produced: number;
              meta: number | null;
              adjusted: number | null;
              opPct: number | null;
              byProduct: Map<string, number>;
              byLote: Map<string, number>;
            }
          >();
          let usedFraction = 0;
          for (const e of worked) {
            const key = opKeyOf(e.operation_id);
            const eph = expectedPerHour.get(e.operation_id);
            const meta = eph != null ? eph * ((s.workMinutes ?? daySlotMinutes) / 60) : null;
            const prev = byOp.get(key);
            const remaining = Math.max(0, 1 - usedFraction);
            const adjusted = meta != null ? meta * remaining : null;
            const fraction = meta != null && meta > 0 ? e.quantity / meta : 0;
            usedFraction += fraction;
            const loteKey = e.lote_id ?? `p:${e.product_id}`;
            if (prev) {
              prev.produced += e.quantity;
              prev.byProduct.set(
                e.product_id,
                (prev.byProduct.get(e.product_id) ?? 0) + e.quantity,
              );
              prev.byLote.set(loteKey, (prev.byLote.get(loteKey) ?? 0) + e.quantity);
              prev.opPct = prev.meta != null && prev.meta > 0 ? (prev.produced / prev.meta) * 100 : null;
            } else {
              byOp.set(key, {
                produced: e.quantity,
                meta,
                adjusted,
                opPct: meta != null && meta > 0 ? (e.quantity / meta) * 100 : null,
                byProduct: new Map([[e.product_id, e.quantity]]),
                byLote: new Map([[loteKey, e.quantity]]),
              });
            }
          }
          const occNames = Array.from(
            new Set(
              worked
                .filter((e) => e.ocorrencia_id)
                .map((e) => ocorrenciaName.get(e.ocorrencia_id!) ?? "Ocorrência"),
            ),
          );
          return {
            byOp,
            occNames,
            // Horário com ocorrência não gera percentual de produtividade.
            hourPct: occNames.length > 0 ? null : worked.length > 0 ? usedFraction * 100 : null,
          };
        });

        const rows = opKeys.map((opId) => {
          const perSlot = slotInfo.map((info) => {
            const d = info.byOp.get(opId);
            return {
              produced: d?.produced ?? 0,
              estimated: d?.meta ?? null,
              adjusted: d?.adjusted ?? null,
              opPct: d?.opPct ?? null,
              active: !!d,
              byProduct: d ? Array.from(d.byProduct.entries()) : [],
            };
          });
          const totalProduced = perSlot.reduce((a, c) => a + c.produced, 0);
          const totalEstimated = perSlot.reduce((a, c) => a + (c.estimated ?? 0), 0);
          return {
            opId,
            name: opName.get(opId) ?? "Operação",
            perSlot,
            totalProduced,
            totalEstimated,
          };
        });

        const hourPcts = slotInfo.map((i) => i.hourPct);
        const hourOccs = slotInfo.map((i) => i.occNames);
        const dayPct = (() => {
          const vals = hourPcts.filter((v): v is number => v != null);
          return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        })();
        return { emp, rows, hourPcts, hourOccs, dayPct };
      })
      .filter((g) => g.rows.length > 0);
  }, [employees, employeeFilter, filtered, slots, operations, opCatalog, expectedPerHour, slotHours, daySlotMinutes, ocorrenciaName]);

  const workHours = useMemo(
    () => normalSlots.length * slotHours,
    [normalSlots, slotHours],
  );

  /** meta de peças por setor no dia selecionado */
  const sectorMeta = useMemo(() => {
    const map = new Map<string, { total: number; perHour: number }>();
    for (const m of metas) {
      const prev = map.get(m.sector_id)?.total ?? 0;
      map.set(m.sector_id, { total: prev + (m.quantidade ?? 0), perHour: 0 });
    }
    for (const [k, v] of map) {
      map.set(k, { total: v.total, perHour: workHours > 0 ? v.total / workHours : 0 });
    }
    return map;
  }, [metas, workHours]);

  const perfClass = (produced: number, estimated: number | null) => {
    if (estimated == null || estimated <= 0) return "";
    const r = produced / estimated;
    if (r >= 1) return "text-emerald-600 dark:text-emerald-400 font-semibold";
    if (r >= 0.8) return "text-amber-600 dark:text-amber-400 font-medium";
    return "text-destructive font-medium";
  };

  const pctClass = (pct: number | null) => {
    if (pct == null) return "text-muted-foreground";
    if (pct >= 100) return "text-emerald-600 dark:text-emerald-400 font-semibold";
    if (pct >= 80) return "text-amber-600 dark:text-amber-400 font-medium";
    return "text-destructive font-medium";
  };


  const visibleProducts = useMemo(() => {
    return esteiraLotes
      .map((lote) => {
        const loteEntries = allEntries.filter((e) => e.lote_id === lote.id);
        const { pct, done, perOperation } = productCompletion(
          { id: lote.product.id, total_quantity: lote.quantidade },
          visibleOperations,
          loteEntries,
        );
        const moving = perOperation.some((op) => op.pct > 0 && op.pct < 100);
        return { lote, p: lote.product, pct, done, perOperation, moving };
      })
      .filter(
        (r) =>
          movementFilter === "all" ||
          (movementFilter === "movimento" ? r.moving : !r.moving),
      );
  }, [esteiraLotes, visibleOperations, allEntries, movementFilter]);

  // Produção por operação x horário (todos os colaboradores e produtos)
  const opHourRows = useMemo(() => {
    const keyOf = (operationId: string) => opCatalog.get(operationId) ?? `op:${operationId}`;
    const name = new Map<string, string>();
    for (const o of operations) if (!name.has(keyOf(o.id))) name.set(keyOf(o.id), o.name);
    const base = dayEntries.filter((e) => matchesOp(e.operation_id));
    const keys = Array.from(new Set(base.map((e) => keyOf(e.operation_id))));
    return keys
      .map((k) => {
        const perSlot = slots.map((s) =>
          base
            .filter((e) => keyOf(e.operation_id) === k && inSlot(e, s))
            .reduce((a, e) => a + e.quantity, 0),
        );
        return {
          key: k,
          name: name.get(k) ?? "Operação",
          perSlot,
          total: perSlot.reduce((a, b) => a + b, 0),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dayEntries, operations, opCatalog, slots, operationFilter, matchesOp]);


  return (
    <AppLayout title="Dashboard" subtitle="Acompanhamento da produção.">
      <MetaProducaoDialog
        open={metaOpen}
        onOpenChange={setMetaOpen}
        date={date}
        sectors={sectors}
        lotes={esteiraLotes}
        operations={operations}
        catalogOps={catalogOps}
        entries={allEntries}
        metas={metas}
      />
      <div className="space-y-5">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-4 pt-6">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                className="w-44"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="w-56 space-y-1.5">
              <Label>Colaborador</Label>
              <SearchableSelect
                searchOnly
                options={employeeOptions}
                value={employeeFilter}
                onChange={setEmployeeFilter}
                searchPlaceholder="Digite o nome..."
              />
            </div>
            <div className="w-64 space-y-1.5">
              <Label>Produto / OP</Label>
              <SearchableSelect
                searchOnly
                options={productOptions}
                value={productFilter}
                onChange={setProductFilter}
                searchPlaceholder="Digite nome ou OP..."
              />
            </div>
            <div className="w-64 space-y-1.5">
              <Label>Operação</Label>
              <SearchableSelect
                searchOnly
                options={operationOptions}
                value={operationFilter}
                onChange={setOperationFilter}
                searchPlaceholder="Digite a operação..."
              />
            </div>
            <div className="w-56 space-y-1.5">
              <Label>Ocorrência</Label>
              <SearchableSelect
                options={ocorrenciaOptions}
                value={ocorrenciaFilter}
                onChange={setOcorrenciaFilter}
                searchPlaceholder="Digite a ocorrência..."
              />
            </div>
            <div className="w-48 space-y-1.5">
              <Label>Situação</Label>
              <SearchableSelect
                options={movementOptions}
                value={movementFilter}
                onChange={setMovementFilter}
              />
            </div>


            <div className="ml-auto rounded-md bg-secondary px-4 py-2 text-right">
              <p className="text-xs text-muted-foreground">Total no dia</p>
              <p className="text-2xl font-semibold tabular-nums">{total}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Produção por hora e por setor</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Total de peças concluídas por setor, com base nas operações marcadas como última
                  etapa.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setMetaOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Adicionar meta
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card">Setor</TableHead>
                    {slots.map((s) => (
                      <TableHead
                        key={slotKey(s)}
                        className="whitespace-nowrap text-center font-mono text-xs"
                      >
                        <SlotHead s={s} />
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sectors.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={slots.length + 2}
                        className="py-10 text-center text-muted-foreground"
                      >
                        Nenhum setor cadastrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sectors.map((sec) => {
                      const row = slots.map((s) => sectorSlotTotal(sec.id, s));
                      const totalRow = row.reduce((a, b) => a + b, 0);
                      const meta = sectorMeta.get(sec.id);
                      return (
                        <Fragment key={sec.id}>
                          <TableRow>
                            <TableCell className="sticky left-0 bg-card font-medium">
                              {sec.name}
                            </TableCell>
                            {row.map((v, i) => (
                              <TableCell key={slotKey(slots[i]!)} className="text-center tabular-nums">

                                {v > 0 ? v : <span className="text-muted-foreground">–</span>}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-semibold tabular-nums">
                              {totalRow}
                            </TableCell>
                          </TableRow>
                          {meta ? (
                            <>
                              <TableRow className="bg-muted/40">
                                <TableCell className="sticky left-0 bg-card py-1.5 pl-6 text-xs text-muted-foreground">
                                  Meta / hora
                                </TableCell>
                                {slots.map((s) => (
                                  <TableCell
                                    key={slotKey(s)}
                                    className="py-1.5 text-center text-xs tabular-nums"
                                  >
                                    {s.overtime ? (
                                      <span className="text-muted-foreground">–</span>
                                    ) : (
                                      Math.round(meta.perHour)
                                    )}
                                  </TableCell>
                                ))}
                                <TableCell className="py-1.5 text-right text-xs font-medium tabular-nums">
                                  {meta.total}
                                </TableCell>
                              </TableRow>
                              <TableRow className="bg-muted/40">
                                <TableCell className="sticky left-0 bg-card py-1.5 pl-6 text-xs text-muted-foreground">
                                  Resultado
                                </TableCell>
                                {slots.map((s, i) => {
                                  const produced = row[i] ?? 0;
                                  if (s.overtime || meta.perHour <= 0)
                                    return (
                                      <TableCell
                                        key={slotKey(s)}
                                        className="py-1.5 text-center text-xs text-muted-foreground"
                                      >
                                        –
                                      </TableCell>
                                    );
                                  const diff = produced - meta.perHour;
                                  const pct = (produced / meta.perHour) * 100;
                                  return (
                                    <TableCell
                                      key={slotKey(s)}
                                      className={cn(
                                        "py-1.5 text-center text-xs tabular-nums",
                                        pctClass(pct),
                                      )}
                                    >
                                      <div className="leading-tight">
                                        <div>
                                          {diff >= 0 ? "+" : ""}
                                          {Math.round(diff)}
                                        </div>
                                        <div className="text-[10px] opacity-80">
                                          {Math.round(pct)}%
                                        </div>
                                      </div>
                                    </TableCell>
                                  );
                                })}
                                <TableCell
                                  className={cn(
                                    "py-1.5 text-right text-xs tabular-nums",
                                    pctClass(meta.total > 0 ? (totalRow / meta.total) * 100 : null),
                                  )}
                                >
                                  {totalRow - meta.total >= 0 ? "+" : ""}
                                  {totalRow - meta.total}
                                </TableCell>
                              </TableRow>
                            </>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}

                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>


        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Produtividade por colaborador e operação</CardTitle>
            <p className="text-sm text-muted-foreground">
              O atingimento de cada hora é a soma direta das frações de cada operação (produzido ÷
              meta original), sem limite em 100% e independente da ordem de lançamento. A meta
              ajustada exibida em cada célula é apenas explicativa (tempo restante na hora conforme a
              ordem das marcações).
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {productivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma produção registrada com estes filtros.
              </p>
            ) : (
              productivity.map(({ emp, rows, hourPcts, hourOccs, dayPct }) => (
                <div key={emp.id} className="space-y-2">
                  <p className="font-medium">{emp.name}</p>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-card">Operação</TableHead>
                          {slots.map((s) => (
                            <TableHead
                              key={slotKey(s)}
                              className="whitespace-nowrap text-center font-mono text-xs"
                            >
                              <SlotHead s={s} />
                            </TableHead>
                          ))}
                          <TableHead className="text-right">Total prod.</TableHead>
                          <TableHead className="text-right">Total est.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => (
                          <TableRow key={r.opId}>
                            <TableCell className="sticky left-0 bg-card">{r.name}</TableCell>
                            {r.perSlot.map((c, i) => (
                              <TableCell key={slotKey(slots[i]!)} className="text-center text-xs">

                                {!c.active ? (
                                  <span className="text-muted-foreground">–</span>
                                ) : (
                                  <div className="leading-tight">
                                    <span className={`tabular-nums ${perfClass(c.produced, c.estimated)}`}>
                                      {c.produced}
                                      <span className="text-muted-foreground">
                                        {" / "}
                                        {c.estimated != null ? Math.round(c.estimated) : "—"}
                                      </span>
                                    </span>
                                    <div className="text-[10px] tabular-nums text-muted-foreground">
                                      {c.opPct != null ? `${c.opPct.toFixed(1)}%` : "—"}
                                      {c.adjusted != null
                                        ? ` · aj. ${Math.round(c.adjusted)}`
                                        : ""}
                                    </div>
                                  </div>
                                )}
                              </TableCell>
                            ))}
                            <TableCell
                              className={`text-right tabular-nums ${perfClass(r.totalProduced, r.totalEstimated || null)}`}
                            >
                              {r.totalProduced}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {r.totalEstimated > 0 ? Math.round(r.totalEstimated) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-secondary/50">
                          <TableCell className="sticky left-0 bg-card font-medium">
                            % da hora
                          </TableCell>
                          {hourPcts.map((p, i) => {
                            const occ = hourOccs[i] ?? [];
                            return (
                              <TableCell
                                key={slotKey(slots[i]!)}
                                className={`text-center text-xs tabular-nums ${pctClass(p)}`}
                              >
                                {p != null ? `${p.toFixed(1)}%` : "–"}
                                {occ.length > 0 ? (
                                  <span className="block text-[10px] font-medium leading-tight text-destructive">
                                    {occ.join(" · ")}
                                  </span>
                                ) : null}
                              </TableCell>
                            );
                          })}
                          <TableCell
                            colSpan={2}
                            className={`text-right text-xs tabular-nums ${pctClass(dayPct)}`}
                          >
                            {dayPct != null
                              ? `Média do dia ${dayPct.toFixed(1)}% (apenas horários sem ocorrência)`
                              : "—"}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Avanço por produto / OP</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {visibleProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma OP interna na esteira de produção.
              </p>
            ) : (
              visibleProducts.map(({ lote, p, pct, done, perOperation, moving }) => {
                const isOpen = !!expanded[lote.id];
                return (

                  <div key={lote.id} className="rounded-md border border-border p-4">
                    <button
                      type="button"
                      className="w-full select-none text-left"
                      onClick={() => setExpanded((s) => ({ ...s, [lote.id]: !s[lote.id] }))}
                      aria-expanded={isOpen}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-medium">
                          {lote.opInterna ? (
                            <span className="font-bold">{lote.opInterna} — </span>
                          ) : null}
                          {p.name}
                          <span
                            className={cn(
                              "ml-2 rounded-full px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide",
                              moving
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {moving ? "Em movimento" : "Parado"}
                          </span>
                        </p>

                        <div className="flex items-center gap-2">
                          <p className="font-mono text-xs text-muted-foreground">
                            OP {p.op_number} · REF {p.reference}
                          </p>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                              isOpen && "rotate-180",
                            )}
                          />
                        </div>
                      </div>
                      <Progress value={Math.min(pct, 100)} className="my-3" />
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{pct.toFixed(0)}%</span>{" "}
                        concluído · meta de {lote.quantidade} peças por operação
                        {done ? " · finalizado" : ""}
                      </p>
                    </button>

                    {isOpen ? (
                      perOperation.length === 0 ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Nenhuma operação cadastrada para este produto.
                        </p>
                      ) : (
                        <div className="mt-3 space-y-3 animate-collapsible-down">
                          {sectors
                            .map((sec) => ({
                              sector: sec,
                              ops: perOperation.filter(
                                (op) => opSectorAll.get(op.operationId) === sec.id,
                              ),
                            }))
                            .filter((g) => g.ops.length > 0)
                            .map((g) => (
                              <div key={g.sector.id} className="space-y-1.5">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  {g.sector.name}
                                </p>
                                <ul className="space-y-1.5">
                                  {g.ops.map((op) => {
                                    const excess = op.target > 0 && op.produced > op.target;
                                    return (
                                      <li
                                        key={op.operationId}
                                        className={cn(
                                          "flex items-center gap-2 rounded px-1 py-0.5 text-xs",
                                          excess && "bg-destructive/10 text-destructive",
                                        )}
                                      >
                                        <span
                                          className={cn(
                                            "h-2 w-2 shrink-0 rounded-full",
                                            excess
                                              ? "bg-destructive"
                                              : op.done
                                                ? "bg-primary"
                                                : "bg-muted-foreground/40",
                                          )}
                                        />
                                        <span className="min-w-0 flex-1 truncate">{op.name}</span>
                                        <span
                                          className={cn(
                                            "tabular-nums",
                                            excess ? "font-semibold" : "text-muted-foreground",
                                          )}
                                        >
                                          {op.produced}/{op.target}
                                        </span>
                                        <span
                                          className={cn(
                                            "w-10 text-right tabular-nums",
                                            excess
                                              ? "font-semibold"
                                              : op.done
                                                ? "font-semibold text-foreground"
                                                : "text-muted-foreground",
                                          )}
                                        >
                                          {op.pct.toFixed(0)}%
                                        </span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            ))}
                        </div>
                      )
                    ) : null}
                  </div>
                );
              })
            )}
          </CardContent>

        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Produção por operação / hora</CardTitle>
            <p className="text-sm text-muted-foreground">
              Quantidade total produzida por operação em cada horário, somando todos os
              colaboradores e produtos.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card">Operação</TableHead>
                    {slots.map((s) => (
                      <TableHead
                        key={slotKey(s)}
                        className="whitespace-nowrap text-center font-mono text-xs"
                      >
                        <SlotHead s={s} />
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opHourRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={slots.length + 2}
                        className="py-10 text-center text-muted-foreground"
                      >
                        Nenhuma produção registrada nesta data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    opHourRows.map((r) => (
                      <TableRow key={r.key}>
                        <TableCell className="sticky left-0 bg-card font-medium">
                          {r.name}
                        </TableCell>
                        {r.perSlot.map((v, i) => (
                          <TableCell key={slotKey(slots[i]!)} className="text-center tabular-nums">
                            {v > 0 ? v : <span className="text-muted-foreground">–</span>}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-semibold tabular-nums">
                          {r.total}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

    </AppLayout>
  );
}
