import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { user, modulePermission } from "@/lib/db/schema/users";
import { eq, asc } from "drizzle-orm";
import type { UserRole } from "@/types";

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  role: z.enum(["partner", "manager", "operational"]).optional(),
  jobTitle: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canView = await checkPermission(session.user.id, userRole, "admin", "view");
    if (!canView) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const users = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        jobTitle: user.jobTitle,
        phone: user.phone,
        isActive: user.isActive,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(asc(user.name));

    const permissions = await db.select().from(modulePermission);

    return NextResponse.json({ users, permissions });
  } catch {
    console.error("[ADMIN] GET users failed");
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
