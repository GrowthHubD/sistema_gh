import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { crmConversation, crmMessage, whatsappNumber } from "@/lib/db/schema/crm";
import { messageTemplate } from "@/lib/db/schema/settings";
import { kanbanColumn, kanbanTask } from "@/lib/db/schema/kanban";
import { user } from "@/lib/db/schema/users";
import { eq, and, asc, ilike } from "drizzle-orm";
import { format, parse, isValid } from "date-fns";

// Uazapi v2 webhook payload (incoming message)
interface UazapiWebhookPayload {
  event?: string;
  session?: string;
  data?: {
    key?: {
      id?: string;
      remoteJid?: string; // contact or group JID
      fromMe?: boolean;
      participant?: string; // sender's JID inside a group
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text?: string;
        contextInfo?: { mentionedJid?: string[] };
      };
      imageMessage?: { caption?: string };
      audioMessage?: Record<string, unknown>;
      videoMessage?: { caption?: string };
      documentMessage?: { fileName?: string };
    };
    messageType?: string;
    pushName?: string;
    messageTimestamp?: number;
  };
}

function extractPhone(jid: string): string {
  return jid.replace(/@.*$/, "").replace(/[^0-9]/g, "");
}

function extractContent(payload: UazapiWebhookPayload): { content: string | null; mediaType: string } {
  const msg = payload.data?.message;
  if (!msg) return { content: null, mediaType: "text" };

  if (msg.conversation) return { content: msg.conversation, mediaType: "text" };
  if (msg.extendedTextMessage?.text) return { content: msg.extendedTextMessage.text, mediaType: "text" };
  if (msg.imageMessage) return { content: msg.imageMessage.caption ?? null, mediaType: "image" };
  if (msg.audioMessage) return { content: null, mediaType: "audio" };
  if (msg.videoMessage) return { content: msg.videoMessage.caption ?? null, mediaType: "video" };
  if (msg.documentMessage) return { content: msg.documentMessage.fileName ?? null, mediaType: "document" };

  return { content: null, mediaType: "text" };
}

/** Parse "key: value" pairs from a message string (case-insensitive keys). */
function parseFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  // Match "word(s): rest-of-line" patterns, including multi-word keys up to the colon
  const lines = text.split(/\n|;/);
  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      const key = match[1].trim().toLowerCase()
        .replace(/[^a-záéíóúãõâêîôûçàüñ]/gi, ""); // normalize accents/spaces
      fields[key] = match[2].trim();
    }
  }
  return fields;
}

/** Map field keys from the intake template body to standard field names. */
function resolveIntakeFields(
  fields: Record<string, string>,
  templateBody: string
): { descricao?: string; urgencia?: string; data?: string; nome?: string } {
  // Extract variable→label mapping from template
  // Template lines: "tarefa: {{descricao}}" → label "tarefa" maps to variable "descricao"
  const varMap: Record<string, string> = {}; // variable name → label key used in message
  const lines = templateBody.split("\n");
  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*\{\{(\w+)\}\}/);
    if (match) {
      const label = match[1].trim().toLowerCase().replace(/[^a-z]/gi, "");
      const varName = match[2].toLowerCase();
      varMap[varName] = label;
    }
  }

  const get = (varName: string): string | undefined => {
    const label = varMap[varName];
    if (label && fields[label]) return fields[label];
    // Fallback: try variable name directly
    if (fields[varName]) return fields[varName];
    // Fallback: try common synonyms
    const synonyms: Record<string, string[]> = {
      descricao: ["tarefa", "task", "titulo", "descricao"],
      urgencia: ["urgencia", "urgência", "prioridade", "priority"],
      data: ["data", "prazo", "deadline", "vencimento"],
      nome: ["responsavel", "responsável", "resp", "nome", "para", "assignee"],
    };
    for (const syn of synonyms[varName] ?? []) {
      if (fields[syn]) return fields[syn];
    }
    return undefined;
  };

  return {
    descricao: get("descricao"),
    urgencia: get("urgencia"),
    data: get("data"),
    nome: get("nome"),
  };
}

/** Map urgency strings to kanban priority values. */
function parsePriority(urgencia?: string): "low" | "medium" | "high" | "urgent" {
  if (!urgencia) return "medium";
  const u = urgencia.toLowerCase();
  if (u.includes("urgent") || u.includes("urgente")) return "urgent";
  if (u.includes("alt") || u.includes("high")) return "high";
  if (u.includes("baix") || u.includes("low")) return "low";
  return "medium";
}

/** Parse Brazilian date formats (dd/MM, dd/MM/yyyy, yyyy-MM-dd). */
function parseDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  const str = dateStr.trim();

  // yyyy-MM-dd
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return str;

  // dd/MM/yyyy
  const full = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (full) {
    const d = parse(str, "dd/MM/yyyy", new Date());
    if (isValid(d)) return format(d, "yyyy-MM-dd");
  }

  // dd/MM (assume current year, or next year if past)
  const short = str.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (short) {
    const year = new Date().getFullYear();
    const d = parse(`${str}/${year}`, "dd/MM/yyyy", new Date());
    if (isValid(d)) return format(d, "yyyy-MM-dd");
  }

  return null;
}

/** Try to find a user by display name (fuzzy). Returns null if not found. */
async function findUserByName(name: string): Promise<string | null> {
  if (!name) return null;
  const term = name.trim().toLowerCase();

  // Exact match first (case-insensitive)
  const [found] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(ilike(user.name, `%${term}%`), eq(user.isActive, true)))
    .limit(1);

  return found?.id ?? null;
}

