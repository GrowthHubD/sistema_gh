"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Clock, Trash2, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

export interface GoogleEventData {
  id: string;
  summary?: string;
  description?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  htmlLink?: string;
  transparency?: "opaque" | "transparent";
}

interface CalendarEventModalProps {
  open: boolean;
  event: GoogleEventData | null;
  onClose: () => void;
  onUpdated: (event: GoogleEventData) => void;
  onDeleted: (id: string) => void;
}

export function CalendarEventModal({ open, event, onClose, onUpdated, onDeleted }: CalendarEventModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [transparency, setTransparency] = useState<"opaque" | "transparent">("opaque");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!event || !open) return;
    setTitle(event.summary ?? "");
    setDescription(event.description ?? "");

    const rawDate = event.start.date ?? event.start.dateTime?.slice(0, 10) ?? "";
    setDate(rawDate);

    if (event.start.dateTime) {
      setStartTime(format(parseISO(event.start.dateTime), "HH:mm"));
    } else {
      setStartTime("");
    }
    if (event.end.dateTime) {
      setEndTime(format(parseISO(event.end.dateTime), "HH:mm"));
    } else {
      setEndTime("");
    }
    setTransparency(event.transparency ?? "opaque");
  }, [event, open]);

  if (!open || !event) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/agenda/calendar-events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description || null, date, startTime: startTime || null, endTime: endTime || null, transparency }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "Erro ao salvar evento.");
        return;
      }
      const data = await res.json();
      toast.success("Evento atualizado!");
      onUpdated(data.event);
      onClose();
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/agenda/calendar-events/${event.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "Erro ao excluir evento.");
        return;
      }
      toast.success("Evento excluído!");
      onDeleted(event.id);
      onClose();
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface rounded-xl border border-border shadow-xl animate-fade-in overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#4285F4]" />
            <h2 className="text-h3 text-foreground">Editar Evento</h2>
          </div>
          <div className="flex items-center gap-2">
            {event.htmlLink && (
              <a href={event.htmlLink} target="_blank" rel="noopener noreferrer"
                className="text-muted hover:text-[#4285F4] transition-colors p-1 rounded">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button onClick={onClose} className="text-muted hover:text-foreground transition-colors cursor-pointer p-1 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="text-label text-muted block mb-1.5">Título <span className="text-error">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-[#4285F4] transition-colors"
              placeholder="Título do evento..."
            />
          </div>

          <div>
            <label className="text-label text-muted block mb-1.5">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-[#4285F4] transition-colors resize-none"
              placeholder="Descrição..."
            />
          </div>

          <div>
            <label className="text-label text-muted block mb-1.5">Data <span className="text-error">*</span></label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#4285F4] transition-colors"
            />
          </div>

          <div>
            <label className="text-label text-muted block mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Horário <span className="text-muted/50">(opcional)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#4285F4] transition-colors"
              />
              <span className="text-muted text-sm shrink-0">até</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#4285F4] transition-colors"
              />
            </div>
          </div>

          {/* Transparency toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm text-foreground font-medium">Ocupar horário</p>
              <p className="text-xs text-muted mt-0.5">
                {transparency === "opaque" ? "Aparece como ocupado no calendário" : "Aparece como disponível no calendário"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTransparency(t => t === "opaque" ? "transparent" : "opaque")}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                transparency === "opaque" ? "bg-[#4285F4]" : "bg-border"
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                transparency === "opaque" ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-2 rounded-lg border border-error/40 text-error hover:bg-error/10 transition-colors text-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border text-muted hover:text-foreground transition-colors text-sm cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-[#4285F4] text-white hover:bg-[#3367d6] transition-colors text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
