import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { entriesQuery, operationsQuery, productsQuery } from "@/lib/production";
import { Plus, Trash2, Settings2 } from "lucide-react";

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos e Operações | Controle de Confecção" },
      {
        name: "description",
        content:
          "Cadastre produtos, referências, ordens de produção e as operações de costura de cada peça.",
      },
      { property: "og:title", content: "Produtos e Operações | Controle de Confecção" },
      {
        property: "og:description",
        content: "Cadastre produtos, ordens de produção e operações de costura.",
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
  const [form, setForm] = useState(empty);
  const [opsText, setOpsText] = useState("");

  const { data: products = [] } = useQuery(productsQuery);
  const { data: operations = [] } = useQuery(operationsQuery);
  const { data: entries = [] } = useQuery(entriesQuery());
  const { data: companies = [] } = useQuery(companiesQuery);

  const producedByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) map[e.product_id] = (map[e.product_id] ?? 0) + e.quantity;
    return map;
  }, [entries]);

  const totalValue =
    (Number(form.total_quantity) || 0) * (Number(form.unit_value.replace(",", ".")) || 0);

  async function create() {
    if (!form.name || !form.reference || !form.op_number) {
      toast.error("Nome, referência e OP são obrigatórios.");
      return;
    }
    const empresa = form.empresa.trim();
    if (empresa && !companies.some((c) => c.name.toLowerCase() === empresa.toLowerCase())) {
      await supabase.from("companies").insert({ name: empresa });
      qc.invalidateQueries({ queryKey: ["companies"] });
    }
    const { data, error } = await supabase
      .from("products")
      .insert({
        name: form.name,
        reference: form.reference,
        op_number: form.op_number,
        cliente: form.cliente || null,
        empresa: empresa || null,
        total_quantity: Number(form.total_quantity) || 0,
        unit_value: Number(form.unit_value.replace(",", ".")) || 0,
        entry_date: form.entry_date || null,
        nf_number: form.nf_number || null,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const names = opsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length > 0) {
      await supabase
        .from("operations")
        .insert(names.map((name) => ({ product_id: data.id, name })));
    }
    toast.success("Produto cadastrado.");
    setForm(empty);
    setOpsText("");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["operations"] });
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


  return (
    <AppLayout title="Produtos" subtitle="Ordens de produção e suas operações.">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <CardTitle className="text-base">Produtos cadastrados</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" /> Novo produto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo produto / OP</DialogTitle>
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
                    <Label>Marca</Label>
                    <Input
                      placeholder="Sky"
                      value={form.brand}
                      onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Quantidade total</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.total_quantity}
                      onChange={(e) => setForm({ ...form, total_quantity: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Operações (uma por linha)</Label>
                  <textarea
                    className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder={"Barra de 2cm\nCós com duas agulhas\n5 passantes"}
                    value={opsText}
                    onChange={(e) => setOpsText(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={create}>Cadastrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>OP</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Produzido</TableHead>
                  <TableHead>Operações</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                      Nenhum produto cadastrado ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((p) => {
                    const done = producedByProduct[p.id] ?? 0;
                    const finished = p.total_quantity > 0 && done >= p.total_quantity;
                    const opCount = operations.filter((o) => o.product_id === p.id).length;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="font-mono text-xs">REF {p.reference}</TableCell>
                        <TableCell className="font-mono text-xs">OP {p.op_number}</TableCell>
                        <TableCell>{p.brand ?? "—"}</TableCell>
                        <TableCell className="text-right">{p.total_quantity}</TableCell>
                        <TableCell className="text-right font-medium">{done}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{opCount}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={finished ? "default" : "outline"}>
                            {finished ? "Concluído" : "Em produção"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" asChild>
                              <Link to="/produtos/$productId" params={{ productId: p.id }}>
                                <Settings2 className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeProduct(p.id)}
                            >
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
    </AppLayout>
  );
}
