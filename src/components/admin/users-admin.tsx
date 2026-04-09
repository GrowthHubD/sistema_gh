"use client";

import { useState } from "react";
import { Users, Shield, CheckCircle2, XCircle, ChevronDown, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type UserRole = "partner" | "manager" | "operational";

const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "pipeline", label: "Pipeline" },
  { key: "contracts", label: "Contratos" },
  { key: "financial", label: "Financeiro" },
  { key: "crm", label: "CRM" },
  { key: "clients", label: "Clientes" },
  { key: "sdr", label: "Agente SDR" },
  { key: "kanban", label: "Kanban" },
  { key: "blog", label: "Blog" },
  { key: "admin", label: "Admin" },
] as const;

type ModuleKey = (typeof MODULES)[number]["key"];

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  jobTitle: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Permission {
  id: string;
  userId: string;
  module: string;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface UsersAdminProps {
  initialUsers: UserRecord[];
  initialPermissions: Permission[];
  currentUserId: string;
}

const ROLE_LABELS: Record<string, string> = {
  partner: "Sócio",
  manager: "Gerente",
  operational: "Operacional",
};

const ROLE_COLORS: Record<string, string> = {
  partner: "bg-primary/10 text-primary",
  manager: "bg-info/10 text-info",
  operational: "bg-muted/10 text-muted",
};

export function UsersAdmin({ initialUsers, initialPermissions, currentUserId }: UsersAdminProps) {
  const [users, setUsers] = useState(initialUsers);
  const [permissions, setPermissions] = useState(initialPermissions);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [savingPerm, setSavingPerm] = useState<string | null>(null);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const getUserPerms = (userId: string): Record<ModuleKey, { canView: boolean; canEdit: boolean; canDelete: boolean }> => {
    const result = {} as Record<ModuleKey, { canView: boolean; canEdit: boolean; canDelete: boolean }>;
    for (const m of MODULES) {
      const found = permissions.find((p) => p.userId === userId && p.module === m.key);
      result[m.key] = {
        canView: found?.canView ?? false,
        canEdit: found?.canEdit ?? false,
        canDelete: found?.canDelete ?? false,
      };
    }
    return result;
  };

  const [localPerms, setLocalPerms] = useState<Record<ModuleKey, { canView: boolean; canEdit: boolean; canDelete: boolean }> | null>(null);

  const handleSelectUser = (userId: string) => {
    if (selectedUserId === userId) {
      setSelectedUserId(null);
      setLocalPerms(null);
      return;
    }
    setSelectedUserId(userId);
    setLocalPerms(getUserPerms(userId));
  };

  const handlePermChange = (module: ModuleKey, field: "canView" | "canEdit" | "canDelete", value: boolean) => {
    if (!localPerms) return;
    setLocalPerms((p) => {
      if (!p) return p;
      const updated = { ...p[module], [field]: value };
      // If disabling view, also disable edit and delete
      if (field === "canView" && !value) {
        updated.canEdit = false;
        updated.canDelete = false;
      }
      return { ...p, [module]: updated };
    });
  };

  const handleSavePerms = async (userId: string) => {
    if (!localPerms) return;
    setSavingPerm(userId);
    try {
      await Promise.all(
        MODULES.map(async (m) => {
          const res = await fetch(`/api/admin/users/${userId}/permissions`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ module: m.key, ...localPerms[m.key] }),
          });
          if (res.ok) {
            const data = await res.json();
            setPermissions((prev) => {
              const filtered = prev.filter((p) => !(p.userId === userId && p.module === m.key));
              return [...filtered, data.permission];
            });
          }
        })
      );
    } finally {
      setSavingPerm(null);
    }
  };

  const handleUserFieldChange = (field: keyof UserRecord, value: string | boolean) => {
    if (!editingUser) return;
    setEditingUser((u) => u ? { ...u, [field]: value } : u);
  };

  const handleSaveUser = async (userId: string) => {
    if (!editingUser) return;
    setSavingUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingUser.name,
          role: editingUser.role,
          jobTitle: editingUser.jobTitle,
          phone: editingUser.phone,
          isActive: editingUser.isActive,
        }),
      });
      if (res.ok) {
        setUsers((p) => p.map((u) => u.id === userId ? editingUser : u));
        setEditingUser(null);
      }
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <div className="space-y-4">
      {users.map((u) => {
        const isSelected = selectedUserId === u.id;
        const isMe = u.id === currentUserId;
        const isEditing = editingUser?.id === u.id;

        return (
          <div key={u.id} className="bg-surface rounded-xl border border-border overflow-hidden">
            {/* User header */}
            <button
              onClick={() => handleSelectUser(u.id)}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface-2 transition-colors cursor-pointer text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold shrink-0">
                {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-foreground text-sm">{u.name}</p>
                  {isMe && <span className="text-xs text-muted">(você)</span>}
                  <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", ROLE_COLORS[u.role] ?? ROLE_COLORS.operational)}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                  {!u.isActive && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-error/10 text-error">Inativo</span>
                  )}
                </div>
                <p className="text-small text-muted mt-0.5">{u.email}</p>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-muted transition-transform shrink-0", isSelected && "rotate-180")} />
            </button>

            {/* Expanded section */}
            {isSelected && (
              <div className="border-t border-border">
                {/* User profile edit */}
                {!isMe && (
                  <div className="px-5 py-4 border-b border-border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted" />
                        <h3 className="text-sm font-medium text-foreground">Perfil</h3>
                      </div>
                      {!isEditing ? (
                        <button
                          onClick={() => setEditingUser({ ...u })}
                          className="text-xs text-primary hover:underline cursor-pointer"
                        >
                          Editar
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingUser(null)}
                            className="text-xs text-muted hover:text-foreground cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleSaveUser(u.id)}
                            disabled={savingUserId === u.id}
                            className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer disabled:opacity-50"
                          >
                            {savingUserId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Salvar
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-label text-muted mb-1">Nome</label>
                          <input type="text" value={editingUser!.name}
                            onChange={(e) => handleUserFieldChange("name", e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
                        </div>
                        <div>
                          <label className="block text-label text-muted mb-1">Cargo</label>
                          <select value={editingUser!.role}
                            onChange={(e) => handleUserFieldChange("role", e.target.value as UserRole)}
                            className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer">
                            <option value="partner">Sócio</option>
                            <option value="manager">Gerente</option>
                            <option value="operational">Operacional</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-label text-muted mb-1">Título</label>
                          <input type="text" value={editingUser!.jobTitle ?? ""}
                            onChange={(e) => handleUserFieldChange("jobTitle", e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 cursor-pointer pb-1.5">
                            <input type="checkbox" checked={editingUser!.isActive}
                              onChange={(e) => handleUserFieldChange("isActive", e.target.checked)}
                              className="w-4 h-4 accent-primary cursor-pointer" />
                            <span className="text-sm text-foreground">Ativo</span>
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-label text-muted">Título</p>
                          <p className="text-foreground mt-0.5">{u.jobTitle ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-label text-muted">Telefone</p>
                          <p className="text-foreground mt-0.5">{u.phone ?? "—"}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Permissions matrix */}
                {!isMe && (
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-muted" />
                        <h3 className="text-sm font-medium text-foreground">Permissões (sobrescrevem o padrão do cargo)</h3>
                      </div>
                      <button
                        onClick={() => handleSavePerms(u.id)}
                        disabled={savingPerm === u.id}
                        className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer disabled:opacity-50"
                      >
                        {savingPerm === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Salvar permissões
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left text-label text-muted py-2 font-medium">Módulo</th>
                            <th className="text-center text-label text-muted py-2 font-medium w-20">Visualizar</th>
                            <th className="text-center text-label text-muted py-2 font-medium w-20">Editar</th>
                            <th className="text-center text-label text-muted py-2 font-medium w-20">Excluir</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {MODULES.map((m) => {
                            const perm = localPerms?.[m.key] ?? { canView: false, canEdit: false, canDelete: false };
                            return (
                              <tr key={m.key} className="hover:bg-surface-2 transition-colors">
                                <td className="py-2 text-foreground">{m.label}</td>
                                {(["canView", "canEdit", "canDelete"] as const).map((field) => (
                                  <td key={field} className="py-2 text-center">
                                    <button
                                      onClick={() => handlePermChange(m.key, field, !perm[field])}
                                      className="cursor-pointer"
                                    >
                                      {perm[field] ? (
                                        <CheckCircle2 className="w-5 h-5 text-success mx-auto" />
                                      ) : (
                                        <XCircle className="w-5 h-5 text-muted/30 mx-auto" />
                                      )}
                                    </button>
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {isMe && (
                  <div className="px-5 py-4">
                    <p className="text-small text-muted">Não é possível editar sua própria conta. Use as configurações de perfil.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
