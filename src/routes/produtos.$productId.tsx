import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { operationsQuery, productsQuery } from "@/lib/production";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/produtos/$productId")({
  head: () => ({
    meta: [
      { title: "Operações do produto | Controle de Confecção" },
      {
        name: "description",
        content: "Gerencie as operações de costura vinculadas a esta ordem de produção.",
      },
      { property: "og:title", content: "Operações do produto | Controle de Confecção" },
      {
        property: "og:description",
        content: "Gerencie as operações de costura vinculadas a esta ordem de produção.",
      },
    ],
  }),
  component: OperacoesPage,
});

function OperacoesPage() {
  const { productId } = Route.useParams();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [time, setTime] = useState("");

  const { data: products = [] } = useQuery(productsQuery);
  const { data: operations = [] } = useQuery(operationsQuery);

  const product = products.find((p) => p.id === productId);
  const ops = operations.filter((o) => o.product_id === productId);

  async function add() {
    if (!name.trim()) {
      toast.error("Informe o nome da operação.");
      return;
    }
    const { error } = await supabase.from("operations").insert({
      product_id: productId,
      name: name.trim(),
      standard_time: time ? Number(time) : null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setTime("");
    qc.invalidateQueries({ queryKey: ["operations"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("operations").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["operations"] });
  }

  return (
    <AppLayout
      title={product ? `${product.name} · OP ${product.op_number}` : "Operações"}
      subtitle={product ? `REF ${product.reference} · ${product.total_quantity} peças` : undefined}
    >
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/produtos">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para produtos
        </Link>
      </Button>

      <Card className="max-w-3xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Operações da produção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-52 flex-1 space-y-1.5">
              <Label>Nome da operação</Label>
              <Input
                placeholder="Barra de 2cm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
            </div>
            <div className="w-40 space-y-1.5">
              <Label>Tempo padrão (min)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Opcional"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <Button onClick={add}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operação</TableHead>
                <TableHead className="w-40">Tempo padrão</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ops.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    Nenhuma operação cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                ops.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell>{o.standard_time ? `${o.standard_time} min` : "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => remove(o.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
