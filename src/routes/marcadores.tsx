import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  createMarcador,
  deleteMarcador,
  listMarcadores,
  updateMarcadorCargo,
  updateMarcadorSenha,
} from "@/lib/marcadores.functions";
import { useMarcadorSession, type MarcadorCargo } from "@/lib/marcador-session";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/marcadores")({
  head: () => ({
    meta: [
      { title: "Marcadores | Controle de Confecção" },
      {
        name: "description",
        content:
          "Cadastre os marcadores que acessam a tela de marcação de produção, com cargo de usuário ou admin.",
      },
      { property: "og:title", content: "Marcadores | Controle de Confecção" },
      {
        property: "og:description",
        content: "Cadastro de marcadores com cargo e acesso à tela de marcação de produção.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarcadoresPage,
});

function MarcadoresPage() {
  const { session, isAdmin } = useMarcadorSession();
  const token = session?.token ?? "";
  const qc = useQueryClient();
  const list = useServerFn(listMarcadores);
  const create = useServerFn(createMarcador);
  const updateSenha = useServerFn(updateMarcadorSenha);
  const updateCargo = useServerFn(updateMarcadorCargo);
  const remove = useServerFn(deleteMarcador);

  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [cargo, setCargo] = useState<MarcadorCargo>("usuario");
  const [resetId, setResetId] = useState<string | null>(null);
  const [novaSenha, setNovaSenha] = useState("");

  const { data: marcadores = [], isLoading } = useQuery({
    queryKey: ["marcadores", token],
    queryFn: () => list({ data: { token } }),
    enabled: isAdmin && token.length > 0,
  });

  const createMut = useMutation({
    mutationFn: () => create({ data: { token, nome, senha, cargo } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Marcador cadastrado.");
      setNome("");
      setSenha("");
      setCargo("usuario");
      qc.invalidateQueries({ queryKey: ["marcadores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMut = useMutation({
    mutationFn: (id: string) => updateSenha({ data: { token, id, senha: novaSenha } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Senha atualizada.");
      setResetId(null);
      setNovaSenha("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cargoMut = useMutation({
    mutationFn: (v: { id: string; cargo: MarcadorCargo }) =>
      updateCargo({ data: { token, id: v.id, cargo: v.cargo } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Cargo atualizado.");
      qc.invalidateQueries({ queryKey: ["marcadores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { token, id } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Marcador removido.");
      qc.invalidateQueries({ queryKey: ["marcadores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppLayout
      title="Marcadores"
      subtitle="Usuários autorizados a acessar o sistema, com cargo de usuário ou admin."
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Novo marcador</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                createMut.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="m-nome">Nome do marcador</Label>
                <Input
                  id="m-nome"
                  value={nome}
                  maxLength={60}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-cargo">Cargo</Label>
                <Select value={cargo} onValueChange={(v) => setCargo(v as MarcadorCargo)}>
                  <SelectTrigger id="m-cargo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usuario">Usuário (só marcação de produção)</SelectItem>
                    <SelectItem value="admin">Admin (acesso total)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-senha">Senha de acesso</Label>
                <Input
                  id="m-senha"
                  type="password"
                  value={senha}
                  maxLength={100}
                  autoComplete="new-password"
                  onChange={(e) => setSenha(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  A senha é gravada apenas de forma criptografada e nunca é exibida novamente.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={createMut.isPending}>
                <UserPlus className="mr-2 h-4 w-4" />
                {createMut.isPending ? "Salvando..." : "Cadastrar marcador"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Marcadores cadastrados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-48">Cargo</TableHead>
                  <TableHead className="w-64 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : marcadores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                      Nenhum marcador cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  marcadores.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        {m.nome}
                        {m.id === session?.id ? (
                          <Badge variant="secondary" className="ml-2">
                            você
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={m.cargo === "admin" ? "admin" : "usuario"}
                          onValueChange={(v) =>
                            cargoMut.mutate({ id: m.id, cargo: v as MarcadorCargo })
                          }
                        >
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="usuario">Usuário</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {resetId === m.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <Input
                              type="password"
                              className="h-8 w-36"
                              placeholder="Nova senha"
                              value={novaSenha}
                              onChange={(e) => setNovaSenha(e.target.value)}
                            />
                            <Button
                              size="sm"
                              onClick={() => resetMut.mutate(m.id)}
                              disabled={resetMut.isPending}
                            >
                              Salvar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setResetId(null);
                                setNovaSenha("");
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setResetId(m.id);
                                setNovaSenha("");
                              }}
                            >
                              <KeyRound className="mr-2 h-4 w-4" />
                              Trocar senha
                            </Button>
                            <ConfirmDelete
                              title="Remover marcador?"
                              description={`O acesso de ${m.nome} será removido permanentemente.`}
                              confirmLabel="Remover"
                              onConfirm={() => deleteMut.mutate(m.id)}
                            >
                              <Button size="icon" variant="ghost" aria-label={`Remover ${m.nome}`}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </ConfirmDelete>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
