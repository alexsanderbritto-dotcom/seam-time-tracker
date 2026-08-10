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
import { supabase } from "@/integrations/supabase/client";
import { ProductPhotoCell } from "@/components/ProductPhoto";
import {
  brl,
  catalogOperationsQuery,
  clientsQuery,
  companiesQuery,
  entriesQuery,
  operationsQuery,
  productsQuery,
  sectorsQuery,
  type Product,
} from "@/lib/production";
import { Plus, Trash2, Pencil } from "lucide-react";

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
};

function ProdutosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);
  const [selectedOps, setSelectedOps] = useState<string[]>([]);
  const [opSearch, setOpSearch] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: products = [] } = useQuery(productsQuery);
  const { data: operations = [] } = useQuery(operationsQuery);
  const { data: entries = [] } = useQuery(entriesQuery());
  const { data: companies = [] } = useQuery(companiesQuery);
  const { data: clients = [] } = useQuery(clientsQuery);
  const { data: sectors = [] } = useQuery(sectorsQuery);
  const { data: catalogOps = [] } = useQuery(catalogOperationsQuery);

  const producedByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) map[e.product_id] = (map[e.product_id] ?? 0) + e.quantity;
    return map;
  }, [entries]);

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
    setOpSearch("");
    setFile(null);
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
    });
    setSelectedOps(
      operations
        .filter((o) => o.product_id === p.id && o.catalog_operation_id)
        .map((o) => o.catalog_operation_id as string),
    );
    setOpSearch("");
    setFile(null);
    setOpen(true);
  }

  async function ensureName(table: "companies" | "clients", value: string, list: { name: string }[]) {
    const name = value.trim();
    if (!name) return null;
    if (!list.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      await supabase.from(table).insert({ name });
      qc.invalidateQueries({ queryKey: [table] });
    }
    return name;
  }

  async function uploadFile(): Promise<string | null> {
    if (!file) return null;
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `fichas/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-files").upload(path, file);
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
      await supabase
        .from("operations")
        .delete()
        .in("id", toRemove.map((o) => o.id));
    }

    const existing = new Set(
      current.map((o) => o.catalog_operation_id).filter(Boolean) as string[],
    );
    const toAdd = selectedOps
      .filter((id) => !existing.has(id))
      .map((id) => {
        const c = catalogOps.find((o) => o.id === id);
        return {
          product_id: productId,
          name: c?.name ?? "Operação",
          catalog_operation_id: id,
        };
      });
    if (toAdd.length > 0) await supabase.from("operations").insert(toAdd);
  }

  async function save() {
    if (!form.name || !form.reference || !form.op_number) {
      toast.error("Nome, referência e OP são obrigatórios.");
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
        ...(photoPath ? { photo_url: photoPath } : {}),
      };

      let productId = editing?.id;
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select().single();
        if (error) throw error;
        productId = data.id;
      }

      if (productId) await syncOperations(productId);

      toast.success(editing ? "Produto atualizado." : "Produto cadastrado.");
      setOpen(false);
      setForm(empty);
      setSelectedOps([]);
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
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Produto excluído.");
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  const statusTotals = useMemo(() => {
    const acc = { em_estoque: 0, em_producao: 0, finalizado: 0 } as Record<string, number>;
    for (const p of products) {
      if (acc[p.status] === undefined) acc[p.status] = 0;
      acc[p.status] = (acc[p.status] ?? 0) + p.total_quantity;
    }
    return acc;
  }, [products]);

  return (
    <AppLayout title="Produtos" subtitle="Ordens de produção e suas operações.">
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <CardTitle className="text-base">Produtos cadastrados</CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Novo produto
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Ficha</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>OP</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Vlr. unit.</TableHead>
                  <TableHead className="text-right">Vlr. total</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>NF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="py-10 text-center text-muted-foreground">
                      Nenhum produto cadastrado ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((p) => {
                    const emProducao = (producedByProduct[p.id] ?? 0) > 0;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <ProductPhotoCell path={p.photo_url} title={p.name} />
                        </TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                        <TableCell className="font-mono text-xs">{p.op_number}</TableCell>
                        <TableCell>{p.cliente ?? "—"}</TableCell>
                        <TableCell>{p.empresa ?? "—"}</TableCell>
                        <TableCell className="text-right">{p.total_quantity}</TableCell>
                        <TableCell className="text-right">{brl(p.unit_value ?? 0)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {brl((p.unit_value ?? 0) * p.total_quantity)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {p.entry_date ? p.entry_date.split("-").reverse().join("/") : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{p.nf_number ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={emProducao ? "default" : "outline"}>
                            {emProducao ? "Em produção" : "Em estoque"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => removeProduct(p.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto / OP" : "Novo produto / OP"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
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
                    return (
                      <div key={s.id} className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {s.name}
                        </p>
                        {list.map((o) => (
                          <label key={o.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={selectedOps.includes(o.id)}
                              onCheckedChange={(v) =>
                                setSelectedOps((prev) =>
                                  v ? [...prev, o.id] : prev.filter((id) => id !== o.id),
                                )
                              }
                            />
                            <span>{o.name}</span>
                            {o.expected_per_hour != null ? (
                              <span className="text-xs text-muted-foreground">
                                ({o.expected_per_hour}/h)
                              </span>
                            ) : null}
                          </label>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedOps.length} operação(ões) selecionada(s).
              </p>
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
