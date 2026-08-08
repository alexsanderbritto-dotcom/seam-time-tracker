import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  buildSlots,
  employeesQuery,
  entriesQuery,
  fmt,
  operationsQuery,
  productsQuery,
  scheduleQuery,
  todayISO,
} from "@/lib/production";
import { Trash2, Check } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Marcação de Produção | Controle de Confecção" },
      {
        name: "description",
        content:
          "Registre a produção por colaborador, operação e horário em poucos cliques no chão de fábrica.",
      },
      { property: "og:title", content: "Marcação de Produção | Controle de Confecção" },
      {
        property: "og:description",
        content: "Registre a produção por colaborador, operação e horário em poucos cliques.",
      },
    ],
  }),
  component: MarcacaoPage,
});

function MarcacaoPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [employeeId, setEmployeeId] = useState("");
  const [productId, setProductId] = useState("");
  const [slotIdx, setSlotIdx] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: employees = [] } = useQuery(employeesQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const { data: operations = [] } = useQuery(operationsQuery);
  const { data: config } = useQuery(scheduleQuery);
  const { data: entries = [] } = useQuery(entriesQuery(date));

  const slots = useMemo(() => buildSlots(config), [config]);
  const productOps = useMemo(
    () => operations.filter((o) => o.product_id === productId),
    [operations, productId],
  );

  const producedByOperation = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) map[e.operation_id] = (map[e.operation_id] ?? 0) + e.quantity;
    return map;
  }, [entries]);

  const activeProduct = products.find((p) => p.id === productId);

  async function save() {
    const slot = slots[Number(slotIdx)];
    if (!employeeId || !productId || !slot) {
      toast.error("Preencha colaborador, produto e horário.");
      return;
    }
    const rows = Object.entries(selected)
      .filter(([, v]) => Number(v) > 0)
      .map(([operation_id, v]) => ({
        employee_id: employeeId,
        product_id: productId,
        operation_id,
        slot_start: slot.start,
        slot_end: slot.end,
        quantity: Number(v),
        entry_date: date,
      }));

    if (rows.length === 0) {
      toast.error("Informe a quantidade de ao menos uma operação.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("production_entries").insert(rows);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(`${rows.length} marcação(ões) registrada(s).`);
    setSelected({});
    qc.invalidateQueries({ queryKey: ["production_entries"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("production_entries").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Marcação excluída.");
    qc.invalidateQueries({ queryKey: ["production_entries"] });
  }

  async function updateQty(id: string, quantity: number) {
    const { error } = await supabase.from("production_entries").update({ quantity }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["production_entries"] });
  }


  const dayEntries = entries;

  return (
    <AppLayout
      title="Marcação de Produção"
      subtitle="Registre o que cada colaborador produziu em cada janela de horário."
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Nova marcação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Horário</Label>
                <Select value={slotIdx} onValueChange={setSlotIdx}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {slots.map((s, i) => (
                      <SelectItem key={s.start} value={String(i)}>
                        {fmt(s.start)} às {fmt(s.end)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Colaborador</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter((e) => e.active)
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Produto / OP</Label>
              <Select
                value={productId}
                onValueChange={(v) => {
                  setProductId(v);
                  setSelected({});
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · REF {p.reference} · OP {p.op_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Operações executadas</Label>
              {!productId ? (
                <p className="text-sm text-muted-foreground">Selecione um produto primeiro.</p>
              ) : productOps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este produto ainda não tem operações cadastradas.
                </p>
              ) : (
                <div className="divide-y divide-border rounded-md border border-border">
                  {productOps.map((op) => {
                    const done = producedByOperation[op.id] ?? 0;
                    const over = activeProduct ? done > activeProduct.total_quantity : false;
                    return (
                      <div key={op.id} className="flex items-center gap-3 px-3 py-2">
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
                          className="h-9 w-24"
                          placeholder="Qtd"
                          value={selected[op.id] ?? ""}
                          onChange={(e) =>
                            setSelected((s) => ({ ...s, [op.id]: e.target.value }))
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Button className="w-full" onClick={save} disabled={saving}>
              <Check className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Salvar marcação"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Marcações de {date.split("-").reverse().join("/")}
              <Badge variant="secondary" className="ml-2">
                {dayEntries.length}
              </Badge>
            </CardTitle>
          </CardHeader>
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
                          </TableCell>
                          <TableCell>{emp?.name ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {p ? `${p.name} · OP ${p.op_number}` : "—"}
                          </TableCell>
                          <TableCell>{op?.name ?? "—"}</TableCell>
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
                            <Button variant="ghost" size="icon" onClick={() => remove(e.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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
      </div>
    </AppLayout>
  );
}
