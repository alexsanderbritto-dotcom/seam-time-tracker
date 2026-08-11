import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import {
  createMarcador,
  deleteMarcador,
  listMarcadores,
  updateMarcadorSenha,
} from "@/lib/marcadores.functions";
import { KeyRound, Trash2, UserPlus } from "lucide-react";

export const Route = createFileRoute("/marcadores")({
  head: () => ({
    meta: [
      { title: "Marcadores | Controle de Confecção" },
      {
        name: "description",
        content:
          "Cadastre os marcadores que acessam a tela de marcação de produção, com senha protegida por criptografia.",
      },
      { property: "og:title", content: "Marcadores | Controle de Confecção" },
      {
        property: "og:description",
        content: "Cadastro de marcadores com acesso à tela de marcação de produção.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarcadoresPage,
});

function MarcadoresPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMarcadores);
  const create = useServerFn(createMarcador);
  const updateSenha = useServerFn(updateMarcadorSenha);
  const remove = useServerFn(deleteMarcador);

  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [resetId, setResetId] = useState<string | null>(null);
  const [novaSenha, setNovaSenha] = useState("");

  const { data: marcadores = [], isLoading } = useQuery({
    queryKey: ["marcadores"],
    queryFn: () => list(),
  });

  const createMut = useMutation({
    mutationFn: () => create({ data: { nome, senha } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Marcador cadastrado.");
      setNome("");
      setSenha("");
      qc.invalidateQueries({ queryKey: ["marcadores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMut = useMutation({
    mutationFn: (id: string) => updateSenha({ data: { id, senha: novaSenha } }),
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

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Marcador removido.");
      qc.invalidateQueries({ queryKey: ["marcadores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppLayout
      title="Marcadores"
      subtitle="Usuários autorizados a preencher a tela de marcação de produção."
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
                  <TableHead className="w-64 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="py-10 text-center text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : marcadores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="py-10 text-center text-muted-foreground">
                      Nenhum marcador cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  marcadores.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.nome}</TableCell>
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
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteMut.mutate(m.id)}
                              aria-label={`Remover ${m.nome}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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
