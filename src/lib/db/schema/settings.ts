import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// ============================================
// MESSAGE TEMPLATES
// ============================================
// Editable via /configuracoes (partner only).
// Each row maps to one notification type.
// Supported variable placeholders:
//   daily_reminder  : {{nome}} {{data}} {{qtd}} {{tarefas}}
//   weekly_digest   : {{nome}} {{semana}} {{qtd}} {{tarefas}}
//   contract_alert  : {{qtd}} {{contratos}}

export const messageTemplate = pgTable("message_template", {
  id: text("id").primaryKey(), // 'daily_reminder' | 'weekly_digest' | 'contract_alert'
  label: text("label").notNull(),
  body: text("body").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
});
