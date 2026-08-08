import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { employeesQuery } from "@/lib/production";
import { Plus, Trash2, Search } from "lucide-react";

export const Route = createFileRoute("/colaboradores")({
  head: () => ({
    meta: [
      { title: "Colaboradores | Controle de Confecção" },
      {
        name: "description",
        content: "Cadastre costureiras e auxiliares de produção e controle quem está ativo.",
      },
      { property: "og:title", content: "Colaboradores | Controle de Confecção" },
      {
        property: "og:description",
        content: "Cadastre costureiras e auxiliares e controle quem está ativo.",
      },
    ],
  }),
  component: ColaboradoresPage,
});

function ColaboradoresPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");

  const { data: employees = [] } = useQuery(employeesQuery);
  const filtered = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()),
  );

  async function add() {
    if (!name.trim()) {
      toast.error("Informe o nome do colaborador.");
      return;
    }
    const { error } = await supabase
      .from("employees")
      .insert({ name: name.trim(), role: role.trim() || null });
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setRole("");
    toast.success("Colaborador cadastrado.");
    qc.invalidateQueries({ queryKey: ["employees"] });
  }

  async function toggle(id: string, active: boolean) {
    const { error } = await supabase.from("employees").update({ active }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["employees"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["employees"] });
  }

  return (
    <AppLayout title="Colaboradores" subtitle="Equipe da produção.">
      <Card className="max-w-4xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cadastro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-52 flex-1 space-y-1.5">
              <Label>Nome completo</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder="Maria da Silva"
              />
            </div>
            <div className="w-56 space-y-1.5">
              <Label>Função (opcional)</Label>
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Costureira"
              />
            </div>
            <Button onClick={add}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar
            </Button>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Função</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Nenhum colaborador encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>{e.role ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={e.active}
                          onCheckedChange={(v) => toggle(e.id, v)}
                        />
                        <Badge variant={e.active ? "default" : "outline"}>
                          {e.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => remove(e.id)}>
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
