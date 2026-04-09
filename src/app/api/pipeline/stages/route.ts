import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { pipelineStage } from "@/lib/db/schema/pipeline";
import { sql } from "drizzle-orm";
import type { UserRole } from "@/types";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
  const canEdit = await checkPermission(session.user.id, userRole, "pipeline", "edit");
  if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = await request.json();
  const { name, color } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  // Get next order value
  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max("order"), 0)` })
    .from(pipelineStage);

  const [stage] = await db
    .insert(pipelineStage)
    .values({ name: name.trim(), order: (maxOrder ?? 0) + 1, color: color ?? null })
    .returning();

  return NextResponse.json(stage, { status: 201 });
}
