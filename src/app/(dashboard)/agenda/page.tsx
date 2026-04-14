"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Calendar, CheckCircle2, Circle, ExternalLink, Users, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, getDaysInMonth, startOfMonth, getDay, isSameDay, isToday, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { TaskModal } from "@/components/kanban/task-modal";

interface KanbanTask {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  startTime: string | null;
  endTime: string | null;
  priority: string;
  isCompleted: boolean;
  columnId: string;
  assignedTo: string;
  assigneeName: string | null;
  order: number;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  htmlLink?: string;
}

interface TeamUser { id: string; name: string; }
interface Column { id: string; name: string; }

function isOverdue(task: KanbanTask): boolean {
  if (task.isCompleted) return false;
  return new Date(task.dueDate + "T12:00:00") < startOfDay(new Date());
}

function taskChipClass(task: KanbanTask): string {
  if (isOverdue(task)) return "bg-error text-white border-l-2 border-error";
  const map: Record<string, string> = {
    urgent: "bg-warning text-white border-l-2 border-warning",
    high:   "bg-warning/20 text-warning border-l-2 border-warning",
    medium: "bg-primary/10 text-primary border-l-2 border-primary",
    low:    "bg-surface-2 text-muted border-l-2 border-border",
  };
  return map[task.priority] ?? map.medium;
}

function taskPanelClass(task: KanbanTask): string {
  if (isOverdue(task)) return "bg-error/15 text-error border-l-2 border-error";
  const map: Record<string, string> = {
    urgent: "bg-warning/15 text-warning border-l-2 border-warning",
    high:   "bg-warning/10 text-warning border-l-2 border-warning",
    medium: "bg-primary/10 text-primary border-l-2 border-primary",
    low:    "bg-surface-2 text-muted border-l-2 border-border",
  };
  return map[task.priority] ?? map.medium;
}

type ModalState =
  | { open: false }
  | { open: true; mode: "create"; date: string }
  | { open: true; mode: "edit"; task: KanbanTask };

