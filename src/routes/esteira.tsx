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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ProductPhotoCell } from "@/components/ProductPhoto";
import { addToEsteira, removeFromEsteira } from "@/lib/esteira.functions";
import { useMarcadorSession } from "@/lib/marcador-session";
import {
  buildLotes,
  esteiraQuery,
  esteiraTodasQuery,
  lotesOfProduct,
  productCompletion,
  productsQuery,
  entriesQuery,
  operationsQuery,
  remainingToDistribute,
  PECA_PILOTO_LABEL,
} from "@/lib/production";
import { Pencil, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/esteira")({
  head: () => ({
    meta: [
      { title: "Esteira de Produção | Controle de Confecção" },
      {
        name: "description",
        content:
          "Acompanhe visualmente as OPs internas em andamento na esteira de produção, com quantidade fracionada por OP.",
      },
      { property: "og:title", content: "Esteira de Produção | Controle de Confecção" },
      {
        property: "og:description",
        content: "OPs internas em andamento na esteira, com fotos da peça piloto e ficha técnica.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EsteiraPage,
});

const fmtDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

function EsteiraPage() {
  const qc = useQueryClient();
  const { session, isAdmin } = useMarcadorSession();
  const [open, setOpen] = useState(false);
  const [loteId, setLoteId] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const [opInterna, setOpInterna] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{ id: string; name: string } | null>(null);

  const { data: products = [] } = useQuery(productsQuery);
  const { data: esteira = [] } = useQuery(esteiraQuery);
  const { data: esteiraAll = [] } = useQuery(esteiraTodasQuery);
  const { data: operations = [] } = useQuery(operationsQuery);
  const { data: entries = [] } = useQuery(entriesQuery());

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p] as const)),
    [products],
  );

  const lotes = useMemo(() => buildLotes(esteira, products), [esteira, products]);

  /** frações removidas da esteira (reaproveitáveis para corrigir engano) */
  const removidasDe = (pid: string) =>
    esteiraAll.filter((e) => e.produto_id === pid && e.status === "removido");

  const restanteDe = (pid: string, ignore?: string) => {
    const p = productById.get(pid);
    if (!p) return 0;
    return remainingToDistribute(p, lotesOfProduct(esteiraAll, pid), ignore);
  };


  const options = useMemo(
    () =>
      products.map((p) => {
        const restante = restanteDe(p.id);
        return {
          value: p.id,
          label: `${p.name} · OP ${p.op_number}`,
          searchText: `${p.name} ${p.reference} ${p.op_number} ${p.op_interna ?? ""}`,
          triggerNode: (
            <span className="flex flex-col text-left leading-tight">
              <span className="truncate font-medium">{p.name}</span>
              <span className="font-mono text-xs text-muted-foreground">
                OP {p.op_number}
                {p.reference ? ` · REF ${p.reference}` : null}
              </span>
            </span>
          ),
          node: (
            <span className="flex flex-col leading-tight">
              <span className="truncate">{p.name}</span>
              <span className="font-mono text-xs text-muted-foreground">
                OP {p.op_number}
                {p.reference ? ` · REF ${p.reference}` : null} · restam {restante} pç
              </span>
            </span>
          ),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, esteira],
  );

  const removidas = productId && !loteId ? removidasDe(productId) : [];
  const sourcesQtd = removidas
    .filter((r) => sourceIds.includes(r.id))
    .reduce((s, r) => s + (r.quantidade || 0), 0);
  const restanteAtual =
    (productId ? restanteDe(productId, loteId ?? undefined) : 0) + sourcesQtd;

  function openAdd() {
    setLoteId(null);
    setProductId("");
    setOpInterna("");
    setQuantidade("");
    setSourceIds([]);
    setOpen(true);
  }

  function openEdit(lote: { id: string; product: { id: string }; opInterna: string | null; quantidade: number }) {
    setLoteId(lote.id);
    setProductId(lote.product.id);
    setOpInterna(lote.opInterna ?? "");
    setQuantidade(String(lote.quantidade || ""));
    setSourceIds([]);
    setOpen(true);
  }

  function pickProduct(id: string) {
    setProductId(id);
    setOpInterna("");
    setSourceIds([]);
    setQuantidade(String(restanteDe(id)));
  }

  function toggleSource(id: string, qtd: number) {
    setSourceIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      const delta = prev.includes(id) ? -qtd : qtd;
      setQuantidade((q) => String(Math.max(0, (Number(q) || 0) + delta)));
      return next;
    });
  }

  async function save() {
    if (!productId) {
      toast.error("Selecione um produto.");
      return;
    }
    const qtd = Number(quantidade);
    if (!Number.isFinite(qtd) || qtd <= 0) {
      toast.error("Informe a quantidade desta OP Interna.");
      return;
    }
    if (qtd > restanteAtual) {
      toast.error(`Restam apenas ${restanteAtual} peças para distribuir neste produto.`);
      return;
    }
    setSaving(true);
    try {
      const res = await addToEsteira({
        data: {
          token: session?.token ?? "",
          productId,
          opInterna,
          quantidade: qtd,
          ...(loteId ? { loteId } : {}),
          ...(sourceIds.length > 0 ? { sourceLoteIds: sourceIds } : {}),
        },
      });
      if (!res.ok) throw new Error(res.error);


      toast.success(loteId ? "OP Interna atualizada." : "OP Interna adicionada à esteira.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["esteira_producao"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar OP Interna.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      const res = await removeFromEsteira({ data: { token: session?.token ?? "", id } });
      if (!res.ok) throw new Error(res.error);
      toast.success("OP Interna removida da esteira.");
      qc.invalidateQueries({ queryKey: ["esteira_producao"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover OP Interna.");
    }
  }

  return (
    <AppLayout
      title="Esteira de Produção"
      subtitle="Cada OP Interna é uma fração do produto, com quantidade e progresso próprios."
      requireAdmin={false}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 md:mb-5">
        <p className="text-sm text-muted-foreground">
          {lotes.length} OP(s) interna(s) na esteira.
          {!isAdmin ? " Visualização somente leitura." : null}
        </p>
        {isAdmin ? (
          <Button className="h-11 w-full text-base sm:h-9 sm:w-auto sm:text-sm" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar OP Interna
          </Button>
        ) : null}
      </div>

      {lotes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma OP Interna na esteira ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
          {lotes.map((lote) => {
            const p = lote.product;
            const loteEntries = entries.filter((e) => e.lote_id === lote.id);
            const { pct, done } = productCompletion(
              { id: p.id, total_quantity: lote.quantidade },
              operations,
              loteEntries,
            );
            return (
              <Card key={lote.id} className="overflow-hidden">
                <CardContent className="space-y-4 p-4 pt-5 md:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="break-words text-base font-semibold uppercase">
                        <span className="font-bold">{lote.opInterna || "sem OP interna"} — </span>
                        {p.name}
                      </h2>
                      <p className="font-mono text-xs text-muted-foreground">
                        REF {p.reference} · OP {p.op_number}
                      </p>
                    </div>
                    <Badge className="shrink-0" variant={done ? "secondary" : "default"}>
                      {done ? "Finalizada" : "Em produção"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Ficha
                      </p>
                      <ProductPhotoCell path={p.photo_url} title={p.name} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Peça piloto
                      </p>
                      <Badge variant={p.peca_piloto === "sim" ? "default" : "outline"}>
                        {p.peca_piloto ? PECA_PILOTO_LABEL[p.peca_piloto] : "—"}
                      </Badge>
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">OP Interna</dt>
                      <dd className="font-mono">{lote.opInterna ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Qtd. desta OP</dt>
                      <dd className="tabular-nums font-medium">{lote.quantidade}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Qtd. total do produto</dt>
                      <dd className="tabular-nums">{p.total_quantity}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Conclusão</dt>
                      <dd className="tabular-nums">{pct.toFixed(0)}%</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Cliente</dt>
                      <dd className="truncate">{p.cliente ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Entrada</dt>
                      <dd>{fmtDate(p.entry_date)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Previsão</dt>
                      <dd>{fmtDate(p.forecast_date)}</dd>
                    </div>
                  </dl>

                  {isAdmin ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="outline"
                        className="h-11 text-base sm:h-9 sm:text-sm"
                        onClick={() => openEdit(lote)}
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 text-base sm:h-9 sm:text-sm"
                        onClick={() =>
                          setPendingRemove({
                            id: lote.id,
                            name: `${lote.opInterna ?? "sem OP"} — ${p.name}`,
                          })
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Remover
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={!!pendingRemove}
        onOpenChange={(v) => {
          if (!v) setPendingRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover OP Interna da esteira?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove?.name} deixa de aparecer na esteira, no Dashboard e na Marcação de
              Produção. A OP Interna, a quantidade e o histórico continuam salvos e a fração segue
              aparecendo em Produtos e Faturamento.
            </AlertDialogDescription>

          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 sm:h-9">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 sm:h-9"
              onClick={() => {
                if (pendingRemove) remove(pendingRemove.id);
                setPendingRemove(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {loteId ? "Editar OP Interna" : "Adicionar OP Interna à esteira"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Produto</Label>
              <SearchableSelect
                options={options}
                value={productId}
                onChange={pickProduct}
                placeholder="Buscar por referência ou nome…"
                searchPlaceholder="Digite a referência ou o nome…"
                emptyMessage="Nenhum produto encontrado."
                disabled={!!loteId}
              />
            </div>

            {productId ? (
              <div className="rounded-md bg-secondary p-3 text-sm">
                Disponível para esta OP Interna:{" "}
                <strong className="tabular-nums">{restanteAtual}</strong> peças de{" "}
                {productById.get(productId)?.total_quantity ?? 0}.
                {restanteAtual <= 0 ? (
                  <span className="mt-1 block text-destructive">
                    Este produto já está totalmente distribuído. Reduza uma OP Interna existente ou
                    reaproveite uma fração removida para liberar quantidade.
                  </span>
                ) : null}
                {lotesOfProduct(esteiraAll, productId).length > 0 ? (
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {lotesOfProduct(esteiraAll, productId).map((l) => (
                      <li key={l.id} className="tabular-nums">
                        OP {l.op_interna || "—"}: {l.quantidade} pç
                        {l.status === "removido" ? " (fora da esteira)" : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {removidas.length > 0 ? (
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium">Reaproveitar frações removidas</p>
                <p className="text-xs text-muted-foreground">
                  Selecione as frações removidas por engano para somar suas quantidades a esta nova
                  OP Interna. As selecionadas deixam de existir e qualquer sobra volta ao saldo não
                  alocado.
                </p>
                {removidas.map((r) => (
                  <label
                    key={r.id}
                    className="flex min-h-11 cursor-pointer items-center gap-3 text-sm md:min-h-0"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={sourceIds.includes(r.id)}
                      onChange={() => toggleSource(r.id, r.quantidade || 0)}
                    />
                    <span className="tabular-nums">
                      OP Interna {r.op_interna || "—"} — {r.quantidade} peças
                    </span>
                  </label>
                ))}
              </div>
            ) : null}



            <div className="space-y-1.5">
              <Label>OP Interna</Label>
              <Input
                placeholder="Ex: 401"
                inputMode="numeric"
                className="h-11 text-base md:h-10 md:text-sm"
                value={opInterna}
                onChange={(e) => setOpInterna(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                O mesmo produto pode ter várias OPs internas, cada uma com sua quantidade.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Quantidade desta OP Interna</Label>
              <Input
                type="number"
                min={1}
                max={restanteAtual}
                inputMode="numeric"
                className="h-11 text-base md:h-10 md:text-sm"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="h-11 w-full text-base sm:h-10 sm:w-auto sm:text-sm"
              onClick={save}
              disabled={saving || restanteAtual <= 0}
            >
              {saving ? "Salvando…" : loteId ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
