import { useEffect, useState } from "react";
import { getCaseStudy, saveCaseStudy, type CaseStudyListItem } from "./api";
import ImageUploadField from "./ImageUploadField";

type Tool = { icon: string; alt: string };

type Props = {
  slug: string;
  summary: CaseStudyListItem | null;
  onClose: () => void;
  onSaved: () => void;
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function arrTools(v: unknown): Tool[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) =>
      x && typeof x === "object"
        ? { icon: str((x as Tool).icon), alt: str((x as Tool).alt) }
        : { icon: "", alt: "" }
    )
    .filter((t) => t.icon || t.alt);
}

function arrStr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x : "")).filter(Boolean);
}

export default function CaseStudyEditor({ slug, summary, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseStudyJson, setCaseStudyJson] = useState("[]");
  const [caseStudyErr, setCaseStudyErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [src, setSrc] = useState("");
  const [previewSrc, setPreviewSrc] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [date, setDate] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [description, setDescription] = useState("");
  const [figmaEmbedUrl, setFigmaEmbedUrl] = useState("");
  const [result, setResult] = useState("");
  const [team, setTeam] = useState("");
  const [duration, setDuration] = useState("");
  const [caseType, setCaseType] = useState("");
  const [role, setRole] = useState("");
  const [tools, setTools] = useState<Tool[]>([]);
  const [relatedRaw, setRelatedRaw] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getCaseStudy(slug);
        if (cancelled) return;
        const { _storage, ...rest } = data;
        void _storage;
        setTitle(str(rest.title));
        setSrc(str(rest.src));
        setPreviewSrc(str(rest.previewSrc));
        setWebsiteUrl(str(rest.websiteUrl));
        setDate(str(rest.date));
        setShortDescription(str(rest.shortDescription));
        setLongDescription(str(rest.longDescription));
        setDescription(str(rest.description));
        setFigmaEmbedUrl(str(rest.figmaEmbedUrl));
        setResult(str(rest.result));
        setTeam(str(rest.team));
        setDuration(str(rest.duration));
        setCaseType(str(rest.caseType));
        setRole(str(rest.role));
        setTools(arrTools(rest.tools).length ? arrTools(rest.tools) : [{ icon: "", alt: "" }]);
        setRelatedRaw(arrStr(rest.relatedProjects).join(", "));
        setCaseStudyJson(JSON.stringify(rest.caseStudy ?? [], null, 2));
        setCaseStudyErr(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  function addTool() {
    setTools((t) => [...t, { icon: "", alt: "" }]);
  }

  function updateTool(i: number, field: keyof Tool, value: string) {
    setTools((t) => t.map((row, j) => (j === i ? { ...row, [field]: value } : row)));
  }

  function removeTool(i: number) {
    setTools((t) => (t.length <= 1 ? t : t.filter((_, j) => j !== i)));
  }

  async function handleSave() {
    setCaseStudyErr(null);
    let caseStudy: unknown;
    try {
      caseStudy = JSON.parse(caseStudyJson);
      if (!Array.isArray(caseStudy)) throw new Error("caseStudy must be a JSON array");
    } catch (e) {
      setCaseStudyErr(e instanceof Error ? e.message : "Invalid JSON");
      return;
    }

    const relatedProjects = relatedRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const cleanTools = tools
      .map((t) => ({ icon: t.icon.trim(), alt: t.alt.trim() }))
      .filter((t) => t.icon || t.alt);

    const payload: Record<string, unknown> = {
      slug,
      title: title.trim() || slug,
      src: src.trim(),
      previewSrc: previewSrc.trim(),
      websiteUrl: websiteUrl.trim(),
      date: date.trim(),
      shortDescription: shortDescription.trim(),
      longDescription: longDescription.trim(),
      description: description.trim(),
      figmaEmbedUrl: figmaEmbedUrl.trim(),
      result: result.trim(),
      team: team.trim(),
      duration: duration.trim(),
      caseType: caseType.trim(),
      role: role.trim(),
      tools: cleanTools,
      caseStudy,
      relatedProjects,
    };

    setSaving(true);
    setError(null);
    try {
      await saveCaseStudy(slug, payload);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/60 p-2 sm:p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-title"
    >
      <div className="flex w-full max-w-3xl flex-col rounded-xl border border-border bg-card shadow-2xl transition-transform duration-300 ease-out">
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id="editor-title" className="text-lg font-semibold tracking-tight">
              {title || slug}
            </h2>
            <p className="font-mono text-xs text-muted-foreground">
              {slug}
              {summary?.storage ? ` · ${summary.storage}` : ""}
              {summary?.missing ? " · missing file" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="flex flex-col gap-6">
              {error ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <section className="grid gap-4 sm:grid-cols-2">
                <Field label="Title" value={title} onChange={setTitle} />
                <Field label="Date (ISO)" value={date} onChange={setDate} />
                <div className="sm:col-span-2">
                  <ImageUploadField
                    label="Cover image (src)"
                    category="case-study"
                    caseStudySlug={slug}
                    value={src}
                    onChange={setSrc}
                  />
                </div>
                <div className="sm:col-span-2">
                  <ImageUploadField
                    label="Preview / card image"
                    category="case-study"
                    caseStudySlug={slug}
                    value={previewSrc}
                    onChange={setPreviewSrc}
                  />
                </div>
                <Field
                  label="Website URL"
                  value={websiteUrl}
                  onChange={setWebsiteUrl}
                  className="sm:col-span-2"
                />
                <Field
                  label="Figma embed URL"
                  value={figmaEmbedUrl}
                  onChange={setFigmaEmbedUrl}
                  className="sm:col-span-2"
                />
              </section>

              <section className="flex flex-col gap-3">
                <Area label="Short description" value={shortDescription} onChange={setShortDescription} />
                <Area label="Long description" value={longDescription} onChange={setLongDescription} />
                <Area label="Description" value={description} onChange={setDescription} />
                <Area label="Result" value={result} onChange={setResult} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Team" value={team} onChange={setTeam} />
                  <Field label="Duration" value={duration} onChange={setDuration} />
                  <Field label="Case type" value={caseType} onChange={setCaseType} />
                  <Field label="Role" value={role} onChange={setRole} />
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Tools
                  </span>
                  <button
                    type="button"
                    onClick={addTool}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    + Add tool
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {tools.map((t, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        placeholder="icon key"
                        value={t.icon}
                        onChange={(e) => updateTool(i, "icon", e.target.value)}
                        className="input-base flex-1 font-mono text-sm"
                      />
                      <input
                        placeholder="label"
                        value={t.alt}
                        onChange={(e) => updateTool(i, "alt", e.target.value)}
                        className="input-base flex-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeTool(i)}
                        className="rounded-lg px-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Remove tool"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Related projects (comma-separated slugs)
                </label>
                <input
                  value={relatedRaw}
                  onChange={(e) => setRelatedRaw(e.target.value)}
                  className="input-base w-full text-sm"
                  placeholder="kotteb, tamdone"
                />
              </section>

              <section>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    caseStudy blocks (JSON array)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(caseStudyJson);
                        setCaseStudyJson(JSON.stringify(parsed, null, 2));
                        setCaseStudyErr(null);
                      } catch (e) {
                        setCaseStudyErr(e instanceof Error ? e.message : "Invalid");
                      }
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Format
                  </button>
                </div>
                <textarea
                  value={caseStudyJson}
                  onChange={(e) => setCaseStudyJson(e.target.value)}
                  rows={14}
                  className="input-base w-full resize-y font-mono text-xs leading-relaxed"
                  spellCheck={false}
                />
                {caseStudyErr ? (
                  <p className="mt-1 text-xs text-destructive">{caseStudyErr}</p>
                ) : null}
              </section>
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || saving}
            onClick={handleSave}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-base w-full text-sm"
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="input-base w-full resize-y text-sm"
      />
    </label>
  );
}
