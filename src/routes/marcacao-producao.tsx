import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarcacaoProducao } from "@/components/MarcacaoProducao";
import { loginMarcador } from "@/lib/marcadores.functions";
import { Factory } from "lucide-react";

const STORAGE_KEY = "marcador-sessao";

export const Route = createFileRoute("/marcacao-producao")({
  head: () => ({
    meta: [
      { title: "Marcação de Produção | Controle de Confecção" },
      {
        name: "description",
        content:
          "Acesso do marcador para registrar a produção por colaborador, operação e horário no chão de fábrica.",
      },
      { property: "og:title", content: "Marcação de Produção | Controle de Confecção" },
      {
        property: "og:description",
        content: "Área restrita do marcador para registrar a produção do chão de fábrica.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarcacaoPage,
});

function MarcacaoPage() {
  const [marcador, setMarcador] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMarcador(sessionStorage.getItem(STORAGE_KEY));
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!marcador) {
    return (
      <LoginMarcador
        onSuccess={(nome) => {
          sessionStorage.setItem(STORAGE_KEY, nome);
          setMarcador(nome);
        }}
      />
    );
  }

  return (
    <MarcacaoProducao
      marcadorNome={marcador}
      onLogout={() => {
        sessionStorage.removeItem(STORAGE_KEY);
        setMarcador(null);
      }}
    />
  );
}

function LoginMarcador({ onSuccess }: { onSuccess: (nome: string) => void }) {
  const login = useServerFn(loginMarcador);
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login({ data: { nome, senha } });
      if (res.ok && "marcador" in res) onSuccess(res.marcador.nome);
      else setError("Nome ou senha incorretos.");
    } catch {
      setError("Não foi possível validar o acesso. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-5">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Factory className="h-5 w-5" />
            <span className="text-xs font-medium uppercase tracking-wide">Controle de Produção</span>
          </div>
          <CardTitle className="text-lg">Acesso do marcador</CardTitle>
          <p className="text-sm text-muted-foreground">
            Informe seu nome e senha para abrir a marcação de produção.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                maxLength={60}
                autoComplete="username"
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                value={senha}
                maxLength={100}
                autoComplete="current-password"
                onChange={(e) => setSenha(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Validando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
