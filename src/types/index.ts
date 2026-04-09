// ============================================
// Global Types — Growth Hub Manager AMS
// ============================================

export type UserRole = "partner" | "manager" | "operational";

export type JobTitle =
  | "gestor_trafego"
  | "gestor_automacao"
  | "social_media"
  | "designer"
  | "copywriter"
  | "analista"
  | "diretor";

export type SystemModule =
  | "dashboard"
  | "pipeline"
  | "contracts"
  | "financial"
  | "crm"
  | "clients"
  | "sdr"
  | "kanban"
  | "blog"
  | "admin";

export type PermissionAction = "view" | "edit" | "delete";

export type LeadSource = "sdr_bot" | "indicacao" | "inbound" | "outbound";

export type ConversationClassification =
  | "hot"
  | "warm"
  | "cold"
  | "active_client"
  | "new";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TransactionType = "income" | "expense";

export type TransactionCategory =
  | "infraestrutura"
  | "interno"
  | "educacao"
  | "cliente"
  | "servico"
  | "outro";

export type TransactionStatus = "paid" | "pending" | "overdue";

export type ContractStatus = "active" | "expiring" | "inactive";

export type NotificationType =
  | "contract_expiring"
  | "task_due"
  | "new_lead"
  | "payment_overdue"
  | "system";

export type BlogPostType = "list" | "article" | "guide" | "study";

/**
 * Sidebar navigation item definition
 */
export interface NavItem {
  title: string;
  href: string;
  icon: string;
  module: SystemModule;
  badge?: number;
}

/**
 * Default module permissions by role
 */
export const DEFAULT_PERMISSIONS: Record<
  UserRole,
  { modules: SystemModule[]; canEdit: boolean; canDelete: boolean }
> = {
  partner: {
    modules: [
      "dashboard",
      "pipeline",
      "contracts",
      "financial",
      "crm",
      "clients",
      "sdr",
      "kanban",
      "blog",
      "admin",
    ],
    canEdit: true,
    canDelete: true,
  },
  manager: {
    modules: [
      "dashboard",
      "pipeline",
      "contracts",
      "crm",
      "clients",
      "kanban",
      "blog",
    ],
    canEdit: true,
    canDelete: false,
  },
  operational: {
    modules: ["kanban", "blog"],
    canEdit: true,
    canDelete: false,
  },
};
