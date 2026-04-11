"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Select } from "@/components/ui/select";

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  type: string;
  categoryId: string;
  isPublished: boolean;
}

interface PostEditorModalProps {
  categories: Category[];
  post?: Post;
  onClose: () => void;
  onSuccess: (post: Post & { categoryName: string | null; authorName: string | null; updatedAt: string; createdAt: string; coverImageUrl: string | null; authorId: string; publishedAt: string | null }) => void;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 100);

export function PostEditorModal({ categories, post, onClose, onSuccess }: PostEditorModalProps) {
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [form, setForm] = useState({
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    content: "",
    excerpt: post?.excerpt ?? "",
    type: post?.type ?? "article",
    categoryId: post?.categoryId ?? (categories[0]?.id ?? ""),
    isPublished: post?.isPublished ?? false,
  });

  // Load content when editing
  useEffect(() => {
    if (post) {
      fetch(`/api/blog/posts/${post.id}`)
        .then((r) => r.json())
        .then((d) => setForm((f) => ({ ...f, content: d.post?.content ?? "" })));
    }
  }, [post]);

  // Auto-generate slug from title (only when creating)
  useEffect(() => {
    if (!post) {
      setForm((f) => ({ ...f, slug: slugify(f.title) }));
    }
  }, [form.title, post]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.categoryId) return;
    setSaving(true);
    try {
      const url = post ? `/api/blog/posts/${post.id}` : "/api/blog/posts";
      const method = post ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        onSuccess(data.post);
      }
    } finally {
      setSaving(false);
    }
  }

  const rootCats = categories.filter((c) => !c.parentId);
  const subCats = (id: string) => categories.filter((c) => c.parentId === id);

  const categoryOptions = rootCats.flatMap((cat) => [
    { value: cat.id, label: cat.name },
    ...subCats(cat.id).map((sub) => ({ value: sub.id, label: `↳ ${sub.name}` })),
  ]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-surface rounded-xl border border-border w-full max-w-4xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-h3 text-foreground">{post ? "Editar Post" : "Novo Post"}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreview((p) => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted hover:text-foreground border border-border rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
            >
              {preview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {preview ? "Editar" : "Preview"}
            </button>
            <button onClick={onClose} className="text-muted hover:text-foreground cursor-pointer text-lg leading-none">✕</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* Meta fields */}
          <div className="px-5 py-4 border-b border-border space-y-3 shrink-0">
            <div>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Título do post…"
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors text-base font-medium"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-label text-muted mb-1">Slug</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  required
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors font-mono"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-label text-muted mb-1">Categoria</label>
                <Select
                  value={form.categoryId}
                  onChange={(val) => setForm((f) => ({ ...f, categoryId: val }))}
                  options={categoryOptions}
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-label text-muted mb-1">Tipo</label>
                <Select
                  value={form.type}
                  onChange={(val) => setForm((f) => ({ ...f, type: val }))}
                  options={[
                    { value: "article", label: "Artigo" },
                    { value: "guide", label: "Guia" },
                    { value: "list", label: "Lista" },
                    { value: "study", label: "Estudo" },
                  ]}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={form.isPublished}
                    onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <span className="text-sm text-foreground">Publicado</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-label text-muted mb-1">Resumo (opcional)</label>
              <input
                type="text"
                value={form.excerpt}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                placeholder="Breve descrição do post…"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Content editor / preview */}
          <div className="flex-1 overflow-hidden px-5 py-4">
            {preview ? (
              <div className="h-full overflow-y-auto">
                <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
                  {form.content || <span className="text-muted italic">Sem conteúdo ainda…</span>}
                </pre>
              </div>
            ) : (
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Escreva o conteúdo em Markdown…"
                required
                className="w-full h-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors resize-none font-mono leading-relaxed"
              />
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-5 py-4 border-t border-border shrink-0">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium cursor-pointer disabled:opacity-50">
              {saving ? "Salvando…" : post ? "Salvar alterações" : "Criar post"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
