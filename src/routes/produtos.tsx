import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { ProductPhotoCell } from "@/components/ProductPhoto";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ColumnFilter,
  applyColumnFilters,
  valueOf,
  type ColumnFilterState,
} from "@/components/ColumnFilter";
import { cn } from "@/lib/utils";
import {
  brl,
  buildProductRows,
  catalogOperationsQuery,
  clientsQuery,
  companiesQuery,
  entriesQuery,
  esteiraQuery,
  operationsQuery,
  productsQuery,
  sectorsQuery,
  PECA_PILOTO_LABEL,
  PECA_PILOTO_OPTIONS,
  STATUS_LABEL,
  type Product,
  type ProductRow,
} from "@/lib/production";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Plus, Trash2, Pencil, Copy, ChevronDown } from "lucide-react";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos | Controle de Confecção" },
      {
        name: "description",
        content:
          "Cadastre produtos, referências, ordens de produção, ficha técnica e as operações de cada peça.",
      },
      { property: "og:title", content: "Produtos | Controle de Confecção" },
      {
        property: "og:description",
        content: "Cadastre produtos, ordens de produção e vincule operações do catálogo.",
      },
    ],
  }),
  component: ProdutosPage,
});

const empty = {
  name: "",
  reference: "",
  op_number: "",
  cliente: "",
  empresa: "",
  total_quantity: "",
  unit_value: "",
  entry_date: "",
  nf_number: "",
  peca_piloto: "",
};

function ProdutosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);
  const [selectedOps, setSelectedOps] = useState<string[]>([]);
  /** setor -> operação do catálogo marcada como última daquele setor neste produto */
  const [lastBySector, setLastBySector] = useState<Record<string, string>>({});
  const [opSearch, setOpSearch] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dupValue, setDupValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [colFilters, setColFilters] = useState<ColumnFilterState>({});
  const [openBlocks, setOpenBlocks] = useState<Record<string, boolean>>({});

  const { data: products = [] } = useQuery(productsQuery);
  const { data: esteira = [] } = useQuery(esteiraQuery);
  const { data: operations = [] } = useQuery(operationsQuery);
  const { data: entries = [] } = useQuery(entriesQuery());
  const { data: companies = [] } = useQuery(companiesQuery);
  const { data: clients = [] } = useQuery(clientsQuery);
  const { data: sectors = [] } = useQuery(sectorsQuery);
  const { data: catalogOps = [] } = useQuery(catalogOperationsQuery);


  const totalValue =
    (Number(form.total_quantity) || 0) * (Number(form.unit_value.replace(",", ".")) || 0);

  const filteredCatalog = useMemo(() => {
    const q = opSearch.trim().toLowerCase();
    return catalogOps.filter((o) => !q || o.name.toLowerCase().includes(q));
  }, [catalogOps, opSearch]);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setSelectedOps([]);
    setLastBySector({});
    setOpSearch("");
    setFile(null);
    setDupValue("");
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      reference: p.reference,
      op_number: p.op_number,
      cliente: p.cliente ?? "",
      empresa: p.empresa ?? "",
      total_quantity: String(p.total_quantity ?? ""),
      unit_value: String(p.unit_value ?? ""),
      entry_date: p.entry_date ?? "",
      nf_number: p.nf_number ?? "",
      peca_piloto: p.peca_piloto ?? "",
    });
    const productOps = operations.filter((o) => o.product_id === p.id && o.catalog_operation_id);
    setSelectedOps(productOps.map((o) => o.catalog_operation_id as string));
    const lasts: Record<string, string> = {};
    for (const o of productOps) {
      if (!o.is_last_operation) continue;
      const c = catalogOps.find((x) => x.id === o.catalog_operation_id);
      if (c) lasts[c.sector_id] = c.id;
    }
    setLastBySector(lasts);
    setOpSearch("");
    setFile(null);
    setDupValue("");
    setOpen(true);
  }

  function toggleOp(opId: string, sectorId: string, checked: boolean) {
    setSelectedOps((prev) =>
      checked ? [...prev, opId] : prev.filter((id) => id !== opId),
    );
    if (!checked) {
      setLastBySector((prev) => {
        if (prev[sectorId] !== opId) return prev;
        const next = { ...prev };
        delete next[sectorId];
        return next;
      });
    }
  }

  /** setores que têm operações selecionadas neste produto */
  const usedSectors = useMemo(() => {
    const ids = new Set<string>();
    for (const id of selectedOps) {
      const c = catalogOps.find((o) => o.id === id);
      if (c) ids.add(c.sector_id);
    }
    return sectors.filter((s) => ids.has(s.id));
  }, [selectedOps, catalogOps, sectors]);

  const missingLast = usedSectors.filter((s) => !lastBySector[s.id]);

  /** opções de origem para duplicar operações — referência pode repetir entre produtos */
  const dupOptions = useMemo(
    () =>
      products
        .filter((p) => p.id !== editing?.id)
        .map((p) => ({
          value: p.id,
          label: `${p.name} · REF ${p.reference} · OP ${p.op_number}`,
          searchText: `${p.name} ${p.reference} ${p.op_number} ${p.cliente ?? ""}`,
          node: (
            <span className="flex flex-col leading-tight">
              <span className="truncate font-medium">{p.name}</span>
              <span className="font-mono text-xs text-muted-foreground">
                REF {p.reference} · OP {p.op_number}
                {p.cliente ? ` · ${p.cliente}` : ""}
              </span>
            </span>
          ),
        })),
    [products, editing],
  );

  function applyDuplicate(srcId: string) {
    setDupValue(srcId);
    const src = products.find((p) => p.id === srcId);
    if (!src || src.id === editing?.id) return;
    const srcOps = operations.filter((o) => o.product_id === src.id && o.catalog_operation_id);
    const ops = srcOps.map((o) => o.catalog_operation_id as string);
    const added = ops.filter((id) => !selectedOps.includes(id)).length;
    setSelectedOps((prev) => Array.from(new Set([...prev, ...ops])));
    // copia também as "últimas operações" por setor do produto de origem
    setLastBySector((prev) => {
      const next = { ...prev };
      for (const o of srcOps) {
        if (!o.is_last_operation) continue;
        const c = catalogOps.find((x) => x.id === o.catalog_operation_id);
        if (c) next[c.sector_id] = c.id;
      }
      return next;
    });
    toast.success(
      `${added} operação(ões) copiada(s) de ${src.name} (REF ${src.reference} · OP ${src.op_number}), incluindo as últimas operações por setor.`,
    );
  }




  async function ensureName(table: "companies" | "clients", value: string, list: { name: string }[]) {
    const name = value.trim();
    if (!name) return null;
    if (!list.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      await db.from(table).insert({ name });
      qc.invalidateQueries({ queryKey: [table] });
    }
    return name;
  }

  async function uploadFile(): Promise<string | null> {
    if (!file) return null;
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `fichas/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage.from("product-files").upload(path, file);
    if (error) {
      toast.error("Erro ao enviar arquivo: " + error.message);
      return null;
    }
    return path;
  }

  async function syncOperations(productId: string) {
    const current = operations.filter((o) => o.product_id === productId);
    const keep = new Set(selectedOps);
    const usedOpIds = new Set(entries.map((e) => e.operation_id));

    const toRemove = current.filter(
      (o) => o.catalog_operation_id && !keep.has(o.catalog_operation_id) && !usedOpIds.has(o.id),
    );
    if (toRemove.length > 0) {
      await db
        .from("operations")
        .delete()
        .in("id", toRemove.map((o) => o.id));
    }

    const existing = new Set(
      current.map((o) => o.catalog_operation_id).filter(Boolean) as string[],
    );
    const lastIds = new Set(Object.values(lastBySector));

    const toAdd = selectedOps
      .filter((id) => !existing.has(id))
      .map((id) => {
        const c = catalogOps.find((o) => o.id === id);
        return {
          product_id: productId,
          name: c?.name ?? "Operação",
          catalog_operation_id: id,
          is_last_operation: lastIds.has(id),
        };
      });
    if (toAdd.length > 0) await db.from("operations").insert(toAdd);

    // sincroniza a marcação de "última operação do setor" das operações mantidas
    const { data: rows } = await db
      .from("operations")
      .select("id,catalog_operation_id")
      .eq("product_id", productId);
    const list = (rows ?? []) as { id: string; catalog_operation_id: string | null }[];
    const markTrue = list.filter((r) => r.catalog_operation_id && lastIds.has(r.catalog_operation_id));
    const markFalse = list.filter((r) => !r.catalog_operation_id || !lastIds.has(r.catalog_operation_id));
    if (markTrue.length > 0) {
      await db.from("operations").update({ is_last_operation: true }).in("id", markTrue.map((r) => r.id));
    }
    if (markFalse.length > 0) {
      await db.from("operations").update({ is_last_operation: false }).in("id", markFalse.map((r) => r.id));
    }
  }

  async function save() {
    if (!form.name || !form.reference || !form.op_number) {
      toast.error("Nome, referência e OP são obrigatórios.");
      return;
    }
    if (!form.peca_piloto) {
      toast.error("Selecione a situação da peça piloto (SIM, NÃO ou DEVOLVIDO).");
      return;
    }
    if (missingLast.length > 0) {
      toast.error(
        `Marque a última operação do setor: ${missingLast.map((s) => s.name).join(", ")}.`,
      );
      return;
    }
    setSaving(true);
    try {
      const empresa = await ensureName("companies", form.empresa, companies);
      const cliente = await ensureName("clients", form.cliente, clients);
      const photoPath = await uploadFile();

      const payload = {
        name: form.name,
        reference: form.reference,
        op_number: form.op_number,
        cliente,
        empresa,
        total_quantity: Number(form.total_quantity) || 0,
        unit_value: Number(form.unit_value.replace(",", ".")) || 0,
        entry_date: form.entry_date || null,
        nf_number: form.nf_number || null,
        peca_piloto: form.peca_piloto,
        ...(photoPath ? { photo_url: photoPath } : {}),
      };

      let productId = editing?.id;
      if (editing) {
        const { error } = await db.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await db.from("products").insert(payload).select().single();
        if (error) throw error;
        productId = (data as { id: string }).id;
      }

      if (productId) await syncOperations(productId);

      toast.success(editing ? "Produto atualizado." : "Produto cadastrado.");
      setOpen(false);
      setForm(empty);
      setSelectedOps([]);
      setLastBySector({});
      setFile(null);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["operations"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar produto.");
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(id: string) {
    const { error } = await db.from("products").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Produto excluído.");
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  const accessors = useMemo(
    () => ({
      cliente: (r: ProductRow) => r.product.cliente,
      empresa: (r: ProductRow) => r.product.empresa,
      op_number: (r: ProductRow) => r.product.op_number,
      op_interna: (r: ProductRow) => r.opInterna,
    }),
    [],
  );

  /** cada fração é uma linha independente; produtos sem fração seguem como antes */
  const allRows = useMemo(
    () => buildProductRows(products, esteira, operations, entries),
    [products, esteira, operations, entries],
  );

  const optionsFor = (key: keyof typeof accessors) =>
    Array.from(new Set(allRows.map((r) => valueOf(accessors[key](r))))).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { numeric: true }),
    );

  const filtered = useMemo(
    () => applyColumnFilters(allRows, colFilters, accessors),
    [allRows, colFilters, accessors],
  );

  const statusTotals = useMemo(() => {
    const acc = { em_estoque: 0, em_producao: 0, finalizado: 0 } as Record<string, number>;
    for (const r of filtered) {
      if (acc[r.status] === undefined) acc[r.status] = 0;
      acc[r.status] = (acc[r.status] ?? 0) + r.quantidade;
    }
    return acc;
  }, [filtered]);

  const setFilter = (key: string, values: string[]) =>
    setColFilters((prev) => ({ ...prev, [key]: values }));

  const blocks = (["em_estoque", "em_producao", "finalizado"] as const).map((st) => ({
    status: st,
    rows: filtered.filter((r) => r.status === st),
  }));

  return (
    <AppLayout title="Produtos" subtitle="Ordens de produção e suas operações.">
      <div className="mb-4 flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Novo produto
        </Button>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {(["em_estoque", "em_producao", "finalizado"] as const).map((s) => (
          <Card key={s}>
            <CardContent className="pt-6">
              <p className="text-3xl font-semibold tabular-nums">{statusTotals[s] ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Quantidade total · {STATUS_LABEL[s]}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        {blocks.map(({ status, rows }) => {
          const isOpen = openBlocks[status] ?? status === "em_producao";
          return (
            <Card key={status}>
              <Collapsible
                open={isOpen}
                onOpenChange={(v) => setOpenBlocks((prev) => ({ ...prev, [status]: v }))}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="flex cursor-pointer flex-row items-center justify-between gap-3 pb-3">
                    <CardTitle className="text-base">
                      {STATUS_LABEL[status] ?? status}{" "}
                      <span className="text-muted-foreground">({rows.length})</span>
                    </CardTitle>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Ficha</TableHead>
                            <TableHead className="w-24">Peça piloto</TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead>Referência</TableHead>
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
                            <TableHead className="text-right">Quantidade</TableHead>
                            <TableHead className="text-right">Vlr. unit.</TableHead>
                            <TableHead className="text-right">Vlr. total</TableHead>
                            <TableHead>Entrada</TableHead>
                            <TableHead>NF</TableHead>
                            <TableHead className="w-24" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={14}
                                className="py-10 text-center text-muted-foreground"
                              >
                                Nenhum produto neste status.
                              </TableCell>
                            </TableRow>
                          ) : (
                            rows.map((r) => {
                              const p = r.product;
                              return (
                              <TableRow key={r.key}>
                                <TableCell>
                                  <ProductPhotoCell path={p.photo_url} title={p.name} />
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={p.peca_piloto === "sim" ? "default" : "outline"}
                                    className="whitespace-nowrap"
                                  >
                                    {p.peca_piloto ? PECA_PILOTO_LABEL[p.peca_piloto] : "—"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {p.name}
                                  {r.fracoes > 1 ? (
                                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                      fração {r.opInterna ?? "—"} de {r.fracoes}
                                    </span>
                                  ) : null}
                                </TableCell>
                                <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                                <TableCell className="font-mono text-xs">{p.op_number}</TableCell>
                                <TableCell className="font-mono text-xs">
                                  {r.opInterna ?? "—"}
                                </TableCell>
                                <TableCell>{p.cliente ?? "—"}</TableCell>
                                <TableCell>{p.empresa ?? "—"}</TableCell>
                                <TableCell className="text-right">{r.quantidade}</TableCell>
                                <TableCell className="text-right">
                                  {brl(p.unit_value ?? 0)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {brl((p.unit_value ?? 0) * r.quantidade)}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {p.entry_date ? p.entry_date.split("-").reverse().join("/") : "—"}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {p.nf_number ?? "—"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <ConfirmDelete
                                      title="Excluir produto?"
                                      description={`O produto ${p.name} (OP ${p.op_number})${
                                        r.fracoes > 0
                                          ? `, suas ${r.fracoes} fração(ões) na esteira`
                                          : ""
                                      } e suas operações serão excluídos permanentemente.`}
                                      onConfirm={() => void removeProduct(p.id)}
                                    >
                                      <Button variant="ghost" size="icon">
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </ConfirmDelete>
                                  </div>
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
              </Collapsible>
            </Card>
          );
        })}
      </div>


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto / OP" : "Novo produto / OP"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5 rounded-md border border-dashed border-input p-3">
              <Label className="flex items-center gap-2">
                <Copy className="h-4 w-4" /> Duplicar operações de um produto existente
              </Label>
              <SearchableSelect
                options={dupOptions}
                value={dupValue}
                onChange={applyDuplicate}
                placeholder="Buscar por nome, referência, OP ou cliente…"
                searchPlaceholder="Digite nome, REF, OP ou cliente…"
              />
              <p className="text-xs text-muted-foreground">
                Referências podem se repetir entre produtos: escolha na lista exatamente qual
                produto (REF · OP · cliente) será a origem. Copia apenas as operações, somando às
                já selecionadas.
              </p>

            </div>

            <div className="space-y-1.5">
              <Label>Nome do produto</Label>
              <Input
                placeholder="Bermuda Cargo"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Referência</Label>
                <Input
                  placeholder="123"
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Número da OP</Label>
                <Input
                  placeholder="123"
                  value={form.op_number}
                  onChange={(e) => setForm({ ...form, op_number: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <Input
                  list="clientes-list"
                  placeholder="Digite ou selecione"
                  value={form.cliente}
                  onChange={(e) => setForm({ ...form, cliente: e.target.value })}
                />
                <datalist id="clientes-list">
                  {clients.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  Clientes novos são salvos automaticamente para reuso.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Input
                  list="empresas-list"
                  placeholder="Digite ou selecione"
                  value={form.empresa}
                  onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                />
                <datalist id="empresas-list">
                  {companies.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  Empresas novas são salvas automaticamente para reuso.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.total_quantity}
                  onChange={(e) => setForm({ ...form, total_quantity: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valor unitário (R$)</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={form.unit_value}
                  onChange={(e) => setForm({ ...form, unit_value: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valor total</Label>
                <Input readOnly tabIndex={-1} className="bg-muted" value={brl(totalValue)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data de entrada</Label>
                <Input
                  type="date"
                  value={form.entry_date}
                  onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>NF de entrada</Label>
                <Input
                  placeholder="000123"
                  value={form.nf_number}
                  onChange={(e) => setForm({ ...form, nf_number: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Foto / Ficha do produto</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {editing?.photo_url && !file ? (
                <p className="text-xs text-muted-foreground">
                  Já existe um arquivo salvo. Escolha outro para substituir.
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>Peça piloto</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.peca_piloto}
                onChange={(e) => setForm({ ...form, peca_piloto: e.target.value })}
              >
                <option value="">Selecione…</option>
                {PECA_PILOTO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Campo obrigatório. Pode ser alterado depois (ex.: peça devolvida).
              </p>
            </div>

            <div className="space-y-2">
              <Label>Operações do produto</Label>
              <Input
                placeholder="Buscar operação…"
                value={opSearch}
                onChange={(e) => setOpSearch(e.target.value)}
              />
              <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border border-input p-3">
                {catalogOps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma operação cadastrada. Cadastre no módulo Operações.
                  </p>
                ) : (
                  sectors.map((s) => {
                    const list = filteredCatalog.filter((o) => o.sector_id === s.id);
                    if (list.length === 0) return null;
                    const sectorUsed = usedSectors.some((x) => x.id === s.id);
                    const lastId = lastBySector[s.id];
                    return (
                      <div key={s.id} className="space-y-1.5">
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {s.name}
                          {sectorUsed && !lastId ? (
                            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                              defina a última operação
                            </span>
                          ) : null}
                        </p>
                        {list.map((o) => {
                          const checked = selectedOps.includes(o.id);
                          const isLast = lastId === o.id;
                          return (
                            <div key={o.id} className="flex items-center gap-2 text-sm">
                              <label className="flex min-w-0 flex-1 items-center gap-2">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => toggleOp(o.id, s.id, v === true)}
                                />
                                <span className="truncate">{o.name}</span>
                                {o.expected_per_hour != null ? (
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    ({o.expected_per_hour}/h)
                                  </span>
                                ) : null}
                              </label>
                              {checked ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLastBySector((prev) => {
                                      const next = { ...prev };
                                      if (isLast) delete next[s.id];
                                      else next[s.id] = o.id;
                                      return next;
                                    })
                                  }
                                  className={
                                    isLast
                                      ? "shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground"
                                      : "shrink-0 rounded-full border border-input px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground hover:bg-accent"
                                  }
                                >
                                  {isLast ? "Última do setor" : "Marcar última"}
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedOps.length} operação(ões) selecionada(s). Cada setor usado precisa de
                exatamente uma operação marcada como “Última do setor”.
              </p>
              {missingLast.length > 0 ? (
                <p className="text-xs font-medium text-destructive">
                  Falta marcar a última operação em: {missingLast.map((s) => s.name).join(", ")}.
                </p>
              ) : null}

            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
