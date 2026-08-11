import { createFileRoute } from "@tanstack/react-router";
import { MarcacaoProducao } from "@/components/MarcacaoProducao";
import { MarcadorLogin } from "@/components/MarcadorLogin";
import { clearSession, useMarcadorSession } from "@/lib/marcador-session";

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
  const { session, ready } = useMarcadorSession();

  if (!ready) return null;
  if (!session) {
    return (
      <MarcadorLogin description="Informe seu nome e senha para abrir a marcação de produção." />
    );
  }

  return <MarcacaoProducao marcadorNome={session.nome} onLogout={clearSession} />;
}
