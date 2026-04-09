import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kanbanTask } from "@/lib/db/schema/kanban";
import { user } from "@/lib/db/schema/users";
import { whatsappNumber } from "@/lib/db/schema/crm";
import { contract } from "@/lib/db/schema/contracts";
import { eq, and, gte, lte, ne } from "drizzle-orm";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

// Called by Cloudflare Cron: "0 7 * * 1" (Monday 7h UTC)
// Also handles contract expiry alerts (within 30 days)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

  try {
    // ─── 1. Weekly kanban digest ───────────────────────────────────
    const weekTasks = await db
      .select({
        id: kanbanTask.id,
        title: kanbanTask.title,
        dueDate: kanbanTask.dueDate,
        priority: kanbanTask.priority,
        assignedTo: kanbanTask.assignedTo,
        assigneeName: user.name,
        assigneePhone: user.phone,
      })
      .from(kanbanTask)
      .innerJoin(user, eq(kanbanTask.assignedTo, user.id))
      .where(
        and(
          gte(kanbanTask.dueDate, weekStart),
          lte(kanbanTask.dueDate, weekEnd),
          eq(kanbanTask.isCompleted, false)
        )
      );

    const byUser = new Map<string, { name: string; phone: string | null; tasks: typeof weekTasks }>();
    for (const task of weekTasks) {
      if (!byUser.has(task.assignedTo)) {
        byUser.set(task.assignedTo, { name: task.assigneeName, phone: task.assigneePhone, tasks: [] });
      }
      byUser.get(task.assignedTo)!.tasks.push(task);
    }

    // ─── 2. Contract expiry alerts ────────────────────────────────
    const in30days = format(addDays(now, 30), "yyyy-MM-dd");
    const today = format(now, "yyyy-MM-dd");

    const expiringContracts = await db
      .select({
        id: contract.id,
        companyName: contract.companyName,
        endDate: contract.endDate,
        monthlyValue: contract.monthlyValue,
      })
      .from(contract)
      .where(
        and(
          ne(contract.status, "inactive"),
          gte(contract.endDate!, today),
          lte(contract.endDate!, in30days)
        )
      );

    // Update expiring status
    for (const c of expiringContracts) {
      await db
        .update(contract)
        .set({ status: "expiring" })
        .where(eq(contract.id, c.id));
    }

    const baseUrl = process.env.UAZAPI_BASE_URL;
    const [wNum] = await db
      .select()
      .from(whatsappNumber)
      .where(eq(whatsappNumber.isActive, true))
      .limit(1);

    let kanbanSent = 0;
    let contractAlertSent = false;

    if (baseUrl && wNum) {
      const PRIORITY_EMOJI: Record<string, string> = {
        urgent: "🔴", high: "🟠", medium: "🟡", low: "🟢",
      };
      const DAY_PT: Record<string, string> = {
        Monday: "Seg", Tuesday: "Ter", Wednesday: "Qua",
        Thursday: "Qui", Friday: "Sex", Saturday: "Sáb", Sunday: "Dom",
      };

      // Send weekly digest to each user
      for (const [, data] of byUser) {
        if (!data.phone) continue;

        const taskLines = data.tasks
          .map((t) => {
            const day = t.dueDate ? format(new Date(t.dueDate + "T12:00:00"), "EEE", { locale: ptBR }) : "";
            return `${PRIORITY_EMOJI[t.priority] ?? "•"} [${day}] ${t.title}`;
          })
          .join("\n");

        const message =
          `📅 *Resumo da semana (${format(now, "dd/MM")} – ${format(addDays(now, 6), "dd/MM")})*\n\n` +
          `Olá, ${data.name.split(" ")[0]}! Você tem ${data.tasks.length} tarefa${data.tasks.length > 1 ? "s" : ""} essa semana:\n\n` +
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

        kanbanSent++;
      }

      // Send contract alerts to partners (use PARTNER_PHONE env or first active number)
      if (expiringContracts.length > 0) {
        const partnerPhone = process.env.PARTNER_ALERT_PHONE;
        if (partnerPhone) {
          const contractLines = expiringContracts
            .map((c) => `• ${c.companyName} — vence ${c.endDate ? format(new Date(c.endDate + "T12:00:00"), "dd/MM/yyyy") : "?"}`)
            .join("\n");

          await fetch(`${baseUrl}/sendText`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "SessionKey": wNum.uazapiSession,
              "Token": wNum.uazapiToken,
            },
            body: JSON.stringify({
              phone: partnerPhone,
              message:
                `⚠️ *${expiringContracts.length} contrato${expiringContracts.length > 1 ? "s" : ""} a vencer em 30 dias:*\n\n` +
                contractLines +
                `\n\n_Growth Hub Manager_`,
            }),
          }).catch(() => null);

          contractAlertSent = true;
        }
      }
    }

    return NextResponse.json({
      kanbanSent,
      contractAlerts: expiringContracts.length,
      contractAlertSent,
    });
  } catch {
    console.error("[CRON] kanban-weekly failed:", { operation: "weekly_dispatch" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
