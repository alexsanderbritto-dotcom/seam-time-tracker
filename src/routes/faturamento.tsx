import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { brl, productsQuery, type Product } from "@/lib/production";

export const Route = createFileRoute("/faturamento")({
  component: FaturamentoPage,
  head: () => ({
    meta: [
      { title: "Faturamento | Controle de Produção" },
      {
        name: "description",
        content:
          "Acompanhe entregas, notas fiscais de saída e o valor faturado de cada ordem de produção da confecção.",
      },
      { property: "og:title", content: "Faturamento | Controle de Produção" },
      {
        property: "og:description",
        content: "Entregas, NF de saída e valores faturados por produto.",
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
  const { data: products = [] } = useQuery(productsQuery);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ delivery: "", forecast: "", nf: "" });
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const d = p.delivery_date;
      const f = p.forecast_date;
      if (filters.entregaDe && (!d || d < filters.entregaDe)) return false;
      if (filters.entregaAte && (!d || d > filters.entregaAte)) return false;
      if (filters.previsaoDe && (!f || f < filters.previsaoDe)) return false;
      if (filters.previsaoAte && (!f || f > filters.previsaoAte)) return false;
      return true;
    });
  }, [products, filters]);

  const totalValue = filtered.reduce(
    (sum, p) => sum + p.total_quantity * Number(p.unit_value ?? 0),
    0,
  );
  const invoicedValue = filtered
    .filter((p) => !!p.delivery_date)
    .reduce((sum, p) => sum + p.total_quantity * Number(p.unit_value ?? 0), 0);

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
    const { error } = await supabase
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

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <AppLayout
      title="Faturamento"
      subtitle="Entregas, notas fiscais de saída e valores faturados"
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-5">
              <p className="text-3xl font-semibold tracking-tight text-foreground">
                {brl(totalValue)}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                Valor total {hasFilters ? "(filtrado)" : "(todos os produtos)"}
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

        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>REF</TableHead>
                  <TableHead>OP</TableHead>
                  <TableHead>OP Interna</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Empresa</TableHead>
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
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={16} className="py-8 text-center text-muted-foreground">
                      Nenhum produto encontrado para os filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.reference}</TableCell>
                      <TableCell>{p.op_number}</TableCell>
                      <TableCell className="font-mono text-xs">{p.op_interna ?? ""}</TableCell>
                      <TableCell>{p.cliente ?? "—"}</TableCell>
                      <TableCell>{p.empresa ?? "—"}</TableCell>
                      <TableCell className="text-right">{p.total_quantity}</TableCell>
                      <TableCell className="text-right">{brl(Number(p.unit_value ?? 0))}</TableCell>
                      <TableCell className="text-right font-medium">
                        {brl(p.total_quantity * Number(p.unit_value ?? 0))}
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
                        <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

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
