import { useEffect, useMemo, useState } from "react";
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
  esteiraTodasQuery,
  operationsQuery,
  productsQuery,
  sectorsQuery,
  type Product,
} from "@/lib/production";
import {
  buildMonthRows,
  buildSimulationRows,
  faturamentoMesProdutosQuery,
  faturamentoMesesQuery,
  fmtDayLabel,
  lastOpsOfSector,
  MES_NOMES,
  mesLabel,
  metaSetorMesQuery,
  todayIso,
  workingDays,
  type LoteRef,
  type MetaSetorMes,
  type SimEntry,
} from "@/lib/faturamento";
import { feriadosQuery } from "@/lib/schedule";

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
  const { data: esteiraTodas = [] } = useQuery(esteiraTodasQuery);
  const { data: meses = [] } = useQuery(faturamentoMesesQuery);

  /** frações (OP Interna) — fonte correta da OP Interna de cada marcação */
  const lotes: LoteRef[] = useMemo(
    () =>
      esteiraTodas.map((e) => ({
        id: e.id,
        produto_id: e.produto_id,
        op_interna: e.op_interna,
        quantidade: e.quantidade || 0,
      })),
    [esteiraTodas],
  );
  const { data: mesProdutos = [] } = useQuery(faturamentoMesProdutosQuery);

  const { data: feriadosCentral = [] } = useQuery(feriadosQuery);
  const days = useMemo(
    () =>
      workingDays(meta.mes, meta.ano, [
        ...meta.feriados,
        ...feriadosCentral.map((f) => f.data),
      ]),
    [meta.mes, meta.ano, meta.feriados, feriadosCentral],
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
        lotes,
        closedDays: meta.dias_encerrados,
      }),
    [
      days,
      meta.meta_dia,
      entries,
      opToProduct,
      products,
      allowedProductIds,
      lotes,
      meta.dias_encerrados,
    ],
  );

  const encerrarDia = async (date: string) => {
    const lista = [...new Set([...meta.dias_encerrados, date])].sort();
    const { error } = await db
      .from("meta_setor_mes")
      .update({ dias_encerrados: lista })
      .eq("id", meta.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Produção do dia encerrada — meta redistribuída para os próximos dias");
    void qc.invalidateQueries({ queryKey: metaSetorMesQuery.queryKey });
  };

  const reabrirDia = async (date: string) => {
    const lista = meta.dias_encerrados.filter((d) => d !== date);
    const { error } = await db
      .from("meta_setor_mes")
      .update({ dias_encerrados: lista })
      .eq("id", meta.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Dia reaberto");
    void qc.invalidateQueries({ queryKey: metaSetorMesQuery.queryKey });
  };

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

            <DayGrid
              rows={real.rows}
              today={todayIso()}
              canManage={isAdmin}
              onEncerrar={(d) => void encerrarDia(d)}
              onReabrir={(d) => void reabrirDia(d)}
            />

            <SimulationBlock
              days={days}
              metaDia={Number(meta.meta_dia ?? 0)}
              entries={entries}
              opToProduct={opToProduct}
              products={products}
              allowedProductIds={allowedProductIds}
              lotes={lotes}
              closedDays={meta.dias_encerrados}
              sectorId={meta.sector_id}
              mes={meta.mes}
              ano={meta.ano}
              metaRestante={real.metaTotal - real.atingidoTotal}
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
  today,
  canManage = false,
  onEncerrar,
  onReabrir,
}: {
  rows: ReturnType<typeof buildMonthRows>["rows"];
  simulated?: boolean;
  today?: string;
  canManage?: boolean;
  onEncerrar?: (date: string) => void;
  onReabrir?: (date: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum dia útil neste mês.</p>;
  }
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {rows.map((r) => {
        const ok = r.resultado >= 0 && r.meta > 0;
        const emAndamento = !simulated && r.date === today && !r.closed;
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
              ) : emAndamento ? (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary">
                  em andamento
                </span>
              ) : !simulated && r.closed ? (
                <span className="text-[10px] font-normal uppercase text-muted-foreground">
                  encerrado
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
                  <div key={`${l.productId}:${l.loteId ?? ""}`} className="text-xs">
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
                    Atingido{emAndamento ? " (parcial)" : ""}: {brl(r.atingido)}
                  </p>
                  {emAndamento ? (
                    <p className="text-[11px] text-muted-foreground">
                      Meta ainda não redistribuída — encerre o dia para diluir a diferença.
                    </p>
                  ) : (
                    <p
                      className={cn(
                        "font-semibold",
                        r.resultado >= 0 ? "text-emerald-600" : "text-destructive",
                      )}
                    >
                      Resultado: {brl(r.resultado)}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Atingido: —</p>
              )}
              {canManage && emAndamento && onEncerrar ? (
                <Button
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Encerrar a produção de hoje? A diferença entre meta e atingido será redistribuída para os próximos dias úteis.",
                      )
                    )
                      onEncerrar(r.date);
                  }}
                >
                  Encerrar produção do dia
                </Button>
              ) : null}
              {canManage && !simulated && r.closed && r.date === today && onReabrir ? (
                <>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Dia encerrado. Novos lançamentos ainda recalculam o valor e a redistribuição.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1 w-full"
                    onClick={() => onReabrir(r.date)}
                  >
                    Reabrir dia
                  </Button>
                </>
              ) : null}
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
  lotes,
  closedDays,
}: {
  days: string[];
  metaDia: number;
  entries: Parameters<typeof buildMonthRows>[0]["entries"];
  opToProduct: Map<string, string>;
  products: Product[];
  allowedProductIds: Set<string>;
  lotes: LoteRef[];
  closedDays: string[];
}) {
  const [open, setOpen] = useState(false);
  const [sim, setSim] = useState<SimEntry[]>([]);
  const today = todayIso();
  const openDays = useMemo(
    () => days.filter((d) => d >= today && !closedDays.includes(d)),
    [days, today, closedDays],
  );
  const [day, setDay] = useState(openDays[0] ?? "");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");

  useEffect(() => {
    if (openDays.length > 0 && !openDays.includes(day)) setDay(openDays[0]!);
  }, [openDays, day]);

  /** produzido na última operação do setor, por fração (ou produto sem fração) */
  const producedByLine = useMemo(() => {
    const map = new Map<string, number>();
    const loteIds = new Set(lotes.map((l) => l.id));
    for (const e of entries) {
      const pid = opToProduct.get(e.operation_id);
      if (!pid) continue;
      const k = `${pid}|${e.lote_id && loteIds.has(e.lote_id) ? e.lote_id : ""}`;
      map.set(k, (map.get(k) ?? 0) + e.quantity);
    }
    return map;
  }, [entries, opToProduct, lotes]);

  /** linhas simuláveis: cada fração do produto, ou o produto quando não fracionado */
  const pending = useMemo(() => {
    const list: {
      key: string;
      productId: string;
      loteId: string | null;
      opInterna: string | null;
      product: Product;
      restante: number;
    }[] = [];
    for (const p of products) {
      if (!allowedProductIds.has(p.id)) continue;
      const doProduto = lotes.filter((l) => l.produto_id === p.id);
      if (doProduto.length === 0) {
        list.push({
          key: `${p.id}|`,
          productId: p.id,
          loteId: null,
          opInterna: p.op_interna,
          product: p,
          restante: Math.max(p.total_quantity - (producedByLine.get(`${p.id}|`) ?? 0), 0),
        });
        continue;
      }
      for (const l of doProduto) {
        list.push({
          key: `${p.id}|${l.id}`,
          productId: p.id,
          loteId: l.id,
          opInterna: l.op_interna,
          product: p,
          restante: Math.max(l.quantidade - (producedByLine.get(`${p.id}|${l.id}`) ?? 0), 0),
        });
      }
    }
    return list.filter((x) => x.restante > 0);
  }, [products, allowedProductIds, lotes, producedByLine]);

  const selected = pending.find((x) => x.key === productId);
  const result = buildSimulationRows({
    days,
    metaDia,
    entries,
    opToProduct,
    products,
    allowedProductIds,
    lotes,
    simulated: sim,
    today,
    closedDays,
  });


  const add = () => {
    if (!day || !selected) return;
    const quantity = Number(qty) || selected.restante || 0;
    if (quantity <= 0) return;
    setSim([
      ...sim,
      { date: day, productId: selected.productId, loteId: selected.loteId, quantity },
    ]);
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
              Cenário hipotético — nada aqui altera produção, marcações ou a meta real. Só
              aparecem hoje e os dias a vencer, e a meta diária exibida já parte da situação real
              atual (com a diluição dos dias encerrados). Ao adicionar produtos em um dia, a
              projeção propaga o impacto para os dias seguintes.
            </p>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Dia</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                >
                  {openDays.map((d) => (
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
                    value: x.key,
                    label: `${x.opInterna || "s/ OP interna"} — ${x.product.name}`,
                    searchText: `${x.product.op_number} ${x.product.reference} ${x.opInterna ?? ""}`,
                  }))}
                  value={productId}
                  onChange={(v) => {
                    setProductId(v);
                    const p = pending.find((x) => x.key === v);
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
                  const op = s.loteId
                    ? (lotes.find((l) => l.id === s.loteId)?.op_interna ?? null)
                    : p?.op_interna;
                  return (
                    <Badge key={`${s.date}-${s.productId}-${i}`} variant="secondary" className="gap-1">
                      {fmtDayLabel(s.date)} · {op || p?.name} · {s.quantity} pçs
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
                    Meta restante (hoje + dias a vencer)
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
