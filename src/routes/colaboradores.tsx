import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import {
  catalogOperationsQuery,
  employeesQuery,
  entriesQuery,
  fmt,
  operationsQuery,
  scheduleQuery,
} from "@/lib/production";
import { Plus, Trash2, Search, ChevronRight } from "lucide-react";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/colaboradores")({
  head: () => ({
    meta: [
      { title: "Colaboradores | Controle de Confecção" },
      {
        name: "description",
        content: "Cadastre costureiras e auxiliares de produção e controle quem está ativo.",
      },
      { property: "og:title", content: "Colaboradores | Controle de Confecção" },
      {
        property: "og:description",
        content: "Cadastre costureiras e auxiliares e controle quem está ativo.",
      },
    ],
  }),
  component: ColaboradoresPage,
});

const MESES = [
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

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${MESES[Number(m) - 1] ?? m} / ${y}`;
}

function ColaboradoresPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: employees = [] } = useQuery(employeesQuery);
  const { data: entries = [] } = useQuery(entriesQuery());
  const { data: operations = [] } = useQuery(operationsQuery);
  const { data: catalogOps = [] } = useQuery(catalogOperationsQuery);
  const { data: config } = useQuery(scheduleQuery);

  const slotHours = (config?.slot_minutes ?? 60) / 60;

  const expectedPerHour = useMemo(() => {
    const byCatalog = new Map(catalogOps.map((c) => [c.id, c.expected_per_hour]));
    const map = new Map<string, number | null>();
    for (const o of operations) {
      map.set(o.id, o.catalog_operation_id ? (byCatalog.get(o.catalog_operation_id) ?? null) : null);
    }
    return map;
  }, [operations, catalogOps]);

  /** Média mensal = média das produtividades diárias válidas (mesma métrica do Dashboard). */
  const monthlyByEmployee = useMemo(() => {
    // employee -> month -> day -> slot -> { fração, ocorrência }
    const acc = new Map<string, Map<string, Map<string, Map<string, { f: number; occ: boolean }>>>>();
    for (const e of entries) {
      const month = (e.entry_date ?? "").slice(0, 7);
      if (!month) continue;
      const byMonth = acc.get(e.employee_id) ?? new Map();
      acc.set(e.employee_id, byMonth);
      const byDay = byMonth.get(month) ?? new Map();
      byMonth.set(month, byDay);
      const slotKey = `${fmt(e.slot_start)}-${e.is_overtime ? "x" : "n"}`;
      const bySlot = byDay.get(e.entry_date) ?? new Map();
      byDay.set(e.entry_date, bySlot);
      const cur = bySlot.get(slotKey) ?? { f: 0, occ: false };
      const eph = expectedPerHour.get(e.operation_id);
      const meta = eph != null ? eph * slotHours : null;
      if (meta != null && meta > 0) cur.f += e.quantity / meta;
      if (e.ocorrencia_id) cur.occ = true;
      bySlot.set(slotKey, cur);
    }

    const out = new Map<string, { month: string; pct: number }[]>();
    for (const [empId, byMonth] of acc) {
      const rows: { month: string; pct: number }[] = [];
      for (const [month, byDay] of byMonth) {
        const dayPcts: number[] = [];
        for (const [, bySlot] of byDay) {
          const slotPcts = Array.from(bySlot.values())
            .filter((s) => !s.occ && s.f > 0)
            .map((s) => s.f * 100);
          if (slotPcts.length === 0) continue;
          dayPcts.push(slotPcts.reduce((a, b) => a + b, 0) / slotPcts.length);
        }
        if (dayPcts.length === 0) continue;
        rows.push({
          month,
          pct: dayPcts.reduce((a, b) => a + b, 0) / dayPcts.length,
        });
      }
      rows.sort((a, b) => b.month.localeCompare(a.month));
      out.set(empId, rows);
    }
    return out;
  }, [entries, expectedPerHour, slotHours]);

  const filtered = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()),
  );

  async function add() {
    if (!name.trim()) {
      toast.error("Informe o nome do colaborador.");
      return;
    }
    const { error } = await db
      .from("employees")
      .insert({ name: name.trim(), role: role.trim() || null });
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setRole("");
    toast.success("Colaborador cadastrado.");
    qc.invalidateQueries({ queryKey: ["employees"] });
  }

  async function toggle(id: string, active: boolean) {
    const { error } = await db.from("employees").update({ active }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["employees"] });
  }

  async function remove(id: string) {
    const { error } = await db.from("employees").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["employees"] });
  }

  return (
    <AppLayout title="Colaboradores" subtitle="Equipe da produção.">
      <Card className="max-w-4xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cadastro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-52 flex-1 space-y-1.5">
              <Label>Nome completo</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder="Maria da Silva"
              />
            </div>
            <div className="w-56 space-y-1.5">
              <Label>Função (opcional)</Label>
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Costureira"
              />
            </div>
            <Button onClick={add}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar
            </Button>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Função</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhum colaborador encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e) => {
                  const open = openId === e.id;
                  const months = monthlyByEmployee.get(e.id) ?? [];
                  return (
                    <Fragment key={e.id}>
                      <TableRow>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {e.numero_id}
                        </TableCell>
                        <TableCell className="font-medium">
                          <button
                            type="button"
                            onClick={() => setOpenId(open ? null : e.id)}
                            className="flex items-center gap-2 text-left hover:underline"
                          >
                            <ChevronRight
                              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
                            />
                            {e.name}
                          </button>
                        </TableCell>
                        <TableCell>{e.role ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={e.active}
                              onCheckedChange={(v) => toggle(e.id, v)}
                            />
                            <Badge variant={e.active ? "default" : "outline"}>
                              {e.active ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ConfirmDelete
                            title="Excluir colaborador?"
                            description={`${e.name} será excluído permanentemente do cadastro.`}
                            onConfirm={() => void remove(e.id)}
                          >
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </ConfirmDelete>
                        </TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="p-0">
                          <div
                            className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                          >
                            <div className="overflow-hidden">
                              <div className="space-y-2 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Produtividade média mensal
                                </p>
                                {months.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">
                                    Sem marcações de produção registradas.
                                  </p>
                                ) : (
                                  <ul className="space-y-1">
                                    {months.map((m) => (
                                      <li
                                        key={m.month}
                                        className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm"
                                      >
                                        <span>{monthLabel(m.month)}</span>
                                        <span className="font-semibold tabular-nums">
                                          {m.pct.toFixed(1)}%
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
