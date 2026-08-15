import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildSlots,
  catalogOperationsQuery,
  employeesQuery,
  entriesQuery,
  esteiraQuery,
  fmt,
  operationsQuery,
  overtimeSlotsQuery,
  productCompletion,
  productsQuery,
  scheduleQuery,
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});


  const { data: employees = [] } = useQuery(employeesQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const { data: operations = [] } = useQuery(operationsQuery);
  const { data: config } = useQuery(scheduleQuery);
  const { data: dayEntries = [] } = useQuery(entriesQuery(date));
  const { data: allEntries = [] } = useQuery(entriesQuery());
  const { data: sectors = [] } = useQuery(sectorsQuery);
  const { data: catalogOps = [] } = useQuery(catalogOperationsQuery);
  const { data: esteira = [] } = useQuery(esteiraQuery);

  const esteiraProducts = useMemo(() => {
    const ids = new Set(esteira.map((e) => e.produto_id));
    return products.filter((p) => ids.has(p.id));
  }, [esteira, products]);

  const { data: overtimeSlots = [] } = useQuery(overtimeSlotsQuery);

  const normalSlots = useMemo(() => buildSlots(config), [config]);

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

  const matchesOp = (operationId: string) =>
    operationFilter === "all" || opCatalog.get(operationId) === operationFilter;

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
          (operationFilter === "all" || opCatalog.get(e.operation_id) === operationFilter),
      ),
    [dayEntries, employeeFilter, productFilter, operationFilter, opCatalog],
  );


  const activeEmployees = useMemo(() => {
    const ids = new Set(filtered.map((e) => e.employee_id));
    return employees.filter((e) => ids.has(e.id));
  }, [filtered, employees]);

  const total = filtered.reduce((s, e) => s + e.quantity, 0);

  const expectedPerHour = useMemo(() => {
    const byCatalog = new Map(catalogOps.map((c) => [c.id, c.expected_per_hour]));
    const map = new Map<string, number | null>();
    for (const o of operations) {
      map.set(o.id, o.catalog_operation_id ? (byCatalog.get(o.catalog_operation_id) ?? null) : null);
    }
    return map;
  }, [operations, catalogOps]);

  const slotHours = (config?.slot_minutes ?? 60) / 60;

  const productivity = useMemo(() => {
    const emps = employees.filter(
      (e) => employeeFilter === "all" || e.id === employeeFilter,
    );
    return emps
      .map((emp) => {
        const empEntries = filtered.filter((e) => e.employee_id === emp.id);
        const opIds = Array.from(new Set(empEntries.map((e) => e.operation_id)));

        // Para cada janela: soma direta das frações (produzido / meta original).
        // A "meta ajustada" é apenas explicativa e segue a ordem cronológica de lançamento.
        const slotInfo = slots.map((s) => {
          const worked = [...empEntries.filter((e) => inSlot(e, s))].sort((a, b) =>
            (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id),
          );
          const byOp = new Map<
            string,
            { produced: number; meta: number | null; adjusted: number | null; opPct: number | null }
          >();
          let usedFraction = 0;
          for (const e of worked) {
            const eph = expectedPerHour.get(e.operation_id);
            const meta = eph != null ? eph * slotHours : null;
            const prev = byOp.get(e.operation_id);
            const remaining = Math.max(0, 1 - usedFraction);
            const adjusted = meta != null ? meta * remaining : null;
            const fraction = meta != null && meta > 0 ? e.quantity / meta : 0;
            usedFraction += fraction;
            if (prev) {
              prev.produced += e.quantity;
              prev.opPct = prev.meta != null && prev.meta > 0 ? (prev.produced / prev.meta) * 100 : null;
            } else {
              byOp.set(e.operation_id, {
                produced: e.quantity,
                meta,
                adjusted,
                opPct: meta != null && meta > 0 ? (e.quantity / meta) * 100 : null,
              });
            }
          }
          return { byOp, hourPct: worked.length > 0 ? usedFraction * 100 : null };
        });

        const rows = opIds.map((opId) => {
          const perSlot = slotInfo.map((info) => {
            const d = info.byOp.get(opId);
            return {
              produced: d?.produced ?? 0,
              estimated: d?.meta ?? null,
              adjusted: d?.adjusted ?? null,
              opPct: d?.opPct ?? null,
              active: !!d,
            };
          });
          const totalProduced = perSlot.reduce((a, c) => a + c.produced, 0);
          const totalEstimated = perSlot.reduce((a, c) => a + (c.estimated ?? 0), 0);
          return {
            opId,
            name: operations.find((o) => o.id === opId)?.name ?? "Operação",
            perSlot,
            totalProduced,
            totalEstimated,
          };
        });
        const hourPcts = slotInfo.map((i) => i.hourPct);
        const dayPct = (() => {
          const vals = hourPcts.filter((v): v is number => v != null);
          return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        })();
        return { emp, rows, hourPcts, dayPct };
      })
      .filter((g) => g.rows.length > 0);
  }, [employees, employeeFilter, filtered, slots, operations, expectedPerHour, slotHours]);

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


  const cell = (empId: string, s: Slot) =>
    filtered.filter((e) => e.employee_id === empId && inSlot(e, s));

  return (
    <AppLayout title="Dashboard" subtitle="Acompanhamento da produção.">
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
            <div className="space-y-1.5">
              <Label>Colaborador</Label>
              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Produto / OP</Label>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · OP {p.op_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Operação</Label>
              <Select value={operationFilter} onValueChange={setOperationFilter}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {sectors.map((sec) => {
                    const ops = catalogOps.filter((c) => c.sector_id === sec.id);
                    if (ops.length === 0) return null;
                    return (
                      <SelectGroup key={sec.id}>
                        <SelectLabel>{sec.name}</SelectLabel>
                        {ops.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto rounded-md bg-secondary px-4 py-2 text-right">
              <p className="text-xs text-muted-foreground">Total no dia</p>
              <p className="text-2xl font-semibold tabular-nums">{total}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Grade por colaborador e horário</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card">Colaborador</TableHead>
                    {slots.map((s) => (
                      <TableHead key={slotKey(s)} className="whitespace-nowrap text-center font-mono text-xs">
                        <SlotHead s={s} />
                      </TableHead>
                    ))}

                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={slots.length + 2}
                        className="py-10 text-center text-muted-foreground"
                      >
                        Nenhuma produção registrada com estes filtros.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeEmployees.map((emp) => {
                      const empTotal = filtered
                        .filter((e) => e.employee_id === emp.id)
                        .reduce((s, e) => s + e.quantity, 0);
                      return (
                        <TableRow key={emp.id}>
                          <TableCell className="sticky left-0 bg-card font-medium">
                            {emp.name}
                          </TableCell>
                          {slots.map((s) => {
                            const items = cell(emp.id, s);
                            return (
                              <TableCell key={slotKey(s)} className="align-top text-center">

                                {items.length === 0 ? (
                                  <span className="text-muted-foreground">–</span>
                                ) : (
                                  <div className="space-y-1">
                                    {items.map((it) => (
                                      <div key={it.id} className="text-xs leading-tight">
                                        <span className="font-semibold tabular-nums">
                                          {it.quantity}
                                        </span>{" "}
                                        <span className="text-muted-foreground">
                                          {operations.find((o) => o.id === it.operation_id)?.name}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right font-semibold tabular-nums">
                            {empTotal}
                          </TableCell>
                        </TableRow>
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
            <CardTitle className="text-base">Produção por hora e por setor</CardTitle>
            <p className="text-sm text-muted-foreground">
              Total de peças concluídas por setor, com base nas operações marcadas como última
              etapa.
            </p>
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
                      return (
                        <TableRow key={sec.id}>
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
            <CardTitle className="text-base">Avanço por produto / OP</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {esteiraProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum produto na esteira de produção.
              </p>
            ) : (
              esteiraProducts.map((p) => {
                const { pct, done, perOperation } = productCompletion(
                  p,
                  visibleOperations,
                  allEntries,
                );
                const isOpen = !!expanded[p.id];
                return (
                  <div key={p.id} className="rounded-md border border-border p-4">
                    <button
                      type="button"
                      className="w-full select-none text-left"
                      onClick={() => setExpanded((s) => ({ ...s, [p.id]: !s[p.id] }))}
                      aria-expanded={isOpen}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-medium">
                          {p.op_interna ? (
                            <span className="font-bold">{p.op_interna} — </span>
                          ) : null}
                          {p.name}
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
                        concluído · meta de {p.total_quantity} peças por operação
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
            <CardTitle className="text-base">Produtividade por colaborador e operação</CardTitle>
            <p className="text-sm text-muted-foreground">
              Estimado (quantidade por hora esperada × horas trabalhadas) comparado ao produzido em
              cada janela de horário. Verde: na meta ou acima · amarelo: perto da meta · vermelho:
              abaixo.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {productivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma produção registrada com estes filtros.
              </p>
            ) : (
              productivity.map(({ emp, rows }) => (
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
                                  <span className={`tabular-nums ${perfClass(c.produced, c.estimated)}`}>
                                    {c.produced}
                                    <span className="text-muted-foreground">
                                      {" / "}
                                      {c.estimated != null ? Math.round(c.estimated) : "—"}
                                    </span>
                                  </span>
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
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
