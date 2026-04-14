import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kanbanTask } from "@/lib/db/schema/kanban";
import { user } from "@/lib/db/schema/users";
import { whatsappNumber } from "@/lib/db/schema/crm";
import { messageTemplate } from "@/lib/db/schema/settings";
import { eq, and, lt } from "drizzle-orm";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const PRIORITY_EMOJI: Record<string, string> = {
  urgent: "🔴", high: "🟠", medium: "🟡", low: "🟢",
};

const DEFAULT_DAILY_TEMPLATE =
  "📋 *Tarefas de hoje, {{data}}*\n\nOlá, {{nome}}! Você tem {{qtd}} tarefa(s) para hoje:\n\n{{tarefas}}\n\n_Growth Hub Manager_";

const DEFAULT_DAY_BEFORE_TEMPLATE =
  "⏰ *Lembrete: tarefa(s) vencem amanhã!*\n\nOlá, {{nome}}! Você tem {{qtd}} tarefa(s) vencendo amanhã ({{data}}):\n\n{{tarefas}}\n\n_Growth Hub Manager_";

const DEFAULT_OVERDUE_TEMPLATE =
  "🚨 *Tarefa(s) atrasada(s)!*\n\nOlá, {{nome}}! Você tem {{qtd}} tarefa(s) com prazo vencido:\n\n{{tarefas}}\n\nAtualize ou conclua o quanto antes.\n\n_Growth Hub Manager_";

function applyTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (msg, [key, val]) => msg.replaceAll(`{{${key}}}`, val),
    template
  );
}

type TaskRow = {
  id: string;
  title: string;
  priority: string;
  dueDate?: string | null;
  assignedTo: string;
  assigneeName: string;
  assigneePhone: string | null;
};

function groupByUser(tasks: TaskRow[]) {
  const map = new Map<string, { name: string; phone: string | null; tasks: TaskRow[] }>();
  for (const task of tasks) {
    if (!map.has(task.assignedTo)) {
      map.set(task.assignedTo, { name: task.assigneeName, phone: task.assigneePhone, tasks: [] });
    }
    map.get(task.assignedTo)!.tasks.push(task);
  }
  return map;
}

// Called by Cloudflare Cron Trigger: "0 7 * * *" (daily 7h UTC)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    const tomorrow = format(addDays(now, 1), "yyyy-MM-dd");
    const todayFormatted = format(now, "dd 'de' MMMM", { locale: ptBR });
    const tomorrowFormatted = format(addDays(now, 1), "dd 'de' MMMM", { locale: ptBR });

    const taskSelect = {
      id: kanbanTask.id,
      title: kanbanTask.title,
      priority: kanbanTask.priority,
      dueDate: kanbanTask.dueDate,
      assignedTo: kanbanTask.assignedTo,
      assigneeName: user.name,
      assigneePhone: user.phone,
    };

    // ── 1. Tasks due today ──
    const dueTasks = await db
      .select(taskSelect)
      .from(kanbanTask)
      .innerJoin(user, eq(kanbanTask.assignedTo, user.id))
      .where(and(eq(kanbanTask.dueDate, today), eq(kanbanTask.isCompleted, false)));

    // ── 2. Tasks due tomorrow (day-before alert) ──
    const tomorrowTasks = await db
      .select(taskSelect)
      .from(kanbanTask)
      .innerJoin(user, eq(kanbanTask.assignedTo, user.id))
      .where(and(eq(kanbanTask.dueDate, tomorrow), eq(kanbanTask.isCompleted, false)));

    // ── 3. Overdue tasks (past due, not completed) ──
    const overdueTasks = await db
      .select(taskSelect)
      .from(kanbanTask)
      .innerJoin(user, eq(kanbanTask.assignedTo, user.id))
      .where(and(lt(kanbanTask.dueDate, today), eq(kanbanTask.isCompleted, false)));

    const baseUrl = process.env.UAZAPI_BASE_URL;
    const groupJid = process.env.REMINDER_GROUP_JID ?? "";

    const [wNum] = await db
      .select()
      .from(whatsappNumber)
      .where(eq(whatsappNumber.isActive, true))
      .limit(1);

    // ── Fetch templates ──
    let dailyTemplate = DEFAULT_DAILY_TEMPLATE;
    let dayBeforeTemplate = DEFAULT_DAY_BEFORE_TEMPLATE;
    let overdueTemplate = DEFAULT_OVERDUE_TEMPLATE;
    try {
      const [daily, before, overdue] = await Promise.all([
        db.select({ body: messageTemplate.body }).from(messageTemplate).where(eq(messageTemplate.id, "daily_reminder")).limit(1),
        db.select({ body: messageTemplate.body }).from(messageTemplate).where(eq(messageTemplate.id, "before_reminder")).limit(1),
        db.select({ body: messageTemplate.body }).from(messageTemplate).where(eq(messageTemplate.id, "overdue_alert")).limit(1),
      ]);
      if (daily[0]) dailyTemplate = daily[0].body;
      if (before[0]) dayBeforeTemplate = before[0].body;
      if (overdue[0]) overdueTemplate = overdue[0].body;
    } catch {
      // Table may not exist yet — use defaults
    }

    // ── Helper: send alerts to all users in a group ──
    async function sendAlerts(
      byUser: ReturnType<typeof groupByUser>,
      templateBody: string,
      dateLabel: string
    ): Promise<number> {
      if (!baseUrl || !wNum) return 0;
      let count = 0;

      for (const [, data] of byUser) {
        if (!data.phone) continue;

        const taskLines = data.tasks
          .map((t) => `${PRIORITY_EMOJI[t.priority] ?? "•"} ${t.title}`)
          .join("\n");

        const message = applyTemplate(templateBody, {
          nome: data.name.split(" ")[0],
          data: dateLabel,
          qtd: String(data.tasks.length),
          tarefas: taskLines,
        });

        if (groupJid) {
          await fetch(`${baseUrl}/send/text`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "token": wNum.uazapiToken },
            body: JSON.stringify({
              number: groupJid,
              text: `@${data.phone}\n${message}`,
              isGroup: true,
              mentionedJid: [`${data.phone}@s.whatsapp.net`],
            }),
          }).catch(() => null);
        } else {
          await fetch(`${baseUrl}/send/text`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "token": wNum.uazapiToken },
            body: JSON.stringify({ number: data.phone, text: message, isGroup: false }),
          }).catch(() => null);
        }

        count++;
      }
      return count;
    }

    const [sentToday, sentTomorrow, sentOverdue] = await Promise.all([
      sendAlerts(groupByUser(dueTasks), dailyTemplate, todayFormatted),
      sendAlerts(groupByUser(tomorrowTasks), dayBeforeTemplate, tomorrowFormatted),
      sendAlerts(groupByUser(overdueTasks), overdueTemplate, ""),
    ]);

    // Mark today's tasks as whatsappSent
    for (const task of dueTasks) {
      await db.update(kanbanTask).set({ whatsappSent: true }).where(eq(kanbanTask.id, task.id));
    }

    return NextResponse.json({
      sentToday,
      sentTomorrow,
      sentOverdue,
      tasksToday: dueTasks.length,
      tasksTomorrow: tomorrowTasks.length,
      tasksOverdue: overdueTasks.length,
      mode: groupJid ? "group" : "individual",
    });
  } catch {
    console.error("[CRON] kanban-daily failed:", { operation: "daily_dispatch" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
