export const runtime = "edge";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { pipelineStage, lead, leadTag, leadTagAssignment } from "@/lib/db/schema/pipeline";
import { user } from "@/lib/db/schema/users";
import { eq, asc, desc } from "drizzle-orm";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import type { UserRole } from "@/types";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;

  const [canView, canEdit, canDelete] = await Promise.all([
    checkPermission(session.user.id, userRole, "pipeline", "view"),
    checkPermission(session.user.id, userRole, "pipeline", "edit"),
    checkPermission(session.user.id, userRole, "pipeline", "delete"),
  ]);

  if (!canView) redirect("/");

  const [stages, leads, tags, activeUsers, allTags] = await Promise.all([
    db.select().from(pipelineStage).orderBy(asc(pipelineStage.order)),
    db
      .select({
        id: lead.id,
        name: lead.name,
        companyName: lead.companyName,
        email: lead.email,
        phone: lead.phone,
        stageId: lead.stageId,
        source: lead.source,
        estimatedValue: lead.estimatedValue,
        notes: lead.notes,
        assignedTo: lead.assignedTo,
        assigneeName: user.name,
        updatedAt: lead.updatedAt,
      })
      .from(lead)
      .leftJoin(user, eq(lead.assignedTo, user.id))
      .orderBy(desc(lead.createdAt)),
    db
      .select({
        leadId: leadTagAssignment.leadId,
        tagId: leadTagAssignment.tagId,
        tagName: leadTag.name,
        tagColor: leadTag.color,
      })
      .from(leadTagAssignment)
      .innerJoin(leadTag, eq(leadTagAssignment.tagId, leadTag.id)),
    db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(eq(user.isActive, true)),
    db.select().from(leadTag).orderBy(asc(leadTag.name)),
  ]);

  // Attach tags to leads
  const leadsWithTags = leads.map((l) => ({
    ...l,
    estimatedValue: l.estimatedValue ? String(l.estimatedValue) : null,
    updatedAt: l.updatedAt.toISOString(),
    tags: tags
      .filter((t) => t.leadId === l.id)
      .map((t) => ({ id: t.tagId, name: t.tagName, color: t.tagColor })),
  }));

  return (
    <KanbanBoard
      initialStages={stages}
      initialLeads={leadsWithTags}
      initialTags={allTags}
      users={activeUsers}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  );
}
