import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import CaseStudyEditor from "@/CaseStudyEditor";
import {
  createCaseStudy,
  deleteCaseStudy,
  getCaseStudies,
  type CaseStudyListItem,
} from "@/api";
import type { DashboardOutletContext } from "@/dashboard-context";
import { ConfirmModal, FormField, Modal } from "@/ui";

export default function CaseStudiesPage() {
  const { showToast } = useOutletContext<DashboardOutletContext>();
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Edit case study JSON, sync <code className="rounded bg-muted px-1 py-0.5 text-xs">site.json</code>{" "}
        projects, and upload assets into each project folder.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          placeholder="Search case studies…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input-base max-w-md"
        />
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          New case study
        </button>
      </div>

      {err ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {err}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading case studies…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((it) => (
            <li
              key={it.slug}
              className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-accent/30 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{it.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">{it.slug}</span>
                  {it.storage ? (
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                      {it.storage}
                    </span>
                  ) : null}
                  {it.missing ? (
                    <span className="text-xs text-amber-600 dark:text-amber-400">Missing JSON</span>
                  ) : null}
                </div>
                {it.shortDescription ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {it.shortDescription}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={it.missing}
                  onClick={() => setEditorSlug(it.slug)}
                  className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteSlug(it.slug)}
                  className="inline-flex h-9 items-center rounded-md px-3 text-sm text-destructive hover:bg-destructive/10"
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
    </div>
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
          <p className="text-sm text-destructive">{localErr}</p>
        ) : null}
        <FormField
          label="Slug"
          value={slug}
          mono
          placeholder="my-project"
          autoFocus
          onChange={(v) => setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
        />
        <FormField label="Title (optional)" value={title} onChange={setTitle} />
        <p className="text-xs text-muted-foreground">
          Creates{" "}
          <code className="rounded bg-muted px-1 font-mono text-xs">
            case-studies/{slug || "slug"}/project.json
          </code>{" "}
          and an empty assets folder.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm hover:bg-accent"
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
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-40"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
