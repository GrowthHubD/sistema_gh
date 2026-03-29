"use client";

import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import {
  Bell,
  LogOut,
  Menu,
} from "lucide-react";
import { Breadcrumbs } from "./breadcrumbs";

interface TopbarProps {
  userName: string;
  userImage: string | null | undefined;
  onMenuClick: () => void;
}

export function Topbar({ userName, userImage, onMenuClick }: TopbarProps) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-[var(--sidebar-width)] z-20 h-[var(--topbar-height)] bg-surface/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 lg:px-6 transition-all duration-200">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <button
          onClick={onMenuClick}
          className="lg:hidden text-muted hover:text-foreground transition-colors cursor-pointer"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Breadcrumbs />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button
          onClick={() => router.push("/notificacoes")}
          className="relative p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors duration-200 cursor-pointer"
          aria-label="Notificações"
        >
          <Bell className="w-5 h-5" />
          {/* Badge placeholder — will be dynamic when notifications module is built */}
        </button>

        {/* User avatar + logout */}
        <div className="flex items-center gap-2 ml-1">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userImage}
                alt={userName}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>

          <span className="hidden sm:block text-sm text-foreground font-medium max-w-[120px] truncate">
            {userName}
          </span>

          <button
            onClick={handleSignOut}
            className="p-2 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors duration-200 cursor-pointer"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
