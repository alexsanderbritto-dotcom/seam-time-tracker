import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/marcacao-producao" });
  },
  head: () => ({
    meta: [
      { title: "Controle de Produção | Confecção de Vestuário" },
      {
        name: "description",
        content:
          "Sistema de controle de produção para confecção: produtos, operações, colaboradores e marcação por horário.",
      },
      { property: "og:title", content: "Controle de Produção | Confecção de Vestuário" },
      {
        property: "og:description",
        content: "Controle de produção da confecção: produtos, operações e marcação por horário.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => null,
});
