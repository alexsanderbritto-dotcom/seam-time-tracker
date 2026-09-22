import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { db } from "@/lib/db";
import { useMarcadorSession } from "@/lib/marcador-session";
import {
  markVistos,
  notificarPush,
  pedirPermissaoPush,
  readVistos,
  setSomAtivo,
  somAtivo,
  tocarBipe,
  useNovoAvisoListener,
} from "@/lib/avisos-notify";

type AvisoResumo = {
  id: string;
  texto: string;
  criado_por: string | null;
  criado_por_nome: string;
  created_at: string;
};

const resumo = (texto: string) => (texto.length > 70 ? `${texto.slice(0, 70)}…` : texto);

const hora = (value: string) =>
  new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Sino de notificações de avisos: badge, lista rápida, toast, som e push. */
export function AvisosBell({ variant = "bell" }: { variant?: "bell" | "silent" }) {
  const { session } = useMarcadorSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [vistos, setVistos] = useState<string[]>([]);
  const [som, setSom] = useState(true);

  useEffect(() => {
    const sync = () => {
      setVistos(readVistos(session?.id));
      setSom(somAtivo());
    };
    sync();
    window.addEventListener("avisos-vistos", sync);
    window.addEventListener("avisos-som", sync);
    return () => {
      window.removeEventListener("avisos-vistos", sync);
      window.removeEventListener("avisos-som", sync);
    };
  }, [session?.id]);

  useEffect(() => {
    if (session) pedirPermissaoPush();
  }, [session]);

  const { data: abertos = [] } = useQuery({
    queryKey: ["avisos-notificacoes"],
    enabled: !!session,
    // Rede de segurança caso o dispositivo perca a conexão de tempo real.
    refetchInterval: 60_000,
    queryFn: async (): Promise<AvisoResumo[]> => {
      const { data, error } = await db
        .from("avisos")
        .select<AvisoResumo[]>("id,texto,criado_por,criado_por_nome,created_at")
        .eq("resolvido", false)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const naoVistos = useMemo(
    () => abertos.filter((a) => a.criado_por !== session?.id && !vistos.includes(a.id)),
    [abertos, session?.id, vistos],
  );

  useNovoAvisoListener((evento) => {
    if (!session) return;
    if (evento.autorId && evento.autorId === session.id) return;
    void qc.invalidateQueries({ queryKey: ["avisos-notificacoes"] });
    void qc.invalidateQueries({ queryKey: ["avisos"] });
    const titulo = `Novo aviso: ${evento.autor}`;
    const corpo = resumo(evento.texto);
    if (variant === "silent") {
      toast(`${titulo} — ${corpo}`, { position: "bottom-center", duration: 8000 });
    } else {
      toast(titulo, {
        description: corpo,
        position: "bottom-right",
        duration: 7000,
        action: { label: "Ver", onClick: () => void navigate({ to: "/avisos" }) },
      });
    }
    tocarBipe();
    notificarPush(titulo, corpo);
  });

  if (!session) return null;
  if (variant === "silent") return null;

  const abrirModulo = () => {
    markVistos(
      session.id,
      abertos.map((a) => a.id),
    );
    setOpen(false);
    void navigate({ to: "/avisos" });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next)
          markVistos(
            session.id,
            abertos.map((a) => a.id),
          );
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-10 w-10"
          aria-label={
            naoVistos.length > 0 ? `${naoVistos.length} avisos novos` : "Notificações de avisos"
          }
        >
          <Bell className={naoVistos.length > 0 ? "h-5 w-5 text-amber-500" : "h-5 w-5"} />
          {naoVistos.length > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold leading-none text-destructive-foreground">
              {naoVistos.length > 9 ? "9+" : naoVistos.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Avisos em aberto</span>
          <button
            type="button"
            onClick={() => setSomAtivo(!som)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={som ? "Desativar som" : "Ativar som"}
          >
            {som ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto p-3">
          {abertos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aviso em aberto.</p>
          ) : (
            abertos.slice(0, 10).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={abrirModulo}
                className="w-full rounded-md border border-border p-2 text-left hover:bg-accent"
              >
                <p className="text-sm">{resumo(a.texto)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.criado_por_nome} · {hora(a.created_at)}
                </p>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-border p-3">
          <Button className="w-full" size="sm" onClick={abrirModulo}>
            Abrir módulo de Avisos
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
