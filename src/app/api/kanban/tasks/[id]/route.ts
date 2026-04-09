import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { kanbanTask } from "@/lib/db/schema/kanban";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/types";

const updateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  columnId: z.string().uuid().optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  isCompleted: z.boolean().optional(),
  order: z.number().int().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canEdit = await checkPermission(session.user.id, userRole, "kanban", "edit");
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (d.title !== undefined) updates.title = d.title;
    if (d.description !== undefined) updates.description = d.description;
    if (d.columnId !== undefined) updates.columnId = d.columnId;
    if (d.assignedTo !== undefined) updates.assignedTo = d.assignedTo;
    if (d.dueDate !== undefined) updates.dueDate = d.dueDate;
    if (d.priority !== undefined) updates.priority = d.priority;
    if (d.order !== undefined) updates.order = d.order;
    if (d.isCompleted !== undefined) {
      updates.isCompleted = d.isCompleted;
      updates.completedAt = d.isCompleted ? new Date() : null;
    }

    const [updated] = await db
      .update(kanbanTask)
      .set(updates)
      .where(eq(kanbanTask.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
    return NextResponse.json({ task: updated });
  } catch {
    console.error("[KANBAN] PATCH task failed:", { operation: "update" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canDelete = await checkPermission(session.user.id, userRole, "kanban", "delete");
    if (!canDelete) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const [deleted] = await db
      .delete(kanbanTask)
      .where(eq(kanbanTask.id, id))
      .returning({ id: kanbanTask.id });

    if (!deleted) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    console.error("[KANBAN] DELETE task failed:", { operation: "delete" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
