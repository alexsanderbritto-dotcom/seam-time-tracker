import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardView } from "@/components/DashboardView";
import { AppLayout } from "@/components/AppLayout";
import { sectorsQuery } from "@/lib/production";
import { useMarcadorSession } from "@/lib/marcador-session";

export const Route = createFileRoute("/dashboard-setor/$sectorId")({
  head: () => ({
    meta: [
      { title: "Dashboard do Setor | Controle de Confecção" },
      {
        name: "description",
        content: "Acompanhamento somente leitura da produção do dia dentro de um setor.",
      },
      { property: "og:title", content: "Dashboard do Setor | Controle de Confecção" },
      {
        property: "og:description",
        content: "Produção por hora, produtividade e avanço das OPs internas do setor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SectorDashboardPage,
});

function SectorDashboardPage() {
  const { sectorId } = Route.useParams();
  const { ready, isAdmin, isSetor, setorId } = useMarcadorSession();
  const { data: sectors = [] } = useQuery(sectorsQuery);
  const sector = sectors.find((s) => s.id === sectorId);

  if (!ready) return null;

  const allowed = isAdmin || (isSetor && setorId === sectorId);
  if (!allowed) {
    return (
      <AppLayout title="Dashboard do setor" requireAdmin={false}>
        <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <h2 className="text-base font-semibold">Acesso restrito</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Você não tem permissão para visualizar o dashboard deste setor.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <DashboardView
      sectorId={sectorId}
      readOnly={!isAdmin}
      requireAdmin={false}
      title={sector ? `Dashboard · ${sector.name}` : "Dashboard do setor"}
      subtitle="Acompanhamento da produção do setor (somente leitura)."
    />
  );
}
