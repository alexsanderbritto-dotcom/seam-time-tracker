import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  employeesQuery,
  entriesQuery,
  buildLotes,
  esteiraQuery,
  fmt,
  ocorrenciasQuery,
  operationsQuery,
  overtimeSlotsQuery,
  productsQuery,
  todayISO,
  type Employee,
  type Ocorrencia,
  type Operation,
} from "@/lib/production";
import { useDaySlots } from "@/lib/schedule";
import { SearchableSelect } from "@/components/SearchableSelect";
import { cn } from "@/lib/utils";
import { Trash2, Check, LogOut, Search, ChevronDown, Plus } from "lucide-react";
import { ConfirmDelete } from "@/components/ConfirmDelete";

/** Native select: mobile browsers render their own picker, avoiding the
 * portal/scroll-lock crashes seen with the custom dropdown on some devices. */
const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:h-10 md:text-sm";

export function MarcacaoProducao({
  marcadorNome,
  onLogout,
}: {
  marcadorNome: string;
  onLogout: () => void;
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [employeeId, setEmployeeId] = useState("");
  const [loteId, setLoteId] = useState("");
  const [slotIdx, setSlotIdx] = useState("");
  const [overtimeId, setOvertimeId] = useState("");
  const [ocorrenciaId, setOcorrenciaId] = useState("");
  const [novaOcorrencia, setNovaOcorrencia] = useState("");
  const [criandoOcorrencia, setCriandoOcorrencia] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [opSearch, setOpSearch] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const opInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const { data: employees = [] } = useQuery(employeesQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const { data: operations = [] } = useQuery(operationsQuery);
  const { data: entries = [] } = useQuery(entriesQuery(date));
  const { data: esteira = [] } = useQuery(esteiraQuery);
  const { data: overtimeSlots = [] } = useQuery(overtimeSlotsQuery);
  const { data: ocorrencias = [] } = useQuery(ocorrenciasQuery);

  const {
    slots,
    folga,
    feriado,
    feriadoNome,
    forcedOvertime,
    isLoading: loadingConfig,
    isError: configError,
  } = useDaySlots(date);
  const lotes = useMemo(() => buildLotes(esteira, products), [esteira, products]);
  const activeLote = useMemo(() => lotes.find((l) => l.id === loteId), [lotes, loteId]);
  const productId = activeLote?.product.id ?? "";

  const productOps = useMemo(
    () => operations.filter((o) => o.product_id === productId),
    [operations, productId],
  );

  const employeeOptions = useMemo(
    () =>
      employees
        .filter((e: Employee) => e.active)
        .map((e: Employee) => ({ value: e.id, label: e.name })),
    [employees],
  );

  const productOptions = useMemo(
    () =>
      lotes.map((l) => {
        const op = (l.opInterna ?? "").trim();
        return {
          value: l.id,
          label: l.product.name,
          searchText: `${op} ${l.product.name} ${l.product.op_number}`,
          node: (
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="text-base font-bold tabular-nums md:text-sm">
                {op ? `OP ${op}` : "OP —"}
              </span>
              <span className="truncate text-sm text-muted-foreground md:text-xs">
                {l.product.name} · {l.quantidade} pç
              </span>
            </span>
          ),
          triggerNode: (
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="font-bold tabular-nums">{op ? `OP ${op}` : "OP —"}</span>
              <span className="truncate text-sm text-muted-foreground">{l.product.name}</span>
            </span>
          ),
        };
      }),
    [lotes],
  );

  const filteredOps = useMemo(() => {
    const term = opSearch.trim().toLowerCase();
    const chosen = productOps.filter((op: Operation) => Number(selected[op.id]) > 0);
    if (!term) return chosen;
    const matches = productOps.filter(
      (op: Operation) =>
        op.name.toLowerCase().includes(term) && !chosen.some((c) => c.id === op.id),
    );
    return [...chosen, ...matches];
  }, [productOps, opSearch, selected]);

  const producedByOperation = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) {
      if (loteId && e.lote_id !== loteId) continue;
      map[e.operation_id] = (map[e.operation_id] ?? 0) + e.quantity;
    }
    return map;
  }, [entries, loteId]);


  function focusOp(opId: string, direction: "next" | "prev") {
    const ids = filteredOps.map((o: Operation) => o.id);
    const idx = ids.indexOf(opId);
    if (idx === -1) return;
    const nextIdx =
      direction === "next"
        ? Math.min(idx + 1, ids.length - 1)
        : Math.max(idx - 1, 0);
    const nextId = ids[nextIdx];
    if (!nextId) return;
    opInputRefs.current.get(nextId)?.focus();
  }

  async function criarOcorrencia() {
    const nome = novaOcorrencia.trim();
    if (!nome) return;
    const existente = ocorrencias.find(
      (o: Ocorrencia) => o.nome.toLowerCase() === nome.toLowerCase(),
    );
    if (existente) {
      setOcorrenciaId(existente.id);
      setNovaOcorrencia("");
      setCriandoOcorrencia(false);
      return;
    }
    const { data, error } = await db
      .from("ocorrencias")
      .insert({ nome })
      .select()
      .single();
    if (error) {
      toast.error("Erro ao criar ocorrência: " + error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["ocorrencias"] });
    if (data) setOcorrenciaId((data as Ocorrencia).id);
    setNovaOcorrencia("");
    setCriandoOcorrencia(false);
    toast.success("Ocorrência criada.");
  }

  async function save() {
    const ot = overtimeSlots.find((o) => o.id === overtimeId);
    const normal = slots[Number(slotIdx)];
    const slot = ot
      ? { start: fmt(ot.start_time), end: fmt(ot.end_time), overtime: true }
      : normal
        ? { ...normal, overtime: Boolean(normal.overtime) }
        : null;
    if (!employeeId || !loteId || !productId || !slot) {
      toast.error("Preencha colaborador, OP interna e horário (normal ou hora extra).");
      return;
    }
    const rows = Object.entries(selected)
      .filter(([, v]) => Number(v) > 0)
      .map(([operation_id, v]) => ({
        employee_id: employeeId,
        product_id: productId,
        lote_id: loteId,
        operation_id,
        slot_start: slot.start,
        slot_end: slot.end,
        is_overtime: slot.overtime,
        ocorrencia_id: ocorrenciaId || null,
        quantity: Number(v),
        entry_date: date,
      }));


    if (rows.length === 0) {
      toast.error("Informe a quantidade de ao menos uma operação.");
      return;
    }

    setSaving(true);

    // Uma marcação é única por colaborador + OP interna + operação + dia + horário.
    // Sem isso, salvar de novo (duplo clique, recarregar, corrigir a quantidade)
    // criava uma segunda linha e a operação passava a somar quantidade em dobro.
    const { data: existentesRaw } = await db
      .from("production_entries")
      .select("id, operation_id")
      .eq("employee_id", employeeId)
      .eq("lote_id", loteId)
      .eq("entry_date", date)
      .eq("slot_start", slot.start)
      .in(
        "operation_id",
        rows.map((r) => r.operation_id),
      );
    const existentes = (existentesRaw ?? []) as { id: string; operation_id: string }[];
    const byOp = new Map(existentes.map((e) => [e.operation_id, e.id]));

    const novos = rows.filter((r) => !byOp.has(r.operation_id));
    const atualizados = rows.filter((r) => byOp.has(r.operation_id));

    let error: { message: string } | null = null;
    if (novos.length > 0) {
      ({ error } = await db.from("production_entries").insert(novos));
    }
    for (const r of atualizados) {
      if (error) break;
      const res = await db
        .from("production_entries")
        .update({
          quantity: r.quantity,
          slot_end: r.slot_end,
          is_overtime: r.is_overtime,
          ocorrencia_id: r.ocorrencia_id,
        })
        .eq("id", byOp.get(r.operation_id) as string);
      error = res.error;
    }
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    if (atualizados.length > 0) {
      toast.warning(
        `${atualizados.length} operação(ões) já tinham marcação neste horário e foram atualizadas (sem duplicar).`,
      );
    }
    if (novos.length > 0) toast.success(`${novos.length} marcação(ões) registrada(s).`);
    setSelected({});
    setOpSearch("");
    setOcorrenciaId("");
    qc.invalidateQueries({ queryKey: ["production_entries"] });

  }

  async function remove(id: string) {
    const { error } = await db.from("production_entries").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Marcação excluída.");
    qc.invalidateQueries({ queryKey: ["production_entries"] });
  }

  async function updateQty(id: string, quantity: number) {
    const { error } = await db.from("production_entries").update({ quantity }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["production_entries"] });
  }

  type EntryRow = (typeof entries)[number];

  const histAccessors = useMemo(
    () => ({
      horario: (e: EntryRow) =>
        `${fmt(e.slot_start)}–${fmt(e.slot_end)}${e.is_overtime ? " (extra)" : ""}`,
      colaborador: (e: EntryRow) => employees.find((x) => x.id === e.employee_id)?.name ?? "",
      produto: (e: EntryRow) => {
        const p = products.find((x) => x.id === e.product_id);
        return p ? `${p.name} · OP ${p.op_number}` : "";
      },
      operacao: (e: EntryRow) => operations.find((x) => x.id === e.operation_id)?.name ?? "",
      qtd: (e: EntryRow) => String(e.quantity),
    }),
    [employees, products, operations],
  );

  const histOptions = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const [col, get] of Object.entries(histAccessors)) {
      const set = new Set<string>();
      for (const e of entries) set.add(valueOf(get(e as EntryRow)));
      out[col] = [...set].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
    }
    return out;
  }, [entries, histAccessors]);

  const dayEntries = useMemo(
    () => applyColumnFilters(entries as EntryRow[], histFilters, histAccessors),
    [entries, histFilters, histAccessors],
  );

  const histFilterCount = Object.values(histFilters).filter((v) => v.length > 0).length;

  function keepVisible(e: React.FocusEvent<HTMLElement>) {
    const el = e.currentTarget;
    window.setTimeout(() => {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 250);
  }

  return (
    <AppLayout
      requireAdmin={false}
      title="Marcação de Produção"
      subtitle="Registre o que cada colaborador produziu em cada janela de horário."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-4 py-2.5">
        <p className="text-sm text-muted-foreground">
          Marcador: <span className="font-medium text-foreground">{marcadorNome}</span>
        </p>
        <Button variant="outline" size="sm" onClick={onLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair / trocar marcador
        </Button>
      </div>

      <div className="grid gap-4 md:gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Nova marcação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pb-0 md:pb-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input
                  type="date"
                  className="h-11 text-base md:h-10 md:text-sm"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  onFocus={keepVisible}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slot-select">Horário</Label>
                <select
                  id="slot-select"
                  className={selectClass}
                  value={slotIdx}
                  disabled={slots.length === 0}
                  onChange={(e) => {
                    setSlotIdx(e.target.value);
                    setOvertimeId("");
                  }}
                >
                  <option value="">
                    {loadingConfig
                      ? "Carregando horários..."
                      : slots.length === 0
                        ? "Nenhum horário disponível"
                        : "Selecione"}
                  </option>
                  {slots.map((s, i) => (
                    <option key={s.start} value={String(i)}>
                      {fmt(s.start)} às {fmt(s.end)}
                    </option>
                  ))}
                </select>
                {forcedOvertime ? (
                  <p className="text-xs text-amber-500">
                    {folga
                      ? "Dia de folga: as marcações serão registradas como hora extra."
                      : `Feriado${feriadoNome ? ` (${feriadoNome})` : ""}: as marcações serão registradas como hora extra.`}
                  </p>
                ) : null}
                {!loadingConfig && (configError || slots.length === 0) ? (
                  <p className="text-xs text-destructive">
                    Não foi possível carregar os horários. Atualize a página ou faça login
                    novamente.
                  </p>
                ) : null}
              </div>

            </div>

            <div className="space-y-1.5">
              <Label htmlFor="overtime-select">Hora extra</Label>
              <select
                id="overtime-select"
                className={selectClass}
                value={overtimeId}
                disabled={overtimeSlots.length === 0}
                onChange={(e) => {
                  setOvertimeId(e.target.value);
                  if (e.target.value) setSlotIdx("");
                }}
              >
                <option value="">
                  {overtimeSlots.length === 0
                    ? "Nenhum horário extra configurado"
                    : "Selecione uma janela de hora extra"}
                </option>
                {overtimeSlots.map((o) => (
                  <option key={o.id} value={o.id}>
                    {fmt(o.start_time)} às {fmt(o.end_time)} (extra)
                  </option>
                ))}
              </select>
              {overtimeId ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => setOvertimeId("")}
                >
                  Limpar hora extra
                </button>
              ) : null}
            </div>


            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="ocorrencia-select">Ocorrência (opcional)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setCriandoOcorrencia((v) => !v)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Criar ocorrência
                </Button>
              </div>
              <SearchableSelect
                options={[
                  { value: "", label: "Sem ocorrência", alwaysShow: true },
                  ...ocorrencias.map((o: Ocorrencia) => ({ value: o.id, label: o.nome })),
                ]}
                value={ocorrenciaId}
                onChange={setOcorrenciaId}
                placeholder="Sem ocorrência"
                searchPlaceholder="Buscar ocorrência..."
                emptyMessage="Nenhuma ocorrência cadastrada."
              />
              {criandoOcorrencia ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    className="h-11 text-base md:h-10 md:text-sm"
                    placeholder="Ex.: Máquina parada"
                    value={novaOcorrencia}
                    onChange={(e) => setNovaOcorrencia(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void criarOcorrencia();
                      }
                    }}
                  />
                  <Button type="button" onClick={() => void criarOcorrencia()}>
                    Salvar
                  </Button>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Horários com ocorrência não geram percentual de produtividade do colaborador.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Colaborador</Label>
              <SearchableSelect
                options={employeeOptions}
                value={employeeId}
                onChange={setEmployeeId}
                placeholder="Selecione o colaborador"
                searchPlaceholder="Digite para buscar colaborador..."
                emptyMessage="Nenhum colaborador encontrado."
              />
            </div>

            <div className="space-y-1.5">
              <Label>OP Interna (Esteira de Produção)</Label>
              <SearchableSelect
                options={productOptions}
                value={loteId}
                onChange={(v) => {
                  setLoteId(v);
                  setSelected({});
                  setOpSearch("");
                }}
                placeholder="Buscar por nome ou OP Interna..."
                searchPlaceholder="Buscar por nome ou OP Interna..."
                emptyMessage="Nenhuma OP interna na esteira de produção."
              />
            </div>

            <div className="space-y-2">
              <Label>Operações executadas</Label>
              {!productId ? (
                <p className="text-sm text-muted-foreground">Selecione uma OP interna primeiro.</p>
              ) : productOps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este produto ainda não tem operações cadastradas.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar operação..."
                      value={opSearch}
                      onChange={(e) => setOpSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          const first = filteredOps[0];
                          if (first) opInputRefs.current.get(first.id)?.focus();
                        }
                      }}
                      onFocus={keepVisible}
                      inputMode="search"
                      className="h-11 pl-9 text-base md:h-10 md:text-sm"
                    />
                  </div>
                  {filteredOps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {opSearch.trim()
                        ? "Nenhuma operação corresponde à busca."
                        : "Digite para buscar uma operação deste produto."}
                    </p>
                  ) : (
                    <div className="divide-y divide-border rounded-md border border-border">
                      {filteredOps.map((op: Operation) => {
                        const done = producedByOperation[op.id] ?? 0;
                        const over = activeLote ? done > activeLote.quantidade : false;
                        return (
                          <div
                            key={op.id}
                            className={cn(
                              "flex items-center gap-3 px-3 py-3 md:py-2",
                              selected[op.id] && Number(selected[op.id]) > 0 && "bg-muted/40",
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{op.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Hoje: {done}
                                {over ? " · acima da OP" : ""}
                              </p>
                            </div>
                            <Input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              onFocus={keepVisible}
                              className="h-11 w-24 text-base md:h-9 md:text-sm"
                              placeholder="Qtd"
                              value={selected[op.id] ?? ""}
                              onChange={(e) =>
                                setSelected((s) => ({ ...s, [op.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  focusOp(op.id, "next");
                                } else if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  focusOp(op.id, "prev");
                                }
                              }}
                              ref={(el) => {
                                if (el) opInputRefs.current.set(op.id, el);
                                else opInputRefs.current.delete(op.id);
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 -mx-6 border-t border-border bg-card px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:static md:m-0 md:border-0 md:bg-transparent md:p-0">
              <Button className="h-12 w-full text-base md:h-10 md:text-sm" onClick={save} disabled={saving}>
                <Check className="mr-2 h-4 w-4" />
                {saving ? "Salvando..." : "Salvar marcação"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer pb-3 select-none">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    Marcações de {date.split("-").reverse().join("/")}
                    <Badge variant="secondary">{dayEntries.length}</Badge>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300",
                      historyOpen && "rotate-180",
                    )}
                  />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Horário</TableHead>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Produto / OP</TableHead>
                        <TableHead>Operação</TableHead>
                        <TableHead className="w-28">Qtd</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dayEntries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                            Nenhuma marcação nesta data.
                          </TableCell>
                        </TableRow>
                      ) : (
                        dayEntries.map((e) => {
                          const p = products.find((x) => x.id === e.product_id);
                          const op = operations.find((x) => x.id === e.operation_id);
                          const emp = employees.find((x) => x.id === e.employee_id);
                          return (
                            <TableRow key={e.id}>
                              <TableCell className="whitespace-nowrap font-mono text-xs">
                                {fmt(e.slot_start)}–{fmt(e.slot_end)}
                                {e.is_overtime ? (
                                  <span className="ml-1 text-[9px] text-muted-foreground">
                                    (extra)
                                  </span>
                                ) : null}
                              </TableCell>

                              <TableCell>{emp?.name ?? "—"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {p ? `${p.name} · OP ${p.op_number}` : "—"}
                              </TableCell>
                              <TableCell>
                                {op?.name ?? "—"}
                                {e.ocorrencia_id ? (
                                  <span className="block text-xs text-destructive">
                                    {ocorrencias.find((o: Ocorrencia) => o.id === e.ocorrencia_id)
                                      ?.nome ?? "Ocorrência"}
                                  </span>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  className="h-8 w-20"
                                  defaultValue={e.quantity}
                                  onBlur={(ev) => {
                                    const v = Number(ev.target.value);
                                    if (v !== e.quantity) updateQty(e.id, v);
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <ConfirmDelete
                                  title="Excluir marcação?"
                                  description="Esta marcação de produção será removida permanentemente."
                                  onConfirm={() => void remove(e.id)}
                                >
                                  <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </ConfirmDelete>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </AppLayout>
  );
}
