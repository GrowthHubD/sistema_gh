import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userGoogleIntegration } from "@/lib/db/schema/users";
import { eq } from "drizzle-orm";
import { getUserCalendarToken } from "@/lib/google-calendar";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

const updateSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
});

async function getCalendarId(userId: string): Promise<string | null> {
  const [integration] = await db
    .select({ googleCalendarId: userGoogleIntegration.googleCalendarId })
    .from(userGoogleIntegration)
    .where(eq(userGoogleIntegration.userId, userId))
    .limit(1);
  return integration?.googleCalendarId ?? null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const calendarId = await getCalendarId(session.user.id);
    if (!calendarId) return NextResponse.json({ error: "Google Calendar não conectado" }, { status: 400 });

    const token = await getUserCalendarToken(session.user.id);
    const { title, description, date, startTime, endTime } = parsed.data;

    // Build start/end — use dateTime if time is provided, otherwise all-day date
    let start: Record<string, string>;
    let end: Record<string, string>;

    if (startTime) {
      const tz = "America/Sao_Paulo";
      start = { dateTime: `${date}T${startTime}:00`, timeZone: tz };
      const endVal = endTime ?? startTime;
      end = { dateTime: `${date}T${endVal}:00`, timeZone: tz };
    } else {
      start = { date };
      // All-day: end date must be exclusive (next day) for single-day events
      const nextDay = new Date(date + "T12:00:00");
      nextDay.setDate(nextDay.getDate() + 1);
      end = { date: nextDay.toISOString().slice(0, 10) };
    }

    const eventBody = {
      summary: title,
      description: description ?? "",
      start,
      end,
    };

    const res = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventBody),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[CALENDAR PATCH]", err);
      return NextResponse.json({ error: "Erro ao atualizar evento" }, { status: 502 });
    }

    const updated = await res.json();
    return NextResponse.json({ event: updated });
  } catch (err) {
    console.error("[AGENDA] PATCH calendar event failed:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const calendarId = await getCalendarId(session.user.id);
    if (!calendarId) return NextResponse.json({ error: "Google Calendar não conectado" }, { status: 400 });

    const token = await getUserCalendarToken(session.user.id);

    const res = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(id)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );

    // 204 = success, 404 = already deleted — both are fine
    if (!res.ok && res.status !== 404) {
      return NextResponse.json({ error: "Erro ao excluir evento" }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[AGENDA] DELETE calendar event failed:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
