import { useEffect, useMemo, useState } from "react";
import {
  cloudinaryDelete,
  cloudinaryGetRawText,
  cloudinaryMove,
  cloudinaryPutRawText,
  cloudinaryUploadFile,
  getCloudinaryConfig,
  listCloudinaryFolders,
  listCloudinaryResources,
  type CloudinaryResource,
  type CloudinaryResourceType,
} from "@/api";
import { mediaUrl } from "@/mediaUrl";
import { ConfirmModal, FormField, Modal } from "@/ui";

function bytes(n?: number) {
  if (!n) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function CloudinaryBrowserPage() {
  const [config, setConfig] = useState<{ cloudName: string | null; prefix: string } | null>(null);
  const [folder, setFolder] = useState<string>("");
  const [folders, setFolders] = useState<{ name: string; path: string }[]>([]);
  const [type, setType] = useState<CloudinaryResourceType>("image");
  const [items, setItems] = useState<CloudinaryResource[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [editPublicId, setEditPublicId] = useState<string | null>(null);
  const [move, setMove] = useState<{ id: string; type: CloudinaryResourceType } | null>(null);
  const [del, setDel] = useState<{ id: string; type: CloudinaryResourceType } | null>(null);

  useEffect(() => {
    getCloudinaryConfig()
      .then((c) => {
        setConfig({ cloudName: c.cloudName, prefix: c.prefix });
        setFolder(c.prefix);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Cloudinary not configured"));
  }, []);

  async function loadFolders(prefix: string) {
    const r = await listCloudinaryFolders(prefix);
    setFolders(r.folders);
  }

  async function loadResources(reset = true) {
    setLoading(true);
    setErr(null);
    try {
      if (!folder) return;
      await loadFolders(folder);
      const r = await listCloudinaryResources({
        prefix: folder,
        type,
        next_cursor: reset ? null : next,
        max_results: 50,
      });
      setNext(r.next_cursor);
      setItems((prev) => (reset ? r.resources : [...prev, ...r.resources]));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!folder) return;
    loadResources(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, type]);

  const breadcrumbs = useMemo(() => {
    const p = folder.replace(/^\/+/, "").replace(/\/$/, "");
    const parts = p.split("/").filter(Boolean);
    const out: { label: string; path: string }[] = [];
    let cur = "";
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part;
      out.push({ label: part, path: cur });
    }
    return out;
  }, [folder]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            Browse and manage Cloudinary under{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              {config?.prefix ?? "portfolio-content"}
            </code>
            .
          </p>
          {config?.cloudName ? (
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              cloud: {config.cloudName} · folder: {folder}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CloudinaryResourceType)}
            className="input-base w-[140px]"
          >
            <option value="image">Images</option>
            <option value="raw">Raw (json/pdf/etc.)</option>
          </select>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Upload
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {breadcrumbs.map((b, idx) => (
          <button
            key={b.path}
            type="button"
            className="rounded-md px-2 py-1 hover:bg-accent"
            onClick={() => setFolder(b.path)}
          >
            {idx === 0 ? b.label : `/${b.label}`}
          </button>
        ))}
      </div>

      {err ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {err}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[280px_1fr]">
        <div className="rounded-lg border bg-card p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Subfolders</p>
          <div className="flex flex-col gap-1">
            {folders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subfolders.</p>
            ) : (
              folders.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  className={`w-full rounded-md px-2 py-2 text-left text-sm hover:bg-accent ${
                    folder === f.path ? "bg-accent" : ""
                  }`}
                  onClick={() => setFolder(f.path)}
                >
                  {f.name}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Files ({items.length})
            </p>
          </div>
          {loading && items.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ul className="divide-y">
              {items.map((r) => (
                <li key={r.public_id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {r.resource_type === "image" ? (
                      <img
                        alt=""
                        src={r.secure_url ?? mediaUrl("")}
                        className="h-10 w-10 shrink-0 rounded-md border object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
                        RAW
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs">{r.public_id}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.format ? `${r.format} · ` : ""}
                        {bytes(r.bytes)}
                        {r.created_at ? ` · ${new Date(r.created_at).toLocaleString()}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {r.resource_type === "raw" ? (
                      <button
                        type="button"
                        onClick={() => setEditPublicId(r.public_id)}
                        className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
                      >
                        Edit
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setMove({ id: r.public_id, type: r.resource_type })}
                      className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
                    >
                      Move
                    </button>
                    <button
                      type="button"
                      onClick={() => setDel({ id: r.public_id, type: r.resource_type })}
                      className="inline-flex h-9 items-center rounded-md px-3 text-sm text-destructive hover:bg-destructive/10"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between border-t p-3">
            <button
              type="button"
              onClick={() => loadResources(true)}
              className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
            >
              Refresh
            </button>
            <button
              type="button"
              disabled={!next || loading}
              onClick={() => loadResources(false)}
              className="inline-flex h-9 items-center rounded-md bg-secondary px-3 text-sm text-secondary-foreground hover:bg-secondary/80 disabled:opacity-40"
            >
              Load more
            </button>
          </div>
        </div>
      </div>

      {uploadOpen ? (
        <UploadModal
          folder={folder}
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false);
            loadResources(true);
          }}
        />
      ) : null}

      {editPublicId ? (
        <RawEditModal
          publicId={editPublicId}
          onClose={() => setEditPublicId(null)}
          onSaved={() => {
            setEditPublicId(null);
            loadResources(true);
          }}
        />
      ) : null}

      {move ? (
        <MoveModal
          from={move.id}
          type={move.type}
          onClose={() => setMove(null)}
          onMoved={() => {
            setMove(null);
            loadResources(true);
          }}
        />
      ) : null}

      {del ? (
        <ConfirmModal
          title="Delete file?"
          body={`Delete ${del.id}? This removes it from Cloudinary.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setDel(null)}
          onConfirm={async () => {
            await cloudinaryDelete(del.id, del.type);
            setDel(null);
            loadResources(true);
          }}
        />
      ) : null}
    </div>
  );
}

function UploadModal({
  folder,
  onClose,
  onUploaded,
}: {
  folder: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [type, setType] = useState<CloudinaryResourceType | "auto">("auto");

  return (
    <Modal title="Upload to Cloudinary" onClose={onClose} wide>
      <div className="flex flex-col gap-3">
        {localErr ? <p className="text-sm text-destructive">{localErr}</p> : null}
        <p className="text-sm text-muted-foreground">
          Upload into <code className="rounded bg-muted px-1 py-0.5 text-xs">{folder}</code>
        </p>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="input-base"
        />
        <FormField
          label="Filename override (optional)"
          value={filename}
          onChange={setFilename}
          placeholder="keeps original if empty"
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Resource type</span>
          <select value={type} onChange={(e) => setType(e.target.value as any)} className="input-base">
            <option value="auto">Auto</option>
            <option value="image">Image</option>
            <option value="raw">Raw</option>
          </select>
        </label>
        <div className="flex justify-end gap-2 border-t pt-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!file || busy}
            onClick={async () => {
              if (!file) return;
              setLocalErr(null);
              setBusy(true);
              try {
                await cloudinaryUploadFile({ file, folder, filename: filename || undefined, type });
                onUploaded();
              } catch (e) {
                setLocalErr(e instanceof Error ? e.message : "Upload failed");
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-40"
          >
            {busy ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RawEditModal({
  publicId,
  onClose,
  onSaved,
}: {
  publicId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cloudinaryGetRawText(publicId)
      .then((r) => {
        if (!cancelled) setText(r.text);
      })
      .catch((e) => setLocalErr(e instanceof Error ? e.message : "Load failed"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publicId]);

  return (
    <Modal title="Edit raw file" onClose={onClose} wide>
      <div className="flex flex-col gap-3">
        <p className="font-mono text-xs text-muted-foreground">{publicId}</p>
        {localErr ? <p className="text-sm text-destructive">{localErr}</p> : null}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={18}
          className="input-base resize-y font-mono text-xs"
          spellCheck={false}
        />
        <div className="flex justify-end gap-2 border-t pt-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await cloudinaryPutRawText(publicId, text);
                onSaved();
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
      </div>
    </Modal>
  );
}

function MoveModal({
  from,
  type,
  onClose,
  onMoved,
}: {
  from: string;
  type: CloudinaryResourceType;
  onClose: () => void;
  onMoved: () => void;
}) {
  const [to, setTo] = useState(from);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  return (
    <Modal title="Move / rename" onClose={onClose} wide>
      <div className="flex flex-col gap-3">
        {localErr ? <p className="text-sm text-destructive">{localErr}</p> : null}
        <p className="font-mono text-xs text-muted-foreground">{from}</p>
        <FormField label="New public_id" value={to} onChange={setTo} mono />
        <div className="flex justify-end gap-2 border-t pt-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !to.trim() || to.trim() === from}
            onClick={async () => {
              setLocalErr(null);
              setBusy(true);
              try {
                await cloudinaryMove(from, to.trim(), type);
                onMoved();
              } catch (e) {
                setLocalErr(e instanceof Error ? e.message : "Move failed");
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-40"
          >
            {busy ? "Moving…" : "Move"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

