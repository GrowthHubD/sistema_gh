import type { Metadata } from "next";
import {
  TrendingUp,
  Users,
  FileText,
  DollarSign,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard",
};

// Placeholder data — will be replaced by real DB queries in Step 13
const PLACEHOLDER_KPIS = [
  {
    title: "MRR",
    value: "R$ 0",
    change: "+0%",
    trend: "up" as const,
    icon: DollarSign,
    color: "text-success",
    bgColor: "bg-success/10",
  },
  {
    title: "Clientes Ativos",
    value: "0",
    change: "+0",
    trend: "up" as const,
    icon: Users,
    color: "text-info",
    bgColor: "bg-info/10",
  },
  {
    title: "Contratos Ativos",
    value: "0",
    change: "0 a vencer",
    trend: "neutral" as const,
    icon: FileText,
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    title: "Leads no Pipeline",
    value: "0",
    change: "+0 esta semana",
    trend: "up" as const,
    icon: TrendingUp,
    color: "text-secondary",
    bgColor: "bg-secondary/10",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-h1 text-foreground">Dashboard</h1>
        <p className="text-muted mt-1">
          Visão consolidada das operações da Growth Hub
        </p>
      </div>

      {/* KPI cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLACEHOLDER_KPIS.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.title}
              className="bg-surface rounded-xl border border-border p-5 transition-colors duration-200 hover:bg-surface-2 cursor-pointer animate-card-entrance"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-label">{kpi.title}</p>
                  <p className="text-2xl font-bold text-foreground mt-2">
                    {kpi.value}
                  </p>
                </div>
                <div
                  className={`p-2.5 rounded-lg ${kpi.bgColor}`}
                >
                  <Icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3">
                {kpi.trend === "up" && (
                  <ArrowUpRight className="w-3.5 h-3.5 text-success" />
                )}
                {kpi.trend === "neutral" && (
                  <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                )}
                <span className="text-small text-muted">{kpi.change}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue chart placeholder */}
        <div className="bg-surface rounded-xl border border-border p-6 min-h-[300px] flex items-center justify-center">
          <div className="text-center">
            <TrendingUp className="w-12 h-12 text-muted/30 mx-auto mb-3" />
            <p className="text-muted text-sm">
              Gráfico de Receita vs Despesas
            </p>
            <p className="text-muted/60 text-small mt-1">
              Disponível após configurar o módulo financeiro
            </p>
          </div>
        </div>

        {/* Pipeline funnel placeholder */}
        <div className="bg-surface rounded-xl border border-border p-6 min-h-[300px] flex items-center justify-center">
          <div className="text-center">
            <Users className="w-12 h-12 text-muted/30 mx-auto mb-3" />
            <p className="text-muted text-sm">Funil de Prospecção</p>
            <p className="text-muted/60 text-small mt-1">
              Disponível após configurar o módulo pipeline
            </p>
          </div>
        </div>
      </div>

      {/* Recent notifications placeholder */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h2 className="text-h3 text-foreground mb-4">Alertas Recentes</h2>
        <div className="flex items-center justify-center py-8">
          <p className="text-muted text-sm">
            Nenhuma notificação ainda. Os alertas aparecerão aqui conforme os módulos forem configurados.
          </p>
        </div>
      </div>
    </div>
  );
}
