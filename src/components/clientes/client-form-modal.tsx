"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface ClientFormData {
  companyName: string;
  cnpj: string;
  responsibleName: string;
  email: string;
  phone: string;
  status: "active" | "inactive";
  notes: string;
}

interface ClientFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Partial<ClientFormData> & { id?: string };
  mode?: "create" | "edit";
}

const EMPTY_FORM: ClientFormData = {
  companyName: "",
  cnpj: "",
  responsibleName: "",
  email: "",
  phone: "",
  status: "active",
  notes: "",
};

export function ClientFormModal({
  open,
  onClose,
  onSuccess,
  initialData,
  mode = "create",
}: ClientFormModalProps) {
  const [form, setForm] = useState<ClientFormData>({
    ...EMPTY_FORM,
    ...initialData,
  });
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = mode === "edit" && initialData?.id
        ? `/api/clientes/${initialData.id}`
        : "/api/clientes";
      const method = mode === "edit" ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          cnpj: form.cnpj || null,
          responsibleName: form.responsibleName,
          email: form.email || null,
          phone: form.phone || null,
          status: form.status,
          notes: form.notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Erro ao salvar cliente");
        return;
      }

      toast.success(mode === "edit" ? "Cliente editado!" : "Cliente salvo!");
      onSuccess();
      onClose();
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const set = (field: keyof ClientFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-surface rounded-xl border border-border shadow-xl animate-fade-in overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-h3 text-foreground">
            {mode === "edit" ? "Editar Cliente" : "Novo Cliente"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground transition-colors p-1 rounded cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-label text-muted block mb-1.5">
                Empresa <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={form.companyName}
                onChange={set("companyName")}
                required
                placeholder="Nome da empresa"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="text-label text-muted block mb-1.5">
                Responsável <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={form.responsibleName}
                onChange={set("responsibleName")}
                required
                placeholder="Nome do contato"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="text-label text-muted block mb-1.5">CNPJ</label>
              <input
                type="text"
                value={form.cnpj}
                onChange={set("cnpj")}
                placeholder="00.000.000/0000-00"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="text-label text-muted block mb-1.5">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="contato@empresa.com"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="text-label text-muted block mb-1.5">Telefone</label>
              <input
                type="text"
                value={form.phone}
                onChange={set("phone")}
                placeholder="(11) 99999-9999"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-label text-muted block mb-1.5">Status</label>
              <Select
                value={form.status}
                onChange={(val) => setForm((prev) => ({ ...prev, status: val as "active" | "inactive" }))}
                options={[
                  { value: "active", label: "Ativo" },
                  { value: "inactive", label: "Inativo" },
                ]}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-label text-muted block mb-1.5">Observações</label>
              <textarea
                value={form.notes}
                onChange={set("notes")}
                rows={3}
                placeholder="Informações adicionais..."
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border text-muted hover:text-foreground hover:border-foreground/20 transition-colors text-sm cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "edit" ? "Salvar Alterações" : "Criar Cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
