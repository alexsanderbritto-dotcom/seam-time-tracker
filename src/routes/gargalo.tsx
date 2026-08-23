import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  catalogOperationsQuery,
  entriesQuery,
  esteiraQuery,
  operationsQuery,
  productsQuery,
  sectorsQuery,
} from "@/lib/production";
import { AlertTriangle, Factory } from "lucide-react";

const LIMITE_OPERACAO = 200;

export const Route = createFileRoute("/gargalo")({
  head: () => ({
    meta: [
      { title: "Gargalo na Produção | Controle de Confecção" },
      {
        name: "description",
        content:
          "Analise gargalos entre setores e entre operações do mesmo setor nos produtos da esteira de produção.",
      },
      { property: "og:title", content: "Gargalo na Produção | Controle de Confecção" },
      {
        property: "og:description",
        content: "Comparativo de produção entre setores e operações dos produtos na esteira.",
      },
    ],
  }),
  component: GargaloPage,
});

function GargaloPage() {
  const { data: esteira = [] } = useQuery(esteiraQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const { data: operations = [] } = useQuery(operationsQuery);
  const { data: catalogOps = [] } = useQuery(catalogOperationsQuery);
  const { data: sectors = [] } = useQuery(sectorsQuery);
  const { data: entries = [] } = useQuery(entriesQuery());

  /** frações ativas da esteira — a OP Interna vem daqui, não do produto mestre */
  const lotes = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p] as const));
    return esteira
      .map((e) => {
        const product = byId.get(e.produto_id);
        return product ? { id: e.id, product, opInterna: e.op_interna } : null;
      })
      .filter((x): x is { id: string; product: (typeof products)[number]; opInterna: string | null } => !!x);
  }, [esteira, products]);

  const catSector = useMemo(
    () => new Map(catalogOps.map((c) => [c.id, c.sector_id] as const)),
    [catalogOps],
  );

  const loteIds = useMemo(() => new Set(lotes.map((l) => l.id)), [lotes]);

  /** operação do produto + fração -> total produzido */
  const producedByOpLote = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      if (!e.lote_id || !loteIds.has(e.lote_id)) continue;
      const k = `${e.operation_id}|${e.lote_id}`;
      map.set(k, (map.get(k) ?? 0) + e.quantity);
    }
    return map;
  }, [entries, loteIds]);

  const producedOf = (operationId: string, loteId: string) =>
    producedByOpLote.get(`${operationId}|${loteId}`) ?? 0;

  /* ---------- 4.1 Gargalo por setor ---------- */
  const sectorTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const o of operations) {
      if (!o.is_last_operation || !o.catalog_operation_id) continue;
      const sid = catSector.get(o.catalog_operation_id);
      if (!sid) continue;
      for (const l of lotes) {
        if (l.product.id !== o.product_id) continue;
        totals.set(sid, (totals.get(sid) ?? 0) + producedOf(o.id, l.id));
      }
    }
    return sectors
      .filter((s) => totals.has(s.id))
      .map((s) => ({ sector: s, total: totals.get(s.id) ?? 0 }))
      .sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operations, lotes, catSector, producedByOpLote, sectors]);

  const topSector = sectorTotals[0];

  /* ---------- 4.2 Gargalo por operação dentro do setor ---------- */
  const operationGaps = useMemo(() => {
    const result: {
      productId: string;
      loteId: string;
      productName: string;
      opInterna: string | null;
      sectorName: string;
      leader: string;
      leaderQty: number;
      rows: { name: string; produced: number; gap: number }[];
    }[] = [];

    for (const lote of lotes) {
      const ops = operations.filter(
        (o) => o.product_id === lote.product.id && o.catalog_operation_id,
      );
      for (const s of sectors) {
        const list = ops.filter((o) => catSector.get(o.catalog_operation_id as string) === s.id);
        if (list.length < 2) continue;
        const withQty = list.map((o) => ({ name: o.name, produced: producedOf(o.id, lote.id) }));
        const max = Math.max(...withQty.map((x) => x.produced));
        const min = Math.min(...withQty.map((x) => x.produced));
        if (max - min <= LIMITE_OPERACAO) continue;
        const leader = withQty.find((x) => x.produced === max);
        const rows = withQty
          .filter((x) => max - x.produced > LIMITE_OPERACAO)
          .map((x) => ({ ...x, gap: max - x.produced }))
          .sort((a, b) => b.gap - a.gap);
        result.push({
          productId: lote.product.id,
          loteId: lote.id,
          productName: lote.product.name,
          opInterna: lote.opInterna,
          sectorName: s.name,
          leader: leader?.name ?? "—",
          leaderQty: max,
          rows,
        });
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotes, operations, sectors, catSector, producedByOpLote]);


  return (
    <AppLayout
      title="Gargalo na Produção"
      subtitle="Comparativo de avanço entre setores e entre operações do mesmo setor."
    >
      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="text-base">Gargalo por setor</CardTitle>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Factory className="h-3.5 w-3.5" />
            Considera apenas os produtos que estão na Esteira de Produção, somando a quantidade
            produzida na última operação de cada setor.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Produzido (últimas operações)</TableHead>
                  <TableHead className="text-right">Gargalo vs. setor mais adiantado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectorTotals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                      Nenhum setor com última operação definida nos produtos da esteira.
                    </TableCell>
                  </TableRow>
                ) : (
                  sectorTotals.map((row) => {
                    const gap = (topSector?.total ?? 0) - row.total;
                    return (
                      <TableRow key={row.sector.id}>
                        <TableCell className="font-medium">{row.sector.name}</TableCell>
                        <TableCell className="text-right">{row.total}</TableCell>
                        <TableCell className="text-right">
                          {gap > 0 ? (
                            <span className="rounded-md bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">
                              −{gap}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">mais adiantado</span>
                          )}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gargalo por operação (mesmo setor)</CardTitle>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Factory className="h-3.5 w-3.5" />
            Apenas produtos na Esteira de Produção. Só aparecem diferenças acima de{" "}
            {LIMITE_OPERACAO} peças entre a operação mais adiantada e as demais do mesmo setor.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {operationGaps.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum gargalo acima de {LIMITE_OPERACAO} peças identificado.
            </p>
          ) : (
            operationGaps.map((g) => (
              <div
                key={`${g.loteId}-${g.sectorName}`}
                className="rounded-lg border border-border p-3"
              >
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="font-mono text-xs font-bold">
                    OP INTERNA: {g.opInterna || "não definida"}
                  </span>
                  <span>{g.productName}</span>
                  <span className="text-xs font-normal text-muted-foreground">· {g.sectorName}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Operação mais adiantada: <strong>{g.leader}</strong> ({g.leaderQty} peças)
                </p>
                <div className="mt-2 space-y-1">
                  {g.rows.map((r) => (
                    <div
                      key={r.name}
                      className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-1.5 text-sm"
                    >
                      <span className="min-w-0 truncate">{r.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {r.produced} pçs
                      </span>
                      <span className="shrink-0 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                        gargalo de {r.gap}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
