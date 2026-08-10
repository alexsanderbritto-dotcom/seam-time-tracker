import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
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
  employeesQuery,
  entriesQuery,
  fmt,
  operationsQuery,
  productCompletion,
  productsQuery,
  scheduleQuery,
  todayISO,
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

  const { data: employees = [] } = useQuery(employeesQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const { data: operations = [] } = useQuery(operationsQuery);
  const { data: config } = useQuery(scheduleQuery);
  const { data: dayEntries = [] } = useQuery(entriesQuery(date));
  const { data: allEntries = [] } = useQuery(entriesQuery());

  const slots = useMemo(() => buildSlots(config), [config]);

  const filtered = useMemo(
    () =>
      dayEntries.filter(
        (e) =>
          (employeeFilter === "all" || e.employee_id === employeeFilter) &&
          (productFilter === "all" || e.product_id === productFilter),
      ),
    [dayEntries, employeeFilter, productFilter],
  );

  const activeEmployees = useMemo(() => {
    const ids = new Set(filtered.map((e) => e.employee_id));
    return employees.filter((e) => ids.has(e.id));
  }, [filtered, employees]);

  const total = filtered.reduce((s, e) => s + e.quantity, 0);

  const cell = (empId: string, slotStart: string) =>
    filtered.filter((e) => e.employee_id === empId && fmt(e.slot_start) === fmt(slotStart));

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
                      <TableHead key={s.start} className="whitespace-nowrap text-center font-mono text-xs">
                        {s.start}–{s.end}
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
                            const items = cell(emp.id, s.start);
                            return (
                              <TableCell key={s.start} className="align-top text-center">
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
            <CardTitle className="text-base">Avanço por produto / OP</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
            ) : (
              products.map((p) => {
                const { pct, done, perOperation } = productCompletion(p, operations, allEntries);
                return (
                  <div key={p.id} className="rounded-md border border-border p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-medium">{p.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        OP {p.op_number} · REF {p.reference}
                      </p>
                    </div>
                    <Progress value={Math.min(pct, 100)} className="my-3" />
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{pct.toFixed(0)}%</span>{" "}
                      concluído · meta de {p.total_quantity} peças por operação
                      {done ? " · finalizado" : ""}
                    </p>

                    {perOperation.length === 0 ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Nenhuma operação cadastrada para este produto.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-1.5">
                        {perOperation.map((op) => (
                          <li key={op.operationId} className="flex items-center gap-2 text-xs">
                            <span
                              className={
                                op.done
                                  ? "h-2 w-2 shrink-0 rounded-full bg-primary"
                                  : "h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40"
                              }
                            />
                            <span className="min-w-0 flex-1 truncate">{op.name}</span>
                            <span className="tabular-nums text-muted-foreground">
                              {op.produced}/{op.target}
                            </span>
                            <span
                              className={
                                op.done
                                  ? "w-10 text-right font-semibold tabular-nums text-foreground"
                                  : "w-10 text-right tabular-nums text-muted-foreground"
                              }
                            >
                              {op.pct.toFixed(0)}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
