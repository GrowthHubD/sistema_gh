"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GitBranch,
  FileText,
  DollarSign,
  MessageSquare,
  Users,
  Bot,
  Kanban,
  BookOpen,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SystemModule, UserRole } from "@/types";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  allowedModules: SystemModule[];
  userName: string;
  userRole: UserRole;
}

const NAV_ITEMS: {
  title: string;
  href: string;
  icon: React.ElementType;
  module: SystemModule;
}[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard, module: "dashboard" },
  { title: "Pipeline", href: "/pipeline", icon: GitBranch, module: "pipeline" },
  { title: "Contratos", href: "/contratos", icon: FileText, module: "contracts" },
  { title: "Financeiro", href: "/financeiro", icon: DollarSign, module: "financial" },
  { title: "CRM", href: "/crm", icon: MessageSquare, module: "crm" },
  { title: "Clientes", href: "/clientes", icon: Users, module: "clients" },
  { title: "Agente SDR", href: "/sdr", icon: Bot, module: "sdr" },
  { title: "Kanban", href: "/kanban", icon: Kanban, module: "kanban" },
  { title: "Blog", href: "/blog", icon: BookOpen, module: "blog" },
  { title: "Admin", href: "/admin/usuarios", icon: Settings, module: "admin" },
];

const ROLE_LABELS: Record<UserRole, string> = {
  partner: "Sócio",
  manager: "Gerente",
  operational: "Operacional",
};

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
  allowedModules,
  userName,
  userRole,
}: SidebarProps) {
  const pathname = usePathname();

  const filteredItems = NAV_ITEMS.filter((item) =>
    allowedModules.includes(item.module)
  );

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-[var(--topbar-height)] border-b border-border shrink-0">
        {!collapsed && (
          <Image
            src="/images/logo-full.png"
            alt="Growth Hub"
            width={140}
            height={30}
            className="brightness-0 invert"
          />
        )}
        {collapsed && (
          <Image
            src="/images/logo-icon.png"
            alt="Growth Hub"
            width={28}
            height={28}
            className="mx-auto"
          />
        )}

        {/* Mobile close */}
        <button
          onClick={onMobileClose}
          className="lg:hidden text-muted hover:text-foreground cursor-pointer transition-colors"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer group",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted hover:text-foreground hover:bg-surface-2"
              )}
              title={collapsed ? item.title : undefined}
            >
              <Icon
                className={cn(
                  "w-5 h-5 shrink-0 transition-colors duration-200",
                  active
                    ? "text-primary"
                    : "text-muted group-hover:text-foreground"
                )}
              />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer: user info + collapse toggle */}
      <div className="border-t border-border px-3 py-3 shrink-0">
        {!collapsed && (
          <div className="mb-3 px-1">
            <p className="text-sm font-medium text-foreground truncate">
              {userName}
            </p>
            <p className="text-label mt-0.5">{ROLE_LABELS[userRole]}</p>
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex items-center gap-2 w-full px-2 py-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors duration-200 cursor-pointer text-sm"
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          {collapsed ? (
            <ChevronsRight className="w-4 h-4 mx-auto" />
          ) : (
            <>
              <ChevronsLeft className="w-4 h-4" />
              <span>Recolher</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex lg:flex-col fixed left-0 top-0 bottom-0 z-30",
          "bg-surface/80 backdrop-blur-xl border-r border-border transition-all duration-200"
        )}
        style={{
          width: collapsed
            ? "var(--sidebar-collapsed)"
            : "var(--sidebar-width)",
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed left-0 top-0 bottom-0 z-50",
          "bg-surface/90 backdrop-blur-xl border-r border-border w-[280px]",
          "transition-transform duration-200",
          mobileOpen
            ? "translate-x-0 animate-slide-in-left"
            : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
