import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createMarcador, hasMarcadores, loginMarcador } from "@/lib/marcadores.functions";
import { writeSession } from "@/lib/marcador-session";
import { Factory } from "lucide-react";

export function MarcadorLogin({
  description = "Informe seu nome e senha para acessar o sistema.",
  onSuccess,
}: {
  description?: string;
  onSuccess?: (() => void) | undefined;
}) {
  const login = useServerFn(loginMarcador);
  const bootstrap = useServerFn(createMarcador);
  const checkEmpty = useServerFn(hasMarcadores);
  const { data: state } = useQuery({ queryKey: ["marcadores-empty"], queryFn: () => checkEmpty() });
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const first = state?.empty === true;


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (first) {
        const created = await bootstrap({
          data: { token: "", nome, senha, cargo: "admin" },
        });
        if (!created.ok) {
          setError(created.error);
          return;
        }
      }
      const res = await login({ data: { nome, senha } });
      if (res.ok && "marcador" in res) {
        writeSession(res.marcador);
        onSuccess?.();
      } else {
        setError("Nome ou senha incorretos.");
      }
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
          <CardTitle className="text-lg">
            {first ? "Criar primeiro administrador" : "Acesso do marcador"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {first
              ? "Nenhum marcador cadastrado ainda. Defina o nome e a senha do primeiro admin."
              : description}
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
