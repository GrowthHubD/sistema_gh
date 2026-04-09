"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Loader2 } from "lucide-react";
import type { SystemModule } from "@/types";
import { DEFAULT_PERMISSIONS } from "@/types";
import type { UserRole } from "@/types";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted text-small">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const userRole = (session.user as { role?: string }).role as UserRole || "operational";
  const allowedModules: SystemModule[] =
    DEFAULT_PERMISSIONS[userRole]?.modules ?? [];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        allowedModules={allowedModules}
        userName={session.user.name}
        userRole={userRole}
      />

      {/* Main content */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-all duration-200"
        style={{
          marginLeft: sidebarCollapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)",
        }}
      >
        <Topbar
          userName={session.user.name}
          userImage={session.user.image}
          onMenuClick={() => setMobileSidebarOpen(true)}
        />

        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-[1440px] mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      <style>{`
        @media (max-width: 1023px) {
          div[style*="marginLeft"] {
            margin-left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
