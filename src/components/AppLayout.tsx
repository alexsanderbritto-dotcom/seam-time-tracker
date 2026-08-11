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
} from "lucide-react";

const nav = [
  { to: "/marcacao-producao", label: "Marcação de Produção", icon: ClipboardList },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/operacoes", label: "Operações", icon: Scissors },
  { to: "/colaboradores", label: "Colaboradores", icon: Users },
  { to: "/marcadores", label: "Marcadores", icon: UserCheck },
  { to: "/horarios", label: "Horários", icon: Clock },
  { to: "/faturamento", label: "Faturamento", icon: Receipt },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
] as const;


export function AppLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-5">
          <Factory className="h-5 w-5 text-sidebar-primary" />
          <span className="text-sm font-semibold tracking-tight">Controle de Produção</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {nav.map((item) => (
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
        <p className="px-5 pb-4 text-xs text-sidebar-foreground/50">Confecção · chão de fábrica</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border bg-card px-5 py-4">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden">
          {nav.map((item) => (
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

        <main className="flex-1 p-5">{children}</main>
      </div>
    </div>
  );
}
