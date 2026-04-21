"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Clock, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { format, addHours } from "date-fns";

interface TaskFormData {
  title: string;
  description: string;
  columnId: string;
  assignedTo: string;
  dueDate: string;
  startTime: string;
  endTime: string;
  priority: "low" | "medium" | "high" | "urgent";
}

interface Column { id: string; name: string; }
interface TeamUser { id: string; name: string; }

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (task: Record<string, unknown>) => void;
  onDelete?: (id: string) => void;
  columns: Column[];
  users: TeamUser[];
  currentUserId: string;
  initialData?: Partial<TaskFormData> & { id?: string };
  mode?: "create" | "edit";
}

const EMPTY: TaskFormData = {
  title: "",
  description: "",
  columnId: "",
  assignedTo: "",
  dueDate: "",
  startTime: "",
  endTime: "",
  priority: "medium",
};

const PRIORITY_OPTIONS = [
  { value: "low",    label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high",   label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

function defaultStartTime(): string {
  const t = addHours(new Date(), 6);
  return format(t, "HH:mm");
}

function defaultEndTime(start: string): string {
  if (!start) return "";
  const [h, m] = start.split(":").map(Number);
  const end = new Date(0, 0, 0, h + 1, m);
  return format(end, "HH:mm");
}

export function TaskModal({ open, onClose, onSuccess, onDelete, columns, users, currentUserId, initialData, mode = "create" }: TaskModalProps) {
  const [form, setForm] = useState<TaskFormData>({
    ...EMPTY,
    assignedTo: currentUserId,
    columnId: columns[0]?.id ?? "",
    ...initialData,
  });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset form when modal opens with new initialData
  useEffect(() => {
    if (open) {
      setForm({
        ...EMPTY,
        assignedTo: currentUserId,
        columnId: columns[0]?.id ?? "",
        ...initialData,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData?.id]);

  if (!open) return null;

  const handleDelete = async () => {
    if (!initialData?.id || !onDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/kanban/tasks/${initialData.id}`, { method: "DELETE" });
      if (res.ok) {
        onDelete(initialData.id);
        onClose();
      } else {
        toast.error("Erro ao excluir tarefa.");
      }
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Item #5: default date = today, startTime = now+6h, endTime = start+1h
    const finalDueDate = form.dueDate || format(new Date(), "yyyy-MM-dd");
    const finalStart = form.startTime || defaultStartTime();
    const finalEnd = form.endTime || defaultEndTime(finalStart);

    try {
      const url = mode === "edit" && initialData?.id
        ? `/api/kanban/tasks/${initialData.id}`
        : "/api/kanban/tasks";
      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          columnId: form.columnId,
          assignedTo: form.assignedTo,
          dueDate: finalDueDate,
          startTime: finalStart || null,
          endTime: finalEnd || null,
          priority: form.priority,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        const msg = d.detail ? `${d.error}: ${d.detail}` : (d.error ?? "Erro ao salvar");
        toast.error(msg);
        return;
      }
      const data = await res.json();
      toast.success(mode === "create" ? "Tarefa criada!" : "Tarefa salva!");
      onSuccess(data.task);
      onClose();
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  const set = (field: keyof TaskFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((p) => ({ ...p, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface rounded-xl border border-border shadow-xl animate-fade-in overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-h3 text-foreground">{mode === "edit" ? "Editar Tarefa" : "Nova Tarefa"}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors cursor-pointer p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-label text-muted block mb-1.5">Título <span className="text-error">*</span></label>
            <input type="text" value={form.title} onChange={set("title")} required
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
              placeholder="Descreva a tarefa..." />
          </div>

          <div>
            <label className="text-label text-muted block mb-1.5">Descrição</label>
            <textarea value={form.description} onChange={set("description")} rows={2}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors resize-none"
              placeholder="Detalhes adicionais..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label text-muted block mb-1.5">Coluna <span className="text-error">*</span></label>
              <Select
                value={form.columnId}
                onChange={(val) => setForm((p) => ({ ...p, columnId: val }))}
                options={columns.map(c => ({ value: c.id, label: c.name }))}
                placeholder="Selecione..."
              />
            </div>
            <div>
              <label className="text-label text-muted block mb-1.5">Prioridade</label>
              <Select
                value={form.priority}
                onChange={(val) => setForm((p) => ({ ...p, priority: val as "low" | "medium" | "high" | "urgent" }))}
                options={PRIORITY_OPTIONS}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label text-muted block mb-1.5">Responsável <span className="text-error">*</span></label>
              <Select
                value={form.assignedTo}
                onChange={(val) => setForm((p) => ({ ...p, assignedTo: val }))}
                options={[{ value: "", label: "Selecionar..." }, ...users.map(u => ({ value: u.id, label: u.name }))]}
                placeholder="Selecionar..."
              />
            </div>
            <div>
              <label className="text-label text-muted block mb-1.5">Prazo</label>
              <input type="date" value={form.dueDate} onChange={set("dueDate")}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
            </div>
          </div>

          {/* Time range */}
          <div>
            <label className="text-label text-muted block mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Horário <span className="text-muted/50">(opcional — padrão: hoje+6h)</span>
            </label>
            <div className="flex items-center gap-2">
              <input type="time" value={form.startTime} onChange={set("startTime")}
                className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
              <span className="text-muted text-sm shrink-0">até</span>
              <input type="time" value={form.endTime} onChange={set("endTime")}
                className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            {mode === "edit" && onDelete && (
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="px-3 py-2 rounded-lg border border-error/40 text-error hover:bg-error/10 transition-colors text-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            )}
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border text-muted hover:text-foreground transition-colors text-sm cursor-pointer">Cancelar</button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "edit" ? "Salvar" : "Criar Tarefa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
