import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  integer,
  boolean,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./users";

// ============================================
// PIPELINE / LEADS
// ============================================

export const pipelineStage = pgTable("pipeline_stage", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  color: text("color"),
  isWon: boolean("is_won").notNull().default(false), // leads moved here auto-become clients
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lead = pgTable(
  "lead",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    companyName: text("company_name"),
    email: text("email"),
    phone: text("phone"),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => pipelineStage.id),
    source: text("source"), // 'sdr_bot', 'indicacao', 'inbound', 'outbound'
    estimatedValue: numeric("estimated_value", { precision: 12, scale: 2 }),
    notes: text("notes"),
    assignedTo: text("assigned_to").references(() => user.id),
    crmConversationId: uuid("crm_conversation_id"), // FK added after crm schema loads
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_lead_stage").on(table.stageId),
  ]
);

export const leadTag = pgTable("lead_tag", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("#6366f1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leadTagAssignment = pgTable(
  "lead_tag_assignment",
  {
    leadId: uuid("lead_id")
      .notNull()
      .references(() => lead.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => leadTag.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.leadId, table.tagId] }),
  ]
);

// ============================================
// Relations
// ============================================

export const pipelineStageRelations = relations(pipelineStage, ({ many }) => ({
  leads: many(lead),
}));

export const leadRelations = relations(lead, ({ one, many }) => ({
  stage: one(pipelineStage, {
    fields: [lead.stageId],
    references: [pipelineStage.id],
  }),
  assignee: one(user, {
    fields: [lead.assignedTo],
    references: [user.id],
  }),
  tags: many(leadTagAssignment),
}));

export const leadTagAssignmentRelations = relations(leadTagAssignment, ({ one }) => ({
  lead: one(lead, {
    fields: [leadTagAssignment.leadId],
    references: [lead.id],
  }),
  tag: one(leadTag, {
    fields: [leadTagAssignment.tagId],
    references: [leadTag.id],
  }),
}));
