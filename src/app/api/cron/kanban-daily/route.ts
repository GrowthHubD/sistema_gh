import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kanbanTask } from "@/lib/db/schema/kanban";
import { user, session as sessionTable } from "@/lib/db/schema/users";
import { whatsappNumber } from "@/lib/db/schema/crm";
import { eq, and, gte, lte } from "drizzle-orm";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Called by Cloudflare Cron Trigger: "0 7 * * *" (daily 7h UTC)
// Also called for contract expiry alerts.
export async function GET(request: NextRequest) {
  // Cloudflare Workers scheduled triggers call GET /__scheduled
  // Protect with internal secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = format(new Date(), "yyyy-MM-dd");

    // Fetch tasks due today, not completed
    const dueTasks = await db
      .select({
        id: kanbanTask.id,
        title: kanbanTask.title,
        priority: kanbanTask.priority,
        assignedTo: kanbanTask.assignedTo,
        assigneeName: user.name,
        assigneePhone: user.phone,
      })
      .from(kanbanTask)
      .innerJoin(user, eq(kanbanTask.assignedTo, user.id))
      .where(
        and(
          eq(kanbanTask.dueDate, today),
          eq(kanbanTask.isCompleted, false)
        )
      );

    if (dueTasks.length === 0) {
      return NextResponse.json({ sent: 0, message: "No tasks due today" });
    }

    // Group by assignee
    const byUser = new Map<string, { name: string; phone: string | null; tasks: typeof dueTasks }>();
    for (const task of dueTasks) {
      if (!byUser.has(task.assignedTo)) {
        byUser.set(task.assignedTo, { name: task.assigneeName, phone: task.assigneePhone, tasks: [] });
      }
      byUser.get(task.assignedTo)!.tasks.push(task);
    }

    const baseUrl = process.env.UAZAPI_BASE_URL;
    const [wNum] = await db
      .select()
      .from(whatsappNumber)
      .where(eq(whatsappNumber.isActive, true))
      .limit(1);

    let sentCount = 0;

    if (baseUrl && wNum) {
      const PRIORITY_EMOJI: Record<string, string> = {
        urgent: "🔴", high: "🟠", medium: "🟡", low: "🟢",
      };

      for (const [, data] of byUser) {
        if (!data.phone) continue;

        const taskLines = data.tasks
          .map((t) => `${PRIORITY_EMOJI[t.priority] ?? "•"} ${t.title}`)
          .join("\n");

        const message =
          `📋 *Tarefas de hoje, ${format(new Date(), "dd 'de' MMMM", { locale: ptBR })}*\n\n` +
          `Olá, ${data.name.split(" ")[0]}! Você tem ${data.tasks.length} tarefa${data.tasks.length > 1 ? "s" : ""} para hoje:\n\n` +
          taskLines +
          `\n\n_Growth Hub Manager_`;

        await fetch(`${baseUrl}/sendText`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "SessionKey": wNum.uazapiSession,
            "Token": wNum.uazapiToken,
          },
          body: JSON.stringify({ phone: data.phone, message }),
        }).catch(() => null);

        sentCount++;
      }
    }

    // Mark tasks as whatsappSent
    for (const task of dueTasks) {
      await db
        .update(kanbanTask)
        .set({ whatsappSent: true })
        .where(eq(kanbanTask.id, task.id));
    }

    return NextResponse.json({ sent: sentCount, tasks: dueTasks.length });
  } catch (error) {
    console.error("[CRON] kanban-daily failed:", { operation: "daily_dispatch" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