export default function AgendaPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([]);
  const [hasCalendar, setHasCalendar] = useState(false);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [viewingUserId, setViewingUserId] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<Column[]>([]);
  const [allUsers, setAllUsers] = useState<TeamUser[]>([]);
  const [modal, setModal] = useState<ModalState>({ open: false });
  const dragTaskId = useRef<string | null>(null);

  // Fetch kanban meta (columns + users) once
  useEffect(() => {
    fetch("/api/kanban")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setColumns(d.columns ?? []);
          setAllUsers(d.users ?? []);
        }
      });
  }, []);

  const fetchData = useCallback(async (y: number, m: number, uid?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: String(y), month: String(m) });
      if (uid) params.set("userId", uid);
      const res = await fetch(`/api/agenda?${params}`);
      if (res.ok) {
        const d = await res.json();
        setTasks(d.tasks);
        setGoogleEvents(d.googleEvents ?? []);
        setHasCalendar(d.hasCalendar);
        setTeamUsers(d.teamUsers ?? []);
        setViewingUserId(d.viewingUserId);
        if (!uid) setCurrentUserId(d.viewingUserId);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(year, month); }, [year, month, fetchData]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const firstDayOfWeek = getDay(startOfMonth(new Date(year, month - 1)));
  const leadingBlanks = (firstDayOfWeek + 6) % 7;

  const dateStr = (day: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const getTasksForDay = (day: number) =>
    tasks.filter((t) => t.dueDate === dateStr(day));

  const getGoogleEventsForDay = (day: number) =>
    googleEvents.filter((e) => {
      const eDate = e.start.date ?? e.start.dateTime?.slice(0, 10);
      return eDate === dateStr(day);
    });

  const selectedTasks = selectedDate ? getTasksForDay(selectedDate.getDate()) : [];
  const selectedEvents = selectedDate ? getGoogleEventsForDay(selectedDate.getDate()) : [];

  // Drag-and-drop reschedule
  const handleDrop = async (day: number) => {
    const id = dragTaskId.current;
    if (!id) return;
    dragTaskId.current = null;
    const newDate = dateStr(day);
    const task = tasks.find((t) => t.id === id);
    if (!task || task.dueDate === newDate) return;

    // Optimistic update
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, dueDate: newDate } : t));

    const res = await fetch(`/api/kanban/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate: newDate }),
    });
    if (!res.ok) {
      // Revert on failure
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, dueDate: task.dueDate } : t));
    }
  };

  const handleTaskSaved = (saved: Record<string, unknown>) => {
    const t = saved as unknown as KanbanTask;
    setTasks((prev) => {
      const idx = prev.findIndex((x) => x.id === t.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = t;
        return next;
      }
      return [...prev, t];
    });
  };

  // Resolve modal initialData
  const modalInitialData = modal.open
    ? modal.mode === "edit"
      ? {
          id: modal.task.id,
          title: modal.task.title,
          description: modal.task.description ?? "",
          columnId: modal.task.columnId,
          assignedTo: modal.task.assignedTo,
          dueDate: modal.task.dueDate,
          startTime: modal.task.startTime ?? "",
          endTime: modal.task.endTime ?? "",
          priority: modal.task.priority as "low" | "medium" | "high" | "urgent",
        }
      : { dueDate: modal.date }
    : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-h1 text-foreground">Agenda</h1>
          <p className="text-muted mt-1">
            {hasCalendar ? "Tarefas + Google Calendar" : "Tarefas do Kanban"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {teamUsers.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted" />
              <select
                value={viewingUserId}
                onChange={(e) => { setViewingUserId(e.target.value); fetchData(year, month, e.target.value); }}
                className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
              >
                {teamUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}
          {!hasCalendar && (
            <Link
              href="/configuracoes"
              className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
            >
              <Calendar className="w-4 h-4" /> Conectar Google Calendar
            </Link>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Calendar grid */}
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-surface-2 text-muted hover:text-foreground transition-colors cursor-pointer">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-semibold text-foreground capitalize">
              {format(new Date(year, month - 1), "MMMM yyyy", { locale: ptBR })}
            </h2>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-surface-2 text-muted hover:text-foreground transition-colors cursor-pointer">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-muted">{d}</div>
            ))}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          )}

          {!loading && (
            <div className="grid grid-cols-7">
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div key={`blank-${i}`} className="min-h-[80px] border-b border-r border-border/50 bg-surface-2/20" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const date = new Date(year, month - 1, day);
                const dayTasks = getTasksForDay(day);
                const dayEvents = getGoogleEventsForDay(day);
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const isTodayDay = isToday(date);
                const total = dayTasks.length + dayEvents.length;

                return (
                  <div
                    key={day}
                    onClick={() => {
                      setSelectedDate(date);
                      setModal({ open: true, mode: "create", date: dateStr(day) });
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(day)}
                    className={cn(
                      "min-h-[80px] p-1.5 border-b border-r border-border/50 cursor-pointer transition-colors group",
                      isSelected ? "bg-primary/10" : "hover:bg-surface-2"
                    )}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium",
                        isTodayDay ? "bg-primary text-white" : "text-foreground"
                      )}>
                        {day}
                      </div>
                      <Plus className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-60 transition-opacity shrink-0 mt-1" />
                    </div>
                    {total > 0 && (
                      <div className="space-y-0.5">
                        {dayTasks.slice(0, 2).map((t) => (
                          <div
                            key={t.id}
                            draggable
                            onDragStart={(e) => { e.stopPropagation(); dragTaskId.current = t.id; }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(date);
                              setModal({ open: true, mode: "edit", task: t });
                            }}
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity",
                              taskChipClass(t)
                            )}
                          >
                            {t.startTime ? `${t.startTime} ` : ""}{t.title}
                          </div>
                        ))}
                        {dayEvents.slice(0, total > 2 ? 1 : 2).map((e) => (
                          <div key={e.id} className="text-[10px] px-1.5 py-0.5 rounded truncate bg-[#4285F4]/15 text-[#4285F4] border-l-2 border-[#4285F4]">
                            {e.summary ?? "Evento"}
                          </div>
                        ))}
                        {total > 2 && (
                          <div className="text-[10px] text-muted px-1.5">+{total - 2}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Day detail panel */}
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              {selectedDate
                ? format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })
                : "Selecione um dia"}
            </h3>
            {selectedDate && (
              <button
                onClick={() => setModal({ open: true, mode: "create", date: dateStr(selectedDate.getDate()) })}
                className="p-1.5 rounded-lg hover:bg-surface-2 text-muted hover:text-foreground transition-colors cursor-pointer"
                title="Nova tarefa neste dia"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="p-4 space-y-3 overflow-y-auto max-h-[500px]">
            {selectedTasks.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Tarefas</p>
                <div className="space-y-2">
                  {selectedTasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setModal({ open: true, mode: "edit", task: t })}
                      className={cn(
                        "w-full p-3 rounded-lg flex items-start gap-2 text-left cursor-pointer hover:opacity-80 transition-opacity",
                        taskPanelClass(t)
                      )}
                    >
                      {t.isCompleted
                        ? <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                        : <Circle className="w-4 h-4 shrink-0 mt-0.5 opacity-50" />}
                      <div className="min-w-0">
                        <p className={cn("text-sm font-medium truncate", t.isCompleted && "line-through opacity-60")}>{t.title}</p>
                        {(t.startTime || t.assigneeName) && (
                          <p className="text-xs opacity-70 mt-0.5">
                            {t.startTime && `${t.startTime}${t.endTime ? ` – ${t.endTime}` : ""}`}
                            {t.startTime && t.assigneeName && " · "}
                            {t.assigneeName}
                          </p>
                        )}
                        {t.description && (
                          <p className="text-xs opacity-60 mt-0.5 line-clamp-2">{t.description}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedEvents.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Google Calendar</p>
                <div className="space-y-2">
                  {selectedEvents.map((e) => (
                    <div key={e.id} className="p-3 rounded-lg bg-[#4285F4]/10 border-l-2 border-[#4285F4]">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{e.summary ?? "Evento"}</p>
                        {e.htmlLink && (
                          <a href={e.htmlLink} target="_blank" rel="noopener noreferrer" className="text-[#4285F4] hover:opacity-80 shrink-0">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      {e.start.dateTime && (
                        <p className="text-xs text-muted mt-1">
                          {format(parseISO(e.start.dateTime), "HH:mm")}
                          {e.end.dateTime && ` – ${format(parseISO(e.end.dateTime), "HH:mm")}`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedTasks.length === 0 && selectedEvents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="w-8 h-8 text-muted/30 mb-2" />
                <p className="text-sm text-muted">
                  {selectedDate ? "Sem eventos neste dia" : "Selecione um dia para ver os eventos"}
                </p>
                {selectedDate && (
                  <button
                    onClick={() => setModal({ open: true, mode: "create", date: dateStr(selectedDate.getDate()) })}
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Nova tarefa
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task modal */}
      <TaskModal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        onSuccess={handleTaskSaved}
        columns={columns}
        users={allUsers}
        currentUserId={currentUserId}
        mode={modal.open ? modal.mode : "create"}
        initialData={modalInitialData}
      />
    </div>
  );
}
