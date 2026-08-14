import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, FlaskConical, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SearchableSelect } from "@/components/SearchableSelect";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { useMarcadorSession } from "@/lib/marcador-session";
import {
  brl,
  catalogOperationsQuery,
  entriesQuery,
  operationsQuery,
  productsQuery,
  sectorsQuery,
  type Product,
} from "@/lib/production";
import {
  buildMonthRows,
  faturamentoMesProdutosQuery,
  faturamentoMesesQuery,
  fmtDayLabel,
  lastOpsOfSector,
  MES_NOMES,
  mesLabel,
  metaSetorMesQuery,
  workingDays,
  type MetaSetorMes,
  type SimEntry,
} from "@/lib/faturamento";

export function MetaSetorModule() {
  const { isAdmin } = useMarcadorSession();
  const qc = useQueryClient();
  const { data: sectors = [] } = useQuery(sectorsQuery);
  const { data: metas = [] } = useQuery(metaSetorMesQuery);
  const [sectorId, setSectorId] = useState("");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const now = new Date();
  const [novo, setNovo] = useState({ mes: now.getMonth() + 1, ano: now.getFullYear() });

  const currentSector = sectors.find((s) => s.id === sectorId) ?? sectors[0];
  const activeSectorId = currentSector?.id ?? "";

  const sectorMetas = useMemo(
    () =>
      metas
        .filter((m) => m.sector_id === activeSectorId)
        .sort((a, b) => b.ano - a.ano || b.mes - a.mes),
    [metas, activeSectorId],
  );

  const createMes = async () => {
    if (!activeSectorId) return;
    const { error } = await db.from("meta_setor_mes").insert({
      sector_id: activeSectorId,
      mes: novo.mes,
      ano: novo.ano,
      meta_dia: 0,
      feriados: [],
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mês adicionado à meta do setor");
    setAdding(false);
    void qc.invalidateQueries({ queryKey: metaSetorMesQuery.queryKey });
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 p-5 text-left"
          >
            <div>
              <p className="text-base font-semibold">Meta de Valor de Produção por Setor</p>
              <p className="text-xs text-muted-foreground">
                Meta diária, dias úteis, feriados e simulação
              </p>
            </div>
            <ChevronDown
              className={cn("h-5 w-5 shrink-0 transition-transform", open && "rotate-180")}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-5 border-t p-5">
            <div className="space-y-1.5 md:max-w-sm">
              <Label>Setor</Label>
              <SearchableSelect
                options={sectors.map((s) => ({ value: s.id, label: s.name }))}
                value={activeSectorId}
                onChange={setSectorId}
                placeholder="Selecione o setor"
              />
            </div>

            {isAdmin ? (
              adding ? (
                <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
                  <div className="space-y-1.5">
                    <Label>Mês</Label>
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={novo.mes}
                      onChange={(e) => setNovo({ ...novo, mes: Number(e.target.value) })}
                    >
                      {MES_NOMES.map((n, i) => (
                        <option key={n} value={i + 1}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ano</Label>
                    <Input
                      type="number"
                      className="w-28"
                      value={novo.ano}
                      onChange={(e) => setNovo({ ...novo, ano: Number(e.target.value) })}
                    />
                  </div>
                  <Button onClick={createMes} disabled={!activeSectorId}>
                    Criar mês
                  </Button>
                  <Button variant="ghost" onClick={() => setAdding(false)}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Adicionar mês
                </Button>
              )
            ) : null}

            {sectorMetas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum mês configurado para este setor.
              </p>
            ) : (
              <div className="space-y-3">
                {sectorMetas.map((m) => (
                  <MetaMesBlock key={m.id} meta={m} sectorName={currentSector?.name ?? ""} />
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function MetaMesBlock({ meta, sectorName }: { meta: MetaSetorMes; sectorName: string }) {
  const { isAdmin } = useMarcadorSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [metaDia, setMetaDia] = useState(String(meta.meta_dia ?? 0));
  const [feriado, setFeriado] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: products = [] } = useQuery(productsQuery);
  const { data: operations = [] } = useQuery(operationsQuery);
  const { data: catalogOps = [] } = useQuery(catalogOperationsQuery);
  const { data: entries = [] } = useQuery(entriesQuery());
  const { data: meses = [] } = useQuery(faturamentoMesesQuery);
  const { data: mesProdutos = [] } = useQuery(faturamentoMesProdutosQuery);

  const days = useMemo(
    () => workingDays(meta.mes, meta.ano, meta.feriados),
    [meta.mes, meta.ano, meta.feriados],
  );

  const opToProduct = useMemo(
    () => lastOpsOfSector(meta.sector_id, operations, catalogOps),
    [meta.sector_id, operations, catalogOps],
  );

  const faturamentoMes = meses.find((x) => x.mes === meta.mes && x.ano === meta.ano);
  const allowedProductIds = useMemo(() => {
    const ids = mesProdutos.filter((x) => x.mes_id === faturamentoMes?.id).map((x) => x.product_id);
    return new Set(ids);
  }, [mesProdutos, faturamentoMes]);

  const real = useMemo(
    () =>
      buildMonthRows({
        days,
        metaDia: Number(meta.meta_dia ?? 0),
        entries,
        opToProduct,
        products,
        allowedProductIds,
      }),
    [days, meta.meta_dia, entries, opToProduct, products, allowedProductIds],
  );

  const save = async () => {
    setSaving(true);
    const { error } = await db
      .from("meta_setor_mes")
      .update({ meta_dia: Number(metaDia) || 0 })
      .eq("id", meta.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Meta atualizada");
    void qc.invalidateQueries({ queryKey: metaSetorMesQuery.queryKey });
  };

  const setFeriados = async (list: string[]) => {
    const { error } = await db.from("meta_setor_mes").update({ feriados: list }).eq("id", meta.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: metaSetorMesQuery.queryKey });
  };

  const addFeriado = () => {
    if (!feriado) return;
    if (!feriado.startsWith(`${meta.ano}-${String(meta.mes).padStart(2, "0")}`)) {
      toast.error("O feriado precisa estar dentro do mês selecionado.");
      return;
    }
    void setFeriados([...new Set([...meta.feriados, feriado])].sort());
    setFeriado("");
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="font-medium">
              {mesLabel(meta.mes, meta.ano)}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {sectorName} · {days.length} dias úteis
              </span>
            </span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-5 border-t p-4">
            {!faturamentoMes ? (
              <p className="flex items-center gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                <TriangleAlert className="h-4 w-4" />
                Crie este mês em Faturamento e vincule os produtos para computar a meta.
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <p className="text-2xl font-semibold">{brl(real.metaTotal)}</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Meta total do mês
                  </p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-emerald-500">
                <CardContent className="p-4">
                  <p className="text-2xl font-semibold">{brl(real.atingidoTotal)}</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Atingido até o momento
                  </p>
                </CardContent>
              </Card>
            </div>

            {isAdmin ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label>Meta por dia útil (R$)</Label>
                  <Input
                    type="number"
                    className="w-40"
                    value={metaDia}
                    onChange={(e) => setMetaDia(e.target.value)}
                  />
                </div>
                <Button onClick={save} disabled={saving}>
                  Salvar meta
                </Button>
                <div className="space-y-1.5">
                  <Label>Feriado no mês</Label>
                  <Input
                    type="date"
                    className="w-44"
                    value={feriado}
                    onChange={(e) => setFeriado(e.target.value)}
                  />
                </div>
                <Button variant="outline" onClick={addFeriado}>
                  Adicionar feriado
                </Button>
              </div>
            ) : null}

            {meta.feriados.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {meta.feriados.map((f) => (
                  <Badge key={f} variant="secondary" className="gap-1">
                    {fmtDayLabel(f)}
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => void setFeriados(meta.feriados.filter((x) => x !== f))}
                        aria-label={`Remover feriado ${f}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    ) : null}
                  </Badge>
                ))}
              </div>
            ) : null}

            <DayGrid rows={real.rows} />

            <SimulationBlock
              days={days}
              metaDia={Number(meta.meta_dia ?? 0)}
              entries={entries}
              opToProduct={opToProduct}
              products={products}
              allowedProductIds={allowedProductIds}
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function DayGrid({
  rows,
  simulated = false,
}: {
  rows: ReturnType<typeof buildMonthRows>["rows"];
  simulated?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum dia útil neste mês.</p>;
  }
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {rows.map((r) => {
        const ok = r.resultado >= 0 && r.meta > 0;
        return (
          <div
            key={r.date}
            className={cn(
              "flex w-56 shrink-0 flex-col rounded-lg border",
              simulated && "border-dashed",
              !r.due && "border-dashed opacity-60",
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-sm font-medium">
              {fmtDayLabel(r.date)}
              {!r.due ? (
                <span className="text-[10px] font-normal uppercase text-muted-foreground">
                  {simulated ? "sem simulação" : "a vencer"}
                </span>
              ) : null}
            </div>
            <div className="flex-1 space-y-2 p-3">
              {!r.due ? (
                <p className="text-xs text-muted-foreground">
                  {simulated ? "Nenhum produto simulado neste dia" : "Dia ainda não vencido"}
                </p>
              ) : r.lines.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem produção</p>
              ) : (
                r.lines.map((l) => (
                  <div key={l.productId} className="text-xs">
                    <p className="font-semibold">OP interna: {l.opInterna || "não definida"}</p>
                    <p className="text-muted-foreground">
                      {l.quantity} pçs · {brl(l.value)}
                    </p>
                  </div>
                ))
              )}
              {r.warning ? (
                <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                  {r.warning}
                </p>
              ) : null}
            </div>
            <div className="space-y-0.5 border-t px-3 py-2 text-xs">
              <p className="text-muted-foreground">Meta: {brl(r.meta)}</p>
              {r.due ? (
                <>
                  <p className={cn("font-semibold", ok ? "text-emerald-600" : "text-foreground")}>
                    Atingido: {brl(r.atingido)}
                  </p>
                  <p
                    className={cn(
                      "font-semibold",
                      r.resultado >= 0 ? "text-emerald-600" : "text-destructive",
                    )}
                  >
                    Resultado: {brl(r.resultado)}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Atingido: —</p>
              )}
            </div>
          </div>
        );
      })}

    </div>
  );
}

function SimulationBlock({
  days,
  metaDia,
  entries,
  opToProduct,
  products,
  allowedProductIds,
}: {
  days: string[];
  metaDia: number;
  entries: Parameters<typeof buildMonthRows>[0]["entries"];
  opToProduct: Map<string, string>;
  products: Product[];
  allowedProductIds: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [sim, setSim] = useState<SimEntry[]>([]);
  const [day, setDay] = useState(days[0] ?? "");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");

  /** produzido na última operação do setor, por produto */
  const producedByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      const pid = opToProduct.get(e.operation_id);
      if (!pid) continue;
      map.set(pid, (map.get(pid) ?? 0) + e.quantity);
    }
    return map;
  }, [entries, opToProduct]);

  const pending = useMemo(
    () =>
      products
        .filter((p) => allowedProductIds.has(p.id))
        .map((p) => ({
          product: p,
          restante: Math.max(p.total_quantity - (producedByProduct.get(p.id) ?? 0), 0),
        }))
        .filter((x) => x.restante > 0),
    [products, allowedProductIds, producedByProduct],
  );

  const selected = pending.find((x) => x.product.id === productId);
  const result = buildMonthRows({
    days,
    metaDia,
    entries,
    opToProduct,
    products,
    allowedProductIds,
    simulated: sim,
    allDue: true,
  });


  const add = () => {
    if (!day || !productId) return;
    const quantity = Number(qty) || selected?.restante || 0;
    if (quantity <= 0) return;
    setSim([...sim, { date: day, productId, quantity }]);
    setProductId("");
    setQty("");
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border-2 border-dashed border-amber-500/60 bg-amber-500/5">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <FlaskConical className="h-4 w-4 text-amber-600" />
              SIMULAÇÃO de Meta e Faturamento
              <Badge variant="outline" className="border-amber-500 text-amber-600">
                projeção
              </Badge>
            </span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 border-t border-dashed border-amber-500/60 p-4">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Cenário hipotético — nada aqui altera produção, marcações ou a meta real.
            </p>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Dia</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                >
                  {days.map((d) => (
                    <option key={d} value={d}>
                      {fmtDayLabel(d)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Produto não finalizado no setor</Label>
                <SearchableSelect
                  options={pending.map((x) => ({
                    value: x.product.id,
                    label: `${x.product.op_interna || "s/ OP interna"} — ${x.product.name}`,
                    searchText: `${x.product.op_number} ${x.product.reference}`,
                  }))}
                  value={productId}
                  onChange={(v) => {
                    setProductId(v);
                    const p = pending.find((x) => x.product.id === v);
                    setQty(String(p?.restante ?? ""));
                  }}
                  placeholder="Selecione o produto"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Qtd. simulada</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder={selected ? String(selected.restante) : "0"}
                  />
                  <Button onClick={add} disabled={!productId}>
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {sim.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {sim.map((s, i) => {
                  const p = products.find((x) => x.id === s.productId);
                  return (
                    <Badge key={`${s.date}-${s.productId}-${i}`} variant="secondary" className="gap-1">
                      {fmtDayLabel(s.date)} · {p?.op_interna || p?.name} · {s.quantity} pçs
                      <button
                        type="button"
                        aria-label="Remover simulação"
                        onClick={() => setSim(sim.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
                <Button variant="ghost" size="sm" onClick={() => setSim([])}>
                  Limpar simulação
                </Button>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <p className="text-xl font-semibold">{brl(result.metaTotal)}</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Meta total (simulada)
                  </p>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <p className="text-xl font-semibold">{brl(result.atingidoTotal)}</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Atingido projetado
                  </p>
                </CardContent>
              </Card>
            </div>

            <DayGrid rows={result.rows} simulated />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
