import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import ImageUploadField from "@/ImageUploadField";
import {
  createBlogArticle,
  deleteBlogArticle,
  getBlog,
  patchBlogArticle,
  type BlogArticle,
} from "@/api";
import type { DashboardOutletContext } from "@/dashboard-context";
import { mediaUrl } from "@/mediaUrl";
import { ConfirmModal, FormField, Modal } from "@/ui";

export default function BlogPage() {
  const { showToast } = useOutletContext<DashboardOutletContext>();
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<BlogArticle | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await getBlog();
      setArticles(data.articles ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load blog");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        LinkedIn and external articles stored in{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">blog/articles.json</code>.
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          New article
        </button>
      </div>
      {err ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {err}
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading articles…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {articles.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex min-w-0 flex-1 gap-3">
                {mediaUrl(a.image ?? "") ? (
                  <img
                    src={mediaUrl(a.image ?? "")}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-md border object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.description}</p>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    {a.date} · {a.readTime} · {a.id}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
                >
                  Open
                </a>
                <button
                  type="button"
                  onClick={() => setEditing(a)}
                  className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(a.id)}
                  className="inline-flex h-9 items-center rounded-md px-3 text-sm text-destructive hover:bg-destructive/10"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <BlogArticleFormModal
          title="New article"
          initial={emptyArticle()}
          onClose={() => setCreating(false)}
          onSave={async (article) => {
            await createBlogArticle(article);
            await load();
            showToast("Article added");
            setCreating(false);
          }}
        />
      ) : null}

      {editing ? (
        <BlogArticleFormModal
          title="Edit article"
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (article) => {
            await patchBlogArticle(article.id, article);
            await load();
            showToast("Article updated");
            setEditing(null);
          }}
        />
      ) : null}

      {deleteId ? (
        <ConfirmModal
          title="Remove article?"
          body="This removes the entry from articles.json only."
          confirmLabel="Remove"
          danger
          onCancel={() => setDeleteId(null)}
          onConfirm={async () => {
            try {
              await deleteBlogArticle(deleteId);
              await load();
              showToast("Article removed");
            } catch (e) {
              showToast(e instanceof Error ? e.message : "Delete failed");
            } finally {
              setDeleteId(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function emptyArticle(): BlogArticle {
  return {
    id: `article-${Date.now()}`,
    title: "",
    url: "",
    readTime: "1 m",
    date: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }),
    description: "",
    image: "",
  };
}

function BlogArticleFormModal({
  title,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  initial: BlogArticle;
  onClose: () => void;
  onSave: (a: BlogArticle) => void | Promise<void>;
}) {
  const [form, setForm] = useState<BlogArticle>(initial);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="flex max-h-[min(70vh,560px)] flex-col gap-3 overflow-y-auto pr-1">
        {localErr ? <p className="text-sm text-destructive">{localErr}</p> : null}
        <FormField
          label="ID"
          value={form.id}
          onChange={(id) => setForm((f) => ({ ...f, id }))}
          mono
          disabled={title === "Edit article"}
        />
        <FormField
          label="Title"
          value={form.title}
          onChange={(t) => setForm((f) => ({ ...f, title: t }))}
        />
        <FormField label="URL" value={form.url} onChange={(url) => setForm((f) => ({ ...f, url }))} />
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Read time"
            value={form.readTime}
            onChange={(readTime) => setForm((f) => ({ ...f, readTime }))}
          />
          <FormField
            label="Date"
            value={form.date}
            onChange={(date) => setForm((f) => ({ ...f, date }))}
          />
        </div>
        <ImageUploadField
          label="Cover / card image"
          category="blog"
          value={form.image ?? ""}
          onChange={(image) => setForm((f) => ({ ...f, image }))}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Description</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={4}
            className="input-base resize-y"
          />
        </label>
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t pt-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !form.title.trim() || !form.url.trim()}
          onClick={async () => {
            setLocalErr(null);
            setBusy(true);
            try {
              await onSave(form);
            } catch (e) {
              setLocalErr(e instanceof Error ? e.message : "Save failed");
            } finally {
              setBusy(false);
            }
          }}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}
