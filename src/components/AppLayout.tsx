import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
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
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
  { to: "/gargalo", label: "Gargalo na Produção", icon: AlertTriangle, adminOnly: true },
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
  const [menuOpen, setMenuOpen] = useState(false);

  if (!ready) return null;
  if (!session) return <MarcadorLogin />;

  const items = nav.filter((item) => isAdmin || !item.adminOnly);
  const blocked = requireAdmin && !isAdmin;

  const navList = (onNavigate?: () => void) => (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          activeProps={{
            className: "bg-sidebar-accent text-sidebar-accent-foreground",
          }}
          className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {item.label}
        </Link>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-sidebar-border px-5 py-4">
      <p className="text-xs text-sidebar-foreground/70">
        {session.nome} · {isAdmin ? "Admin" : "Usuário"}
      </p>
      <button
        type="button"
        onClick={clearSession}
        className="mt-2 flex items-center gap-2 py-1.5 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sair / trocar marcador
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-5">
          <Factory className="h-5 w-5 text-sidebar-primary" />
          <span className="text-sm font-semibold tracking-tight">Controle de Produção</span>
        </div>
        {navList()}
        {footer}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-border bg-card px-4 py-3 md:flex md:px-5 md:py-4">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 md:hidden" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-[17rem] flex-col bg-sidebar p-0 text-sidebar-foreground"
            >
              <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-5">
                <Factory className="h-5 w-5 text-sidebar-primary" />
                <span className="text-sm font-semibold tracking-tight">Controle de Produção</span>
              </div>
              {navList(() => setMenuOpen(false))}
              {footer}
            </SheetContent>
          </Sheet>

          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground md:text-lg">
              {title}
            </h1>
            {subtitle ? (
              <p className="hidden text-sm text-muted-foreground sm:block">{subtitle}</p>
            ) : null}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-5">
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
