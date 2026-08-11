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
import { ProductPhotoCell, PilotPhotoCell } from "@/components/ProductPhoto";
import { addToEsteira, removeFromEsteira } from "@/lib/esteira.functions";
import { useMarcadorSession } from "@/lib/marcador-session";
import { esteiraQuery, productsQuery, STATUS_LABEL, type Product } from "@/lib/production";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/esteira")({
  head: () => ({
    meta: [
      { title: "Esteira de Produção | Controle de Confecção" },
      {
        name: "description",
        content:
          "Acompanhe visualmente os produtos em andamento na esteira de produção e defina a OP interna de cada peça.",
      },
      { property: "og:title", content: "Esteira de Produção | Controle de Confecção" },
      {
        property: "og:description",
        content: "Produtos em andamento na esteira, com fotos da peça piloto e ficha técnica.",
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
  const [productId, setProductId] = useState("");
  const [opInterna, setOpInterna] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{ id: string; name: string } | null>(null);

  const { data: products = [] } = useQuery(productsQuery);
  const { data: esteira = [] } = useQuery(esteiraQuery);

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p] as const)),
    [products],
  );

  const items = useMemo(
    () =>
      esteira
        .map((e) => ({ entry: e, product: productById.get(e.produto_id) }))
        .filter((x): x is { entry: (typeof esteira)[number]; product: Product } => !!x.product),
    [esteira, productById],
  );

  const options = useMemo(
    () => products.map((p) => ({ value: p.id, label: `${p.reference} · ${p.name}` })),
    [products],
  );

  function openAdd() {
    setProductId("");
    setOpInterna("");
    setOpen(true);
  }

  function pickProduct(id: string) {
    setProductId(id);
    setOpInterna(productById.get(id)?.op_interna ?? "");
  }

  async function save() {
    if (!productId) {
      toast.error("Selecione um produto.");
      return;
    }
    setSaving(true);
    try {
      const res = await addToEsteira({
        data: { token: session?.token ?? "", productId, opInterna },
      });
      if (!res.ok) throw new Error(res.error);

      toast.success("Produto adicionado à esteira.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["esteira_producao"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao adicionar produto.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      const res = await removeFromEsteira({ data: { token: session?.token ?? "", id } });
      if (!res.ok) throw new Error(res.error);
      toast.success("Produto removido da esteira.");
      qc.invalidateQueries({ queryKey: ["esteira_producao"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover produto.");
    }
  }


  return (
    <AppLayout
      title="Esteira de Produção"
      subtitle="Acompanhamento visual dos produtos em andamento."
      requireAdmin={false}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 md:mb-5">
        <p className="text-sm text-muted-foreground">
          {items.length} produto(s) na esteira.
          {!isAdmin ? " Visualização somente leitura." : null}
        </p>
        {isAdmin ? (
          <Button className="h-11 w-full text-base sm:h-9 sm:w-auto sm:text-sm" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar produto
          </Button>
        ) : null}
      </div>


      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum produto na esteira ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
          {items.map(({ entry, product: p }) => (
            <Card key={entry.id} className="overflow-hidden">
              <CardContent className="space-y-4 p-4 pt-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-base font-semibold uppercase">
                      {p.op_interna ? (
                        <span className="font-bold">{p.op_interna} — </span>
                      ) : null}
                      {p.name}
                    </h2>

                    <p className="font-mono text-xs text-muted-foreground">
                      REF {p.reference} · OP {p.op_number}
                    </p>
                  </div>
                  <Badge
                    className="shrink-0"
                    variant={
                      p.status === "finalizado"
                        ? "secondary"
                        : p.status === "em_producao"
                          ? "default"
                          : "outline"
                    }
                  >
                    {STATUS_LABEL[p.status] ?? p.status}
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
                    <PilotPhotoCell paths={p.pilot_photos ?? []} title={p.name} />
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">OP Interna</dt>
                    <dd className="font-mono">{p.op_interna ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Quantidade</dt>
                    <dd className="tabular-nums">{p.total_quantity}</dd>
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
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      className="h-11 w-full text-base sm:h-9 sm:w-auto sm:text-sm"
                      onClick={() => setPendingRemove({ id: entry.id, name: p.name })}
                    >
                      <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Remover
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
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
            <AlertDialogTitle>Remover produto da esteira?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove?.name} deixará de aparecer na esteira. O cadastro do produto e a OP
              interna continuam salvos.
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
            <DialogTitle>Adicionar produto à esteira</DialogTitle>
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
              />
            </div>
            <div className="space-y-1.5">
              <Label>OP Interna</Label>
              <Input
                placeholder="Ex: 1024"
                inputMode="numeric"
                className="h-11 text-base md:h-10 md:text-sm"
                value={opInterna}
                onChange={(e) => setOpInterna(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Se o produto já tiver OP interna, o valor aparece preenchido e pode ser
                atualizado.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button className="h-11 w-full text-base sm:h-10 sm:w-auto sm:text-sm" onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
