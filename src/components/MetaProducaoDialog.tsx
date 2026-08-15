import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect, type SearchableOption } from "@/components/SearchableSelect";
import { db } from "@/lib/db";
import {
  producedInSector,
  type CatalogOperation,
  type MetaProducaoDia,
  type Operation,
  type Product,
  type ProductionEntry,
  type Sector,
} from "@/lib/production";

type Row = {
  key: string;
  id?: string;
  product_id: string;
  data: string;
  quantidade: number;
};

export function MetaProducaoDialog({
  open,
  onOpenChange,
  date,
  sectors,
  products,
  operations,
  catalogOps,
  entries,
  metas,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;
  sectors: Sector[];
  /** produtos disponíveis (apenas os da esteira) */
  products: Product[];
  operations: Operation[];
  catalogOps: CatalogOperation[];
  /** todas as marcações (para calcular o restante do setor) */
  entries: ProductionEntry[];
  /** metas já cadastradas para a data */
  metas: MetaProducaoDia[];
}) {
  const queryClient = useQueryClient();
  const [sectorId, setSectorId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSectorId((s) => s || sectors[0]?.id || "");
    setRemoved([]);
  }, [open, sectors]);

  useEffect(() => {
    if (!open || !sectorId) return;
    setRows(
      metas
        .filter((m) => m.sector_id === sectorId)
        .map((m) => ({
          key: m.id,
          id: m.id,
          product_id: m.product_id,
          data: m.data,
          quantidade: m.quantidade,
        })),
    );
    setRemoved([]);
  }, [open, sectorId, metas]);

  const productName = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const productOptions = useMemo<SearchableOption[]>(
    () =>
      products.map((p) => ({
        value: p.id,
        label: `OP Interna ${p.op_interna ?? "não definida"} · ${p.name}`,
        searchText: `${p.op_interna ?? ""} ${p.op_number} ${p.name}`,
        node: (
          <span>
            <strong>OP Interna {p.op_interna ?? "não definida"}</strong>{" "}
            <span className="text-muted-foreground">· {p.name}</span>
          </span>
        ),
      })),
    [products],
  );

  const remainingFor = (productId: string) => {
    const p = productName.get(productId);
    if (!p) return 0;
    const done = producedInSector(productId, sectorId, operations, catalogOps, entries);
    return Math.max(0, (p.total_quantity ?? 0) - done);
  };

  const addProduct = (productId: string) => {
    if (!productId) return;
    if (rows.some((r) => r.product_id === productId)) {
      toast.error("Produto já adicionado nesta meta.");
      return;
    }
    setRows((r) => [
      ...r,
      {
        key: `new-${productId}-${Date.now()}`,
        product_id: productId,
        data: date,
        quantidade: remainingFor(productId),
      },
    ]);
  };

  const patch = (key: string, values: Partial<Row>) =>
    setRows((r) => r.map((x) => (x.key === key ? { ...x, ...values } : x)));

  const remove = (row: Row) => {
    if (row.id) setRemoved((x) => [...x, row.id!]);
    setRows((r) => r.filter((x) => x.key !== row.key));
  };

  const save = async () => {
    if (!sectorId) {
      toast.error("Selecione um setor.");
      return;
    }
    setSaving(true);
    try {
      if (removed.length > 0) {
        const { error } = await db
          .from("meta_producao_setor_dia")
          .delete()
          .in("id", removed);
        if (error) throw new Error(error.message);
      }
      if (rows.length > 0) {
        const { error } = await db.from("meta_producao_setor_dia").upsert(
          rows.map((r) => ({
            ...(r.id ? { id: r.id } : {}),
            sector_id: sectorId,
            data: r.data,
            product_id: r.product_id,
            quantidade: Number(r.quantidade) || 0,
          })),
          { onConflict: "sector_id,data,product_id" },
        );
        if (error) throw new Error(error.message);
      }
      await queryClient.invalidateQueries({ queryKey: ["meta_producao_setor_dia"] });
      toast.success("Meta salva.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a meta.");
    } finally {
      setSaving(false);
    }
  };

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.data, (map.get(r.data) ?? 0) + (Number(r.quantidade) || 0));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Meta de produção (peças)</DialogTitle>
          <DialogDescription>
            Selecione produtos da esteira pela OP Interna e defina a quantidade de peças que deve
            ser concluída no setor em cada dia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Setor</Label>
              <SearchableSelect
                options={sectors.map((s) => ({ value: s.id, label: s.name }))}
                value={sectorId}
                onChange={setSectorId}
                placeholder="Selecione o setor"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Adicionar produto (OP Interna)</Label>
              <SearchableSelect
                searchOnly
                options={productOptions}
                value=""
                onChange={addProduct}
                placeholder="Buscar OP Interna..."
                searchPlaceholder="Digite a OP Interna..."
                disabled={!sectorId}
              />
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum produto adicionado como meta neste setor.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => {
                const p = productName.get(r.product_id);
                return (
                  <div
                    key={r.key}
                    className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3"
                  >
                    <div className="min-w-40 flex-1">
                      <p className="text-sm font-medium">
                        OP Interna {p?.op_interna ?? "não definida"}
                      </p>
                      <p className="text-xs text-muted-foreground">{p?.name ?? "Produto"}</p>
                      <p className="text-xs text-muted-foreground">
                        Restante no setor: {remainingFor(r.product_id)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Dia</Label>
                      <Input
                        type="date"
                        className="w-40"
                        value={r.data}
                        onChange={(e) => patch(r.key, { data: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quantidade</Label>
                      <Input
                        type="number"
                        min={0}
                        className="w-28"
                        value={r.quantidade}
                        onChange={(e) => patch(r.key, { quantidade: Number(e.target.value) })}
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => remove(r)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {byDay.length > 0 ? (
            <div className="rounded-md bg-secondary p-3 text-sm">
              {byDay.map(([d, q]) => (
                <p key={d} className="tabular-nums">
                  {d.split("-").reverse().join("/")}: <strong>{q}</strong> peças
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar meta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
