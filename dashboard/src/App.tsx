import { useCallback, useEffect, useState } from "react";
import CaseStudyEditor from "./CaseStudyEditor";
import ImageUploadField from "./ImageUploadField";
import SiteContentPanel from "./SiteContentPanel";
import {
  createBlogArticle,
  createCaseStudy,
  deleteBlogArticle,
  deleteCaseStudy,
  getBlog,
  getCaseStudies,
  getHealth,
  patchBlogArticle,
  type BlogArticle,
  type CaseStudyListItem,
} from "./api";
import { mediaUrl } from "./mediaUrl";
import { ConfirmModal, FormField, Modal } from "./ui";

type Tab = "cases" | "blog" | "site";

export default function App() {
  const [tab, setTab] = useState<Tab>("cases");
  const [toast, setToast] = useState<string | null>(null);
  const [root, setRoot] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    getHealth()
      .then((h) => setRoot(h.contentRoot))
      .catch(() => setRoot(null));
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Portfolio content
          </h1>
          <p className="mt-1 max-w-xl text-sm text-brand-dim">
            Create and edit case studies, manage blog links, and keep{" "}
            <code className="rounded bg-surface-overlay px-1 py-0.5 font-mono text-xs text-accent-muted">
              portfolio-content
            </code>{" "}
            in sync with your site manifest, testimonials, experience, and education.
          </p>
          {root ? (
            <p className="mt-2 font-mono text-[11px] text-brand-dim/80">{root}</p>
          ) : null}
        </div>
        <nav className="flex flex-wrap gap-1 rounded-lg border border-border-subtle bg-surface-raised p-1">
          {(
            [
              ["cases", "Case studies"],
              ["blog", "Blog"],
              ["site", "Site"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === id
                  ? "bg-surface-overlay text-brand shadow-sm"
                  : "text-brand-dim hover:text-brand"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {tab === "cases" ? (
        <CaseStudiesSection showToast={showToast} />
      ) : tab === "blog" ? (
        <BlogSection showToast={showToast} />
      ) : (
        <SiteContentPanel showToast={showToast} />
      )}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[60] max-w-md -translate-x-1/2 rounded-lg border border-border-subtle bg-surface-overlay px-4 py-3 text-sm text-brand shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function CaseStudiesSection({ showToast }: { showToast: (s: string) => void }) {
  const [items, setItems] = useState<CaseStudyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editorSlug, setEditorSlug] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);

  const closeEditor = useCallback(() => setEditorSlug(null), []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { items: list } = await getCaseStudies();
      setItems(list);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((it) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      it.slug.toLowerCase().includes(s) ||
      it.title.toLowerCase().includes(s) ||
      it.shortDescription.toLowerCase().includes(s)
    );
  });

  const editorSummary = editorSlug
    ? items.find((i) => i.slug === editorSlug) ?? null
    : null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          placeholder="Search case studies…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input-base max-w-md text-sm"
        />
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-surface hover:bg-accent-muted"
        >
          New case study
        </button>
      </div>

      {err ? (
        <p className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">
          {err}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-brand-dim">Loading case studies…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((it) => (
            <li
              key={it.slug}
              className="group flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface-raised px-4 py-3 transition-colors hover:border-accent-muted/30 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{it.title}</span>
                  <span className="font-mono text-xs text-brand-dim">{it.slug}</span>
                  {it.storage ? (
                    <span className="rounded bg-surface-overlay px-1.5 py-0.5 font-mono text-[10px] uppercase text-brand-dim">
                      {it.storage}
                    </span>
                  ) : null}
                  {it.missing ? (
                    <span className="text-xs text-amber-400">Missing JSON</span>
                  ) : null}
                </div>
                {it.shortDescription ? (
                  <p className="mt-1 line-clamp-2 text-sm text-brand-dim">{it.shortDescription}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={it.missing}
                  onClick={() => setEditorSlug(it.slug)}
                  className="rounded-lg border border-border-subtle px-3 py-1.5 text-sm hover:bg-surface-overlay disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteSlug(it.slug)}
                  className="rounded-lg px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/40"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {createOpen ? (
        <CreateCaseStudyModal
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            await load();
            showToast("Case study created");
            setCreateOpen(false);
          }}
        />
      ) : null}

      {editorSlug ? (
        <CaseStudyEditor
          slug={editorSlug}
          summary={editorSummary}
          onClose={closeEditor}
          onSaved={() => {
            load();
            showToast("Saved case study & site.json");
          }}
        />
      ) : null}

      {deleteSlug ? (
        <ConfirmModal
          title="Delete case study?"
          body={`This removes “${deleteSlug}” from the manifest, deletes its JSON files and folder, and removes the project from site.json. This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setDeleteSlug(null)}
          onConfirm={async () => {
            try {
              await deleteCaseStudy(deleteSlug);
              await load();
              showToast("Case study deleted");
            } catch (e) {
              showToast(e instanceof Error ? e.message : "Delete failed");
            } finally {
              setDeleteSlug(null);
            }
          }}
        />
      ) : null}
    </section>
  );
}

function CreateCaseStudyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  return (
    <Modal title="New case study" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {localErr ? (
          <p className="text-sm text-red-300">{localErr}</p>
        ) : null}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-brand-dim">
            Slug
          </span>
          <input
            value={slug}
            onChange={(e) =>
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
            }
            className="input-base font-mono text-sm"
            placeholder="my-project"
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-brand-dim">
            Title (optional)
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-base text-sm"
            placeholder="Display name"
          />
        </label>
        <p className="text-xs text-brand-dim">
          Creates{" "}
          <code className="font-mono text-accent-muted">
            case-studies/{slug || "slug"}/project.json
          </code>{" "}
          and an empty assets folder. Add cover images under assets.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-subtle px-4 py-2 text-sm hover:bg-surface-overlay"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || slug.length < 2}
            onClick={async () => {
              setLocalErr(null);
              setBusy(true);
              try {
                await createCaseStudy(slug, title || undefined);
                await onCreated();
              } catch (e) {
                setLocalErr(e instanceof Error ? e.message : "Failed");
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-surface hover:bg-accent-muted disabled:opacity-40"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function BlogSection({ showToast }: { showToast: (s: string) => void }) {
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
    <section className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-surface hover:bg-accent-muted"
        >
          New article
        </button>
      </div>
      {err ? (
        <p className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">
          {err}
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-brand-dim">Loading articles…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {articles.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface-raised px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex min-w-0 flex-1 gap-3">
                {mediaUrl(a.image ?? "") ? (
                  <img
                    src={mediaUrl(a.image ?? "")}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-lg border border-border-subtle object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                <p className="font-medium">{a.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-brand-dim">{a.description}</p>
                <p className="mt-2 font-mono text-[11px] text-brand-dim">
                  {a.date} · {a.readTime} · {a.id}
                </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-border-subtle px-3 py-1.5 text-sm hover:bg-surface-overlay"
                >
                  Open
                </a>
                <button
                  type="button"
                  onClick={() => setEditing(a)}
                  className="rounded-lg border border-border-subtle px-3 py-1.5 text-sm hover:bg-surface-overlay"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(a.id)}
                  className="rounded-lg px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/40"
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
    </section>
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
        {localErr ? <p className="text-sm text-red-300">{localErr}</p> : null}
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
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-brand-dim">
            Description
          </span>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={4}
            className="input-base resize-y text-sm"
          />
        </label>
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-border-subtle pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border-subtle px-4 py-2 text-sm hover:bg-surface-overlay"
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
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-surface hover:bg-accent-muted disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}