export async function POST(request: NextRequest) {
  try {
    // Validate webhook token
    const receivedToken =
      request.headers.get("authorization") ??
      request.headers.get("x-webhook-secret") ??
      "";
    const validTokens = [
      process.env.UAZAPI_TOKEN,
      process.env.UAZAPI_WEBHOOK_SECRET,
    ].filter(Boolean);

    if (validTokens.length > 0 && !validTokens.includes(receivedToken)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload: UazapiWebhookPayload = await request.json();

    // Only process incoming messages
    if (payload.event !== "messages.upsert" && payload.event !== "message") {
      return NextResponse.json({ ok: true });
    }

    const key = payload.data?.key;
    if (!key || key.fromMe) return NextResponse.json({ ok: true }); // ignore outgoing

    const remoteJid = key.remoteJid ?? "";
    const isGroup = remoteJid.includes("@g.us");

    const { content } = extractContent(payload);

    // ── GROUP MESSAGE: task intake ─────────────────────────────────────
    if (isGroup && content) {
      await handleGroupTaskIntake(content, payload.data?.pushName ?? null);
      return NextResponse.json({ ok: true });
    }

    // ── DIRECT MESSAGE: CRM conversation ──────────────────────────────
    if (isGroup) return NextResponse.json({ ok: true }); // group but no content

    const session = payload.session;
    if (!session) return NextResponse.json({ ok: true });

    const { mediaType } = extractContent(payload);
    const contactPhone = extractPhone(remoteJid);
    const pushName = payload.data?.pushName ?? null;

    const [wNum] = await db
      .select()
      .from(whatsappNumber)
      .where(eq(whatsappNumber.uazapiSession, session))
      .limit(1);

    if (!wNum) {
      console.error("[WEBHOOK] Uazapi session not found:", { session: session.slice(-4) });
      return NextResponse.json({ ok: true });
    }

    const existing = await db
      .select()
      .from(crmConversation)
      .where(
        and(
          eq(crmConversation.whatsappNumberId, wNum.id),
          eq(crmConversation.contactPhone, contactPhone)
        )
      )
      .limit(1);

    let conversationId: string;

    if (existing[0]) {
      conversationId = existing[0].id;
      await db
        .update(crmConversation)
        .set({
          lastMessageAt: new Date(),
          unreadCount: existing[0].unreadCount + 1,
          contactPushName: pushName ?? existing[0].contactPushName,
          updatedAt: new Date(),
        })
        .where(eq(crmConversation.id, conversationId));
    } else {
      const [newConv] = await db
        .insert(crmConversation)
        .values({
          whatsappNumberId: wNum.id,
          contactPhone,
          contactPushName: pushName,
          classification: "new",
          lastMessageAt: new Date(),
          unreadCount: 1,
        })
        .returning();
      conversationId = newConv.id;
    }

    await db.insert(crmMessage).values({
      conversationId,
      messageIdWa: key.id ?? null,
      direction: "incoming",
      content,
      mediaType,
      status: "delivered",
      timestamp: payload.data?.messageTimestamp
        ? new Date(payload.data.messageTimestamp * 1000)
        : new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    console.error("[WEBHOOK] Uazapi processing failed:", { operation: "upsert_message" });
    return NextResponse.json({ ok: true });
  }
}

async function handleGroupTaskIntake(messageText: string, senderName: string | null) {
  try {
    // Load intake template (best-effort)
    let templateBody = "tarefa: {{descricao}}\nurgencia: {{urgencia}}\ndata: {{data}}\nresponsavel: {{nome}}";
    try {
      const [row] = await db
        .select({ body: messageTemplate.body })
        .from(messageTemplate)
        .where(eq(messageTemplate.id, "task_intake_template"))
        .limit(1);
      if (row?.body) templateBody = row.body;
    } catch {
      // Table may not exist; use default
    }

    // Strip @mentions from message start (e.g. "@5518997980771 ")
    const cleanText = messageText.replace(/^@\d+\s*/, "").trim();

    // Parse key:value pairs from the message
    const fields = parseFields(cleanText);
    if (Object.keys(fields).length === 0) return; // not a task message

    const { descricao, urgencia, data, nome } = resolveIntakeFields(fields, templateBody);

    // Need at least a description to create a task
    if (!descricao) return;

    // Resolve assignee
    let assigneeId: string | null = null;
    if (nome) {
      assigneeId = await findUserByName(nome);
    }
    // Fallback: try sender name
    if (!assigneeId && senderName) {
      assigneeId = await findUserByName(senderName);
    }
    // Fallback: first active user
    if (!assigneeId) {
      const [firstUser] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.isActive, true))
        .limit(1);
      assigneeId = firstUser?.id ?? null;
    }

    if (!assigneeId) return; // no users in system

    // Get first kanban column
    const [firstCol] = await db
      .select({ id: kanbanColumn.id })
      .from(kanbanColumn)
      .orderBy(asc(kanbanColumn.order))
      .limit(1);

    if (!firstCol) return;

    const dueDate = parseDate(data) ?? format(new Date(), "yyyy-MM-dd");
    const priority = parsePriority(urgencia);

    await db.insert(kanbanTask).values({
      title: descricao,
      columnId: firstCol.id,
      assignedTo: assigneeId,
      createdBy: assigneeId,
      dueDate,
      priority,
    });

    console.log("[WEBHOOK] Group task created:", { title: descricao, priority, dueDate });
  } catch (err) {
    // Never throw — just log
    console.error("[WEBHOOK] Group task intake failed:", err);
  }
}
