import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/components/DashboardView";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard de Produção | Controle de Confecção" },
      {
        name: "description",
        content:
          "Acompanhe a produção do dia por colaborador, setor, operação e avanço das OPs internas.",
      },
      { property: "og:title", content: "Dashboard de Produção | Controle de Confecção" },
      {
        property: "og:description",
        content: "Produção por hora, produtividade por colaborador e avanço por OP interna.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <DashboardView />,
});
