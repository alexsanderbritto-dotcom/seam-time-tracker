import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { catalogOperationsQuery, sectorsQuery, type CatalogOperation } from "@/lib/production";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/operacoes")({
  head: () => ({
    meta: [
      { title: "Operações por Setor | Controle de Confecção" },
      {
        name: "description",
        content:
          "Cadastre setores e as operações de cada setor com a quantidade por hora esperada.",
      },
      { property: "og:title", content: "Operações por Setor | Controle de Confecção" },
      {
        property: "og:description",
        content: "Setores e operações da confecção com produtividade esperada por hora.",
      },
    ],
  }),
  component: OperacoesSetorPage,
});

function OperacoesSetorPage() {
  const qc = useQueryClient();
  const { data: sectors = [] } = useQuery(sectorsQuery);
  const { data: ops = [] } = useQuery(catalogOperationsQuery);

  const [newSector, setNewSector] = useState("");
  const [editSector, setEditSector] = useState<{ id: string; name: string } | null>(null);
  const [opDialog, setOpDialog] = useState<{
    sectorId: string;
    op: CatalogOperation | null;
  } | null>(null);
  const [opName, setOpName] = useState("");
  const [opRate, setOpRate] = useState("");
  const [opLast, setOpLast] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sectors"] });
    qc.invalidateQueries({ queryKey: ["catalog_operations"] });
  };

  async function addSector() {
    const name = newSector.trim();
    if (!name) { toast.error("Informe o nome do setor."); return; }
    const { error } = await supabase.from("sectors").insert({ name });
    if (error) { toast.error(error.message); return; }
    setNewSector("");
    invalidate();
  }

  async function saveSector() {
    if (!editSector) return;
    const name = editSector.name.trim();
    if (!name) { toast.error("Informe o nome do setor."); return; }
    const { error } = await supabase.from("sectors").update({ name }).eq("id", editSector.id);
    if (error) { toast.error(error.message); return; }
    setEditSector(null);
    invalidate();
  }

  async function removeSector(id: string) {
    const { error } = await supabase.from("sectors").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Setor excluído.");
    invalidate();
  }

  function openOp(sectorId: string, op: CatalogOperation | null) {
    setOpDialog({ sectorId, op });
    setOpName(op?.name ?? "");
    setOpRate(op?.expected_per_hour != null ? String(op.expected_per_hour) : "");
    setOpLast(op?.is_last_operation ?? false);
  }

  async function saveOp() {
    if (!opDialog) return;
    const name = opName.trim();
    if (!name) { toast.error("Informe o nome da operação."); return; }
    const payload = {
      sector_id: opDialog.sectorId,
      name,
      expected_per_hour: opRate ? Number(opRate.replace(",", ".")) : null,
      is_last_operation: opLast,
    };
    const { error } = opDialog.op
      ? await supabase.from("catalog_operations").update(payload).eq("id", opDialog.op.id)
      : await supabase.from("catalog_operations").insert(payload);
    if (error) { toast.error(error.message); return; }
    setOpDialog(null);
    invalidate();
  }

  async function removeOp(id: string) {
    const { error } = await supabase.from("catalog_operations").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    invalidate();
  }

  return (
    <AppLayout
      title="Operações"
      subtitle="Banco central de operações, organizado por setor."
    >
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-56 space-y-1.5">
          <Label>Novo setor</Label>
          <Input
            placeholder="Costura"
            value={newSector}
            onChange={(e) => setNewSector(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSector()}
          />
        </div>
        <Button onClick={addSector}>
          <Plus className="mr-2 h-4 w-4" /> Adicionar setor
        </Button>
      </div>

      {sectors.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum setor cadastrado ainda.</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-3">
          {sectors.map((s) => {
            const list = ops.filter((o) => o.sector_id === s.id);
            return (
              <Card key={s.id} className="w-72 shrink-0">
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditSector({ id: s.id, name: s.name })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeSector(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma operação.</p>
                  ) : (
                    list.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                            {o.name}
                            {o.is_last_operation ? (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                <Flag className="h-3 w-3" /> Última
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {o.expected_per_hour != null
                              ? `${o.expected_per_hour} pçs/hora`
                              : "sem meta por hora"}
                          </p>
                        </div>
                        <div className="flex shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => openOp(s.id, o)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => removeOp(o.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => openOp(s.id, null)}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Nova operação
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editSector} onOpenChange={(o) => !o && setEditSector(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar setor</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={editSector?.name ?? ""}
              onChange={(e) =>
                setEditSector((p) => (p ? { ...p, name: e.target.value } : p))
              }
            />
          </div>
          <DialogFooter>
            <Button onClick={saveSector}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!opDialog} onOpenChange={(o) => !o && setOpDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{opDialog?.op ? "Editar operação" : "Nova operação"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Nome da operação</Label>
              <Input
                value={opName}
                onChange={(e) => setOpName(e.target.value)}
                placeholder="Barra de 2cm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade por hora esperada</Label>
              <Input
                inputMode="decimal"
                value={opRate}
                onChange={(e) => setOpRate(e.target.value)}
                placeholder="60"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveOp}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
