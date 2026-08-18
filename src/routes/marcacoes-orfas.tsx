import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect, type SearchableOption } from "@/components/SearchableSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { reassignOrphanEntries } from "@/lib/esteira.functions";
import { useMarcadorSession } from "@/lib/marcador-session";
import {
  employeesQuery,
  entriesQuery,
  esteiraTodasQuery,
  operationsQuery,
  productsQuery,
} from "@/lib/production";

export const Route = createFileRoute("/marcacoes-orfas")({
  head: () => ({
    meta: [
      { title: "Marcações sem OP Interna | Controle de Confecção" },
      {
        name: "description",
        content:
          "Confira e reatribua marcações de produção que ficaram sem fração (OP Interna) vinculada.",
      },
      { property: "og:title", content: "Marcações sem OP Interna | Controle de Confecção" },
      {
        property: "og:description",
        content: "Revise as marcações órfãs e vincule cada uma à OP Interna correta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrfasPage,
});

const fmtDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
const hhmm = (t: string) => t.slice(0, 5);

function OrfasPage() {
  const qc = useQueryClient();
  const { session } = useMarcadorSession();
  const [pick, setPick] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const { data: entries = [] } = useQuery(entriesQuery());
  const { data: products = [] } = useQuery(productsQuery);
  const { data: operations = [] } = useQuery(operationsQuery);
  const { data: employees = [] } = useQuery(employeesQuery);
  const { data: esteiraAll = [] } = useQuery(esteiraTodasQuery);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p] as const)), [products]);
  const opName = useMemo(
    () => new Map(operations.map((o) => [o.id, o.name] as const)),
    [operations],
  );
  const empName = useMemo(
    () => new Map(employees.map((e) => [e.id, e.name] as const)),
    [employees],
  );

  const groups = useMemo(() => {
    const orphans = entries.filter((e) => !e.lote_id);
    const map = new Map<string, typeof orphans>();
    for (const e of orphans) {
      const list = map.get(e.product_id) ?? [];
      list.push(e);
      map.set(e.product_id, list);
    }
    return Array.from(map.entries()).map(([productId, list]) => ({
      productId,
      list: [...list].sort(
        (a, b) =>
          a.entry_date.localeCompare(b.entry_date) || a.slot_start.localeCompare(b.slot_start),
      ),
      total: list.reduce((s, e) => s + e.quantity, 0),
      lotes: esteiraAll.filter((l) => l.produto_id === productId),
    }));
  }, [entries, esteiraAll]);

  async function assign(productId: string, entryIds: string[]) {
    const loteId = pick[productId];
    if (!loteId) {
      toast.error("Escolha a OP Interna de destino.");
      return;
    }
    setSaving(productId);
    try {
      const res = await reassignOrphanEntries({
        data: { token: session?.token ?? "", entryIds, loteId },
      });
      if (!res.ok) throw new Error(res.error);
      toast.success(`${res.count} marcação(ões) vinculada(s).`);
      qc.invalidateQueries({ queryKey: ["production_entries"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao vincular marcações.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <AppLayout
      title="Marcações sem OP Interna"
      subtitle="Produção já lançada que perdeu o vínculo com a fração. Nada é excluído — revise e vincule à OP Interna correta."
    >
      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma marcação órfã. Tudo vinculado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => {
            const p = productById.get(g.productId);
            const options: SearchableOption[] = g.lotes.map((l) => ({
              value: l.id,
              label: `${l.op_interna ?? "sem OP interna"} · ${l.quantidade} pç${
                l.status === "removido" ? " (fora da esteira)" : ""
              }`,
              searchText: l.op_interna ?? "",
            }));
            return (
              <Card key={g.productId}>
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <CardTitle className="text-base uppercase">{p?.name ?? "Produto"}</CardTitle>
                    <p className="font-mono text-xs text-muted-foreground">
                      OP {p?.op_number ?? "—"} · REF {p?.reference ?? "—"} · {g.list.length}{" "}
                      marcação(ões) · {g.total} peças
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {options.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Este produto não tem nenhuma fração cadastrada. Crie a OP Interna na Esteira
                        para poder vincular.
                      </p>
                    ) : (
                      <>
                        <div className="w-64">
                          <SearchableSelect
                            options={options}
                            value={pick[g.productId] ?? ""}
                            onChange={(v) => setPick((s) => ({ ...s, [g.productId]: v }))}
                            placeholder="OP Interna de destino"
                          />
                        </div>
                        <Button
                          disabled={saving === g.productId}
                          onClick={() =>
                            assign(
                              g.productId,
                              g.list.map((e) => e.id),
                            )
                          }
                        >
                          Vincular todas
                        </Button>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Horário</TableHead>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Operação</TableHead>
                        <TableHead className="text-right">Qtd.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.list.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>{fmtDate(e.entry_date)}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {hhmm(e.slot_start)}–{hhmm(e.slot_end)}
                            {e.is_overtime ? " (extra)" : ""}
                          </TableCell>
                          <TableCell>{empName.get(e.employee_id) ?? "—"}</TableCell>
                          <TableCell>{opName.get(e.operation_id) ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{e.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
