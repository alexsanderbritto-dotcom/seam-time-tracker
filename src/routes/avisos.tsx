import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { db } from "@/lib/db";
import { readSession, useMarcadorSession } from "@/lib/marcador-session";
import { broadcastNovoAviso } from "@/lib/avisos-notify";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, MessageSquareWarning } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/avisos")({
  head: () => ({
    meta: [
      { title: "Avisos da Produção | Controle de Confecção" },
      {
        name: "description",
        content:
          "Registre avisos e problemas do chão de fábrica e acompanhe o histórico de resoluções.",
      },
      { property: "og:title", content: "Avisos da Produção | Controle de Confecção" },
      {
        property: "og:description",
        content: "Avisos abertos e histórico de avisos resolvidos da produção.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AvisosPage,
});

type Aviso = {
  id: string;
  texto: string;
  criado_por_nome: string;
  resolvido: boolean;
  resolvido_por_nome: string | null;
  resolvido_em: string | null;
  created_at: string;
};

const avisosQuery = {
  queryKey: ["avisos"],
  queryFn: async (): Promise<Aviso[]> => {
    const { data, error } = await db
      .from("avisos")
      .select("id,texto,criado_por_nome,resolvido,resolvido_por_nome,resolvido_em,created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Aviso[];
  },
};

const dt = (value: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

function AvisosPage() {
  const { session, isAdmin } = useMarcadorSession();
  const qc = useQueryClient();
  const { data: avisos = [], isLoading } = useQuery(avisosQuery);
  const [texto, setTexto] = useState("");
  const [histOpen, setHistOpen] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["avisos"] });

  const create = useMutation({
    mutationFn: async () => {
      const s = readSession();
      const conteudo = texto.trim();
      const { error } = await db.from("avisos").insert({
        texto: conteudo,
        criado_por: s?.id ?? null,
        criado_por_nome: s?.nome ?? "Marcador",
      });
      if (error) throw new Error(error.message);
      // Avisa em tempo real todos os outros marcadores conectados.
      broadcastNovoAviso({
        id: crypto.randomUUID(),
        texto: conteudo,
        autor: s?.nome ?? "Marcador",
        autorId: s?.id ?? null,
      });
    },
    onSuccess: () => {
      setTexto("");
      toast.success("Aviso registrado.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const s = readSession();
      const { error } = await db
        .from("avisos")
        .update({
          resolvido: true,
          resolvido_por: s?.id ?? null,
          resolvido_por_nome: s?.nome ?? "Marcador",
          resolvido_em: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Aviso marcado como resolvido.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("avisos").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Aviso excluído.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const abertos = avisos.filter((a) => !a.resolvido);
  const resolvidos = avisos.filter((a) => a.resolvido);

  return (
    <AppLayout
      title="Avisos"
      subtitle="Comunicação rápida entre chão de fábrica e administração."
      requireAdmin={false}
    >
      <div className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Novo aviso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Descreva o problema ou aviso..."
              className="min-h-24 text-base"
            />
            <Button
              className="h-11 w-full sm:w-auto"
              disabled={texto.trim().length < 3 || create.isPending}
              onClick={() => create.mutate()}
            >
              Registrar aviso
            </Button>
            <p className="text-xs text-muted-foreground">
              Registrado como {session?.nome ?? "—"}.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquareWarning className="h-4 w-4 text-amber-500" />
              Avisos em aberto ({abertos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : abertos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum aviso em aberto.</p>
            ) : (
              abertos.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-border bg-card p-3 sm:p-4"
                >
                  <p className="whitespace-pre-wrap break-words text-sm">{a.texto}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {a.criado_por_nome} · {dt(a.created_at)}
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:flex">
                    <Button
                      size="sm"
                      className="h-11 sm:h-9"
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate(a.id)}
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      Marcar como resolvido
                    </Button>
                    {isAdmin ? (
                      <ConfirmDelete
                        title="Excluir aviso"
                        description="Esta ação não pode ser desfeita."
                        onConfirm={() => remove.mutate(a.id)}
                      >
                        <Button variant="outline" size="sm" className="h-11 w-full sm:h-9 sm:w-auto">
                          Excluir
                        </Button>
                      </ConfirmDelete>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Collapsible open={histOpen} onOpenChange={setHistOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
              >
                <span className="text-base font-semibold">
                  Histórico de resolvidos ({resolvidos.length})
                </span>
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 transition-transform", histOpen && "rotate-180")}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-3 pt-0">
                {resolvidos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum aviso resolvido ainda.</p>
                ) : (
                  resolvidos.map((a) => (
                    <div key={a.id} className="rounded-lg border border-border bg-muted/40 p-3">
                      <p className="whitespace-pre-wrap break-words text-sm">{a.texto}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Criado por {a.criado_por_nome} · {dt(a.created_at)}
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        Resolvido por {a.resolvido_por_nome ?? "—"} · {dt(a.resolvido_em)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </AppLayout>
  );
}
