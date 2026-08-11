import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ClipboardList,
  LayoutDashboard,
  Clock,
  Users,
  Package,
  Factory,
  Scissors,
  Receipt,
  UserCheck,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarcadorLogin } from "@/components/MarcadorLogin";
import { clearSession, useMarcadorSession } from "@/lib/marcador-session";

const nav = [
  { to: "/marcacao-producao", label: "Marcação de Produção", icon: ClipboardList, adminOnly: false },
  { to: "/produtos", label: "Produtos", icon: Package, adminOnly: true },
  { to: "/esteira", label: "Esteira de Produção", icon: Factory, adminOnly: false },
  { to: "/operacoes", label: "Operações", icon: Scissors, adminOnly: true },
  { to: "/colaboradores", label: "Colaboradores", icon: Users, adminOnly: true },
  { to: "/marcadores", label: "Marcadores", icon: UserCheck, adminOnly: true },
  { to: "/horarios", label: "Horários", icon: Clock, adminOnly: true },
  { to: "/faturamento", label: "Faturamento", icon: Receipt, adminOnly: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
] as const;

export function AppLayout({
  title,
  subtitle,
  requireAdmin = true,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  requireAdmin?: boolean;
  children: ReactNode;
}) {
  const { session, ready, isAdmin } = useMarcadorSession();

  if (!ready) return null;
  if (!session) return <MarcadorLogin />;

  const items = nav.filter((item) => isAdmin || !item.adminOnly);
  const blocked = requireAdmin && !isAdmin;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-5">
          <Factory className="h-5 w-5 text-sidebar-primary" />
          <span className="text-sm font-semibold tracking-tight">Controle de Produção</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{
                className: "bg-sidebar-accent text-sidebar-accent-foreground",
              }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border px-5 py-4">
          <p className="text-xs text-sidebar-foreground/70">
            {session.nome} · {isAdmin ? "Admin" : "Usuário"}
          </p>
          <button
            type="button"
            onClick={clearSession}
            className="mt-2 flex items-center gap-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair / trocar marcador
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border bg-card px-5 py-4">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{ className: "bg-secondary text-secondary-foreground" }}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 p-5">
          {blocked ? (
            <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 text-center">
              <h2 className="text-base font-semibold">Acesso restrito</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Seu cargo é "Usuário" e permite apenas a marcação de produção.
              </p>
              <Button asChild className="mt-4">
                <Link to="/marcacao-producao">Ir para Marcação de Produção</Link>
              </Button>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
