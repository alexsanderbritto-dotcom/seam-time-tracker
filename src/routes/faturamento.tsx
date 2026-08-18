import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Plus } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { MetaSetorModule } from "@/components/MetaSetorModule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { useMarcadorSession } from "@/lib/marcador-session";
import {
  brl,
  buildProductRows,
  esteiraQuery,
  entriesQuery,
  operationsQuery,
  productsQuery,
  type Product,
  type ProductRow,
} from "@/lib/production";
import {
  ColumnFilter,
  applyColumnFilters,
  valueOf,
  type ColumnFilterState,
} from "@/components/ColumnFilter";
import {
  faturamentoMesProdutosQuery,
  faturamentoMesesQuery,
  MES_NOMES,
  mesLabel,
} from "@/lib/faturamento";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/faturamento")({
  component: FaturamentoPage,
  head: () => ({
    meta: [
      { title: "Faturamento | Controle de Produção" },
      {
        name: "description",
        content:
          "Acompanhe entregas, notas fiscais de saída, valores faturados por mês e metas de produção por setor.",
      },
      { property: "og:title", content: "Faturamento | Controle de Produção" },
      {
        property: "og:description",
        content: "Faturamento por mês, NF de saída e metas de valor por setor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR") : "—";

type Filters = {
  entregaDe: string;
  entregaAte: string;
  previsaoDe: string;
  previsaoAte: string;
};

const emptyFilters: Filters = {
  entregaDe: "",
  entregaAte: "",
  previsaoDe: "",
  previsaoAte: "",
};

function FaturamentoPage() {
  const qc = useQueryClient();
  const { isAdmin } = useMarcadorSession();
  const { data: products = [] } = useQuery(productsQuery);
  const { data: meses = [] } = useQuery(faturamentoMesesQuery);
  const { data: mesProdutos = [] } = useQuery(faturamentoMesProdutosQuery);

  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ delivery: "", forecast: "", nf: "" });
  const [saving, setSaving] = useState(false);
  const [openMes, setOpenMes] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const now = new Date();
  const [novo, setNovo] = useState({ mes: now.getMonth() + 1, ano: now.getFullYear() });
  const [editingProdutos, setEditingProdutos] = useState<string | null>(null);
  const [colFilters, setColFilters] = useState<ColumnFilterState>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  const accessors = useMemo(
    () => ({
      cliente: (p: Product) => p.cliente,
      empresa: (p: Product) => p.empresa,
      op_number: (p: Product) => p.op_number,
      op_interna: (p: Product) => p.op_interna,
    }),
    [],
  );
  const optionsFor = (key: keyof typeof accessors) =>
    Array.from(new Set(products.map((p) => valueOf(accessors[key](p))))).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { numeric: true }),
    );
  const setFilter = (key: string, values: string[]) =>
    setColFilters((prev) => ({ ...prev, [key]: values }));

  useEffect(() => {
    const up = () => {
      dragging.current = false;
    };
    const move = (e: MouseEvent) => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener("mouseup", up);
    window.addEventListener("mousemove", move);
    return () => {
      window.removeEventListener("mouseup", up);
      window.removeEventListener("mousemove", move);
    };
  }, []);

  const passesFilters = (p: Product) => {
    const d = p.delivery_date;
    const f = p.forecast_date;
    if (filters.entregaDe && (!d || d < filters.entregaDe)) return false;
    if (filters.entregaAte && (!d || d > filters.entregaAte)) return false;
    if (filters.previsaoDe && (!f || f < filters.previsaoDe)) return false;
    if (filters.previsaoAte && (!f || f > filters.previsaoAte)) return false;
    return true;
  };

  const productsOfMes = (mesId: string) => {
    const ids = new Set(
      mesProdutos.filter((x) => x.mes_id === mesId).map((x) => x.product_id),
    );
    return products.filter((p) => ids.has(p.id));
  };

  /** produtos que ainda não pertencem a nenhum mês */
  const assignedIds = useMemo(() => {
    const taken = new Set(mesProdutos.map((x) => x.product_id));
    return taken;
  }, [mesProdutos]);

  /** lista de seleção de um mês: produtos livres + os já vinculados a este mês */
  const selectableProducts = (mesId: string) =>
    products.filter(
      (p) =>
        !assignedIds.has(p.id) ||
        mesProdutos.some((x) => x.mes_id === mesId && x.product_id === p.id),
    );

  /** os cards do topo refletem apenas os produtos exibidos na tela */
  const scoped = useMemo(() => {
    if (!openMes) return [] as Product[];
    return applyColumnFilters(
      productsOfMes(openMes).filter(passesFilters),
      colFilters,
      accessors,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMes, products, mesProdutos, filters, colFilters, accessors]);

  const value = (p: Product) => p.total_quantity * Number(p.unit_value ?? 0);
  const selectedSum = products
    .filter((p) => selected.has(p.id))
    .reduce((s2, p) => s2 + value(p), 0);
  const totalValue = scoped.reduce((s, p) => s + value(p), 0);
  const toInvoiceValue = scoped.filter((p) => !p.delivery_date).reduce((s, p) => s + value(p), 0);
  const invoicedValue = scoped.filter((p) => !!p.delivery_date).reduce((s, p) => s + value(p), 0);
  const scopedPieces = scoped.reduce((s, p) => s + p.total_quantity, 0);
  const avgPieceValue = scopedPieces > 0 ? totalValue / scopedPieces : 0;

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      delivery: p.delivery_date ?? "",
      forecast: p.forecast_date ?? "",
      nf: p.nf_out_number ?? "",
    });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await db
      .from("products")
      .update({
        delivery_date: form.delivery || null,
        forecast_date: form.forecast || null,
        nf_out_number: form.nf.trim() || null,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Faturamento atualizado");
    setEditing(null);
    void qc.invalidateQueries({ queryKey: productsQuery.queryKey });
  };

  const criarMes = async () => {
    const { error } = await db
      .from("faturamento_meses")
      .insert({ mes: novo.mes, ano: novo.ano });
    if (error) {
      toast.error(
        /duplicate|unique/i.test(error.message) ? "Este mês já existe." : error.message,
      );
      return;
    }
    toast.success("Mês criado");
    setAdding(false);
    void qc.invalidateQueries({ queryKey: faturamentoMesesQuery.queryKey });
  };

  const removerMes = async (id: string) => {
    const { error } = await db.from("faturamento_meses").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (openMes === id) setOpenMes(null);
    void qc.invalidateQueries({ queryKey: faturamentoMesesQuery.queryKey });
    void qc.invalidateQueries({ queryKey: faturamentoMesProdutosQuery.queryKey });
  };

  const toggleProduto = async (mesId: string, productId: string, checked: boolean) => {
    if (checked) {
      const { error } = await db
        .from("faturamento_mes_produtos")
        .insert({ mes_id: mesId, product_id: productId });
      if (error) toast.error(error.message);
    } else {
      const link = mesProdutos.find((x) => x.mes_id === mesId && x.product_id === productId);
      if (link) {
        const { error } = await db.from("faturamento_mes_produtos").delete().eq("id", link.id);
        if (error) toast.error(error.message);
      }
    }
    void qc.invalidateQueries({ queryKey: faturamentoMesProdutosQuery.queryKey });
  };

  const hasFilters = Object.values(filters).some(Boolean);
  const escopo = openMes
    ? meses.find((m) => m.id === openMes)
    : null;

  const sortedMeses = useMemo(
    () => [...meses].sort((a, b) => b.ano - a.ano || b.mes - a.mes),
    [meses],
  );

  return (
    <AppLayout
      title="Faturamento"
      subtitle="Entregas, notas fiscais de saída e valores faturados por mês"
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-5">
              <p className="text-3xl font-semibold tracking-tight text-foreground">
                {brl(totalValue)}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                Valor total —{" "}
                {escopo ? mesLabel(escopo.mes, escopo.ano) : "nenhum mês aberto"}
                {hasFilters ? " (filtrado)" : ""}
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-5">
              <p className="text-3xl font-semibold tracking-tight text-foreground">
                {brl(toInvoiceValue)}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                Produtos a faturar (sem data efetiva de entrega)
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-5">
              <p className="text-3xl font-semibold tracking-tight text-foreground">
                {brl(invoicedValue)}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                Valor faturado (com data efetiva de entrega)
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-sky-500">
            <CardContent className="p-5">
              <p className="text-3xl font-semibold tracking-tight text-foreground">
                {brl(avgPieceValue)}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                Valor médio por peça ({scopedPieces} peças)
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="grid gap-4 p-5 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Entrega efetiva — de</Label>
              <Input
                type="date"
                value={filters.entregaDe}
                onChange={(e) => setFilters({ ...filters, entregaDe: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Entrega efetiva — até</Label>
              <Input
                type="date"
                value={filters.entregaAte}
                onChange={(e) => setFilters({ ...filters, entregaAte: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Previsão — de</Label>
              <Input
                type="date"
                value={filters.previsaoDe}
                onChange={(e) => setFilters({ ...filters, previsaoDe: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Previsão — até</Label>
              <Input
                type="date"
                value={filters.previsaoAte}
                onChange={(e) => setFilters({ ...filters, previsaoAte: e.target.value })}
              />
            </div>
            <div className="md:col-span-4">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasFilters}
                onClick={() => setFilters(emptyFilters)}
              >
                Limpar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {isAdmin ? (
          adding ? (
            <Card>
              <CardContent className="flex flex-wrap items-end gap-3 p-5">
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
                <Button onClick={criarMes}>Criar mês</Button>
                <Button variant="ghost" onClick={() => setAdding(false)}>
                  Cancelar
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar mês
            </Button>
          )
        ) : null}

        {sortedMeses.length === 0 ? (
          <Card>
            <CardContent className="p-5 text-sm text-muted-foreground">
              Nenhum mês criado. Use “Adicionar mês” para agrupar produtos por período.
            </CardContent>
          </Card>
        ) : null}

        {sortedMeses.map((m) => {
          const lista = sortByOpInterna(
            applyColumnFilters(productsOfMes(m.id).filter(passesFilters), colFilters, accessors),
          );
          const isOpen = openMes === m.id;
          return (
            <Collapsible
              key={m.id}
              open={isOpen}
              onOpenChange={(o) => setOpenMes(o ? m.id : null)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 p-5 text-left"
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      {mesLabel(m.mes, m.ano)}
                      <Badge variant="secondary">{lista.length} produtos</Badge>
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 shrink-0 transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4 border-t p-5">
                    {isAdmin ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setEditingProdutos(editingProdutos === m.id ? null : m.id)
                          }
                        >
                          {editingProdutos === m.id ? "Fechar seleção" : "Selecionar produtos"}
                        </Button>
                        <ConfirmDelete
                          title="Excluir mês?"
                          description={`O mês ${mesLabel(m.mes, m.ano)} será excluído e os produtos vinculados voltarão a ficar disponíveis para seleção.`}
                          onConfirm={() => void removerMes(m.id)}
                        >
                          <Button variant="ghost" size="sm" className="text-destructive">
                            Excluir mês
                          </Button>
                        </ConfirmDelete>
                      </div>
                    ) : null}

                    {editingProdutos === m.id ? (
                      <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-3">
                        {selectableProducts(m.id).length === 0 ? (
                          <p className="px-2 py-3 text-sm text-muted-foreground">
                            Todos os produtos já estão vinculados a outros meses.
                          </p>
                        ) : null}
                        {selectableProducts(m.id).map((p) => {
                          const checked = mesProdutos.some(
                            (x) => x.mes_id === m.id && x.product_id === p.id,
                          );
                          return (
                            <label
                              key={p.id}
                              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) =>
                                  void toggleProduto(m.id, p.id, v === true)
                                }
                              />
                              <span className="text-sm">
                                <span className="font-medium">{p.name}</span>{" "}
                                <span className="text-muted-foreground">
                                  · OP {p.op_number}
                                  {p.op_interna ? ` · interna ${p.op_interna}` : ""}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : null}

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead>REF</TableHead>
                            <TableHead>
                              <ColumnFilter
                                label="OP"
                                options={optionsFor("op_number")}
                                selected={colFilters["op_number"] ?? []}
                                onChange={(v) => setFilter("op_number", v)}
                              />
                            </TableHead>
                            <TableHead>
                              <ColumnFilter
                                label="OP Interna"
                                options={optionsFor("op_interna")}
                                selected={colFilters["op_interna"] ?? []}
                                onChange={(v) => setFilter("op_interna", v)}
                              />
                            </TableHead>
                            <TableHead>
                              <ColumnFilter
                                label="Cliente"
                                options={optionsFor("cliente")}
                                selected={colFilters["cliente"] ?? []}
                                onChange={(v) => setFilter("cliente", v)}
                              />
                            </TableHead>
                            <TableHead>
                              <ColumnFilter
                                label="Empresa"
                                options={optionsFor("empresa")}
                                selected={colFilters["empresa"] ?? []}
                                onChange={(v) => setFilter("empresa", v)}
                              />
                            </TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead className="text-right">Vlr unit.</TableHead>
                            <TableHead className="text-right">Vlr total</TableHead>
                            <TableHead>Entrada</TableHead>
                            <TableHead>NF entrada</TableHead>
                            <TableHead>Previsão</TableHead>
                            <TableHead>Entrega efetiva</TableHead>
                            <TableHead>NF saída</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lista.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={16}
                                className="py-8 text-center text-muted-foreground"
                              >
                                Nenhum produto vinculado a este mês.
                              </TableCell>
                            </TableRow>
                          ) : (
                            lista.map((p) => (
                              <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.name}</TableCell>
                                <TableCell>{p.reference}</TableCell>
                                <TableCell>{p.op_number}</TableCell>
                                <TableCell className="font-mono text-xs">
                                  {p.op_interna ?? ""}
                                </TableCell>
                                <TableCell>{p.cliente ?? "—"}</TableCell>
                                <TableCell>{p.empresa ?? "—"}</TableCell>
                                <TableCell className="text-right">{p.total_quantity}</TableCell>
                                <TableCell className="text-right">
                                  {brl(Number(p.unit_value ?? 0))}
                                </TableCell>
                                <TableCell
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    dragging.current = true;
                                    setSelected((prev) => {
                                      const next = e.ctrlKey || e.metaKey ? new Set(prev) : new Set<string>();
                                      if (prev.has(p.id) && next.has(p.id)) next.delete(p.id);
                                      else next.add(p.id);
                                      return next;
                                    });
                                  }}
                                  onMouseEnter={() => {
                                    if (!dragging.current) return;
                                    setSelected((prev) => new Set(prev).add(p.id));
                                  }}
                                  className={cn(
                                    "cursor-cell select-none text-right font-medium",
                                    selected.has(p.id) && "bg-primary/15 ring-1 ring-inset ring-primary",
                                  )}
                                >
                                  {brl(value(p))}
                                </TableCell>
                                <TableCell>{fmtDate(p.entry_date)}</TableCell>
                                <TableCell>{p.nf_number ?? "—"}</TableCell>
                                <TableCell>{fmtDate(p.forecast_date)}</TableCell>
                                <TableCell>{fmtDate(p.delivery_date)}</TableCell>
                                <TableCell>{p.nf_out_number ?? "—"}</TableCell>
                                <TableCell>
                                  <Badge variant={p.delivery_date ? "default" : "secondary"}>
                                    {p.delivery_date
                                      ? "Entregue"
                                      : p.status === "em_producao"
                                        ? "Em produção"
                                        : "Em estoque"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEdit(p)}
                                  >
                                    Editar
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}

        {selected.size > 1 && cursor ? (
          <div
            className="pointer-events-none fixed z-50 rounded-md border border-border bg-popover px-3 py-1.5 text-sm font-medium shadow-lg"
            style={{ left: cursor.x + 16, top: cursor.y + 16 }}
          >
            Soma: {brl(selectedSum)}{" "}
            <span className="text-muted-foreground">({selected.size} itens)</span>
          </div>
        ) : null}

        <MetaSetorModule />

        {editing ? (
          <Card>
            <CardContent className="grid gap-4 p-5 md:grid-cols-4">
              <div className="md:col-span-4">
                <p className="text-sm font-medium">
                  Editando faturamento — {editing.name} (OP {editing.op_number})
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Previsão de entrega</Label>
                <Input
                  type="date"
                  value={form.forecast}
                  onChange={(e) => setForm({ ...form, forecast: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data efetiva de entrega</Label>
                <Input
                  type="date"
                  value={form.delivery}
                  onChange={(e) => setForm({ ...form, delivery: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>NF de saída</Label>
                <Input
                  value={form.nf}
                  onChange={(e) => setForm({ ...form, nf: e.target.value })}
                  placeholder="Número da NF"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={save} disabled={saving}>
                  Salvar
                </Button>
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppLayout>
  );
}
