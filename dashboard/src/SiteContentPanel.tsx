import { useCallback, useEffect, useState } from "react";
import {
  createSiteItem,
  deleteSiteItem,
  getSiteCollections,
  updateSiteItem,
  type SiteCollection,
} from "./api";
import ImageUploadField from "./ImageUploadField";
import { ConfirmModal, FormField, Modal } from "./ui";

type Sub = "testimonials" | "experience" | "education";

function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asNum(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function asStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x : "")).filter(Boolean);
}

function asLinks(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(o)) {
    if (typeof val === "string") out[k] = val;
  }
  return out;
}

type Testimonial = {
  id: string;
  quote: string;
  author: {
    name: string;
    title: string;
    company: string;
    avatar: string;
    linkedin: string;
    companyUrl: string;
    companyLogo: string;
  };
  relatedProjectId: string;
  date: string;
  verified: boolean;
  featured: boolean;
};

function emptyTestimonial(): Testimonial {
  return {
    id: `client-${Date.now()}`,
    quote: "",
    author: {
      name: "",
      title: "",
      company: "",
      avatar: "",
      linkedin: "",
      companyUrl: "",
      companyLogo: "",
    },
    relatedProjectId: "",
    date: "",
    verified: true,
    featured: false,
  };
}

function testimonialFromUnknown(x: unknown): Testimonial {
  const o = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
  const a =
    o.author && typeof o.author === "object"
      ? (o.author as Record<string, unknown>)
      : {};
  return {
    id: asStr(o.id) || `client-${Date.now()}`,
    quote: asStr(o.quote),
    author: {
      name: asStr(a.name),
      title: asStr(a.title),
      company: asStr(a.company),
      avatar: asStr(a.avatar),
      linkedin: asStr(a.linkedin),
      companyUrl: asStr(a.companyUrl),
      companyLogo: asStr(a.companyLogo),
    },
    relatedProjectId: asStr(o.relatedProjectId),
    date: asStr(o.date),
    verified: asBool(o.verified, true),
    featured: asBool(o.featured, false),
  };
}

type Experience = {
  id: string;
  title: string;
  company: string;
  type: string;
  startYear: number | null;
  endYear: number | null;
  duration: string;
  location: string;
  description: string;
  highlightBullets: string[];
  techUsed: string[];
  keywords: string[];
  thumbnail: string;
  logo: string;
  featured: boolean;
  links: Record<string, string>;
};

function emptyExperience(): Experience {
  return {
    id: `role-${Date.now()}`,
    title: "",
    company: "",
    type: "Full-Time",
    startYear: new Date().getFullYear(),
    endYear: null,
    duration: "",
    location: "",
    description: "",
    highlightBullets: [],
    techUsed: [],
    keywords: [],
    thumbnail: "",
    logo: "",
    featured: false,
    links: {},
  };
}

function experienceFromUnknown(x: unknown): Experience {
  const o = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
  return {
    id: asStr(o.id) || `role-${Date.now()}`,
    title: asStr(o.title),
    company: asStr(o.company),
    type: asStr(o.type) || "Full-Time",
    startYear: asNum(o.startYear),
    endYear: o.endYear === null ? null : asNum(o.endYear),
    duration: asStr(o.duration),
    location: asStr(o.location),
    description: asStr(o.description),
    highlightBullets: asStrArr(o.highlightBullets),
    techUsed: asStrArr(o.techUsed),
    keywords: asStrArr(o.keywords),
    thumbnail: asStr(o.thumbnail),
    logo: asStr(o.logo),
    featured: asBool(o.featured, false),
    links: asLinks(o.links),
  };
}

type Education = {
  id: string;
  school: string;
  degree: string;
  field: string;
  startYear: number | null;
  endYear: number | null;
  location: string;
  type: string;
  description: string;
  highlightBullets: string[];
  logo: string;
  thumbnail: string;
  diplomaImage: string;
  certificateUrl: string | null;
  links: Record<string, string>;
};

function emptyEducation(): Education {
  return {
    id: `school-${Date.now()}`,
    school: "",
    degree: "",
    field: "",
    startYear: 2020,
    endYear: 2024,
    location: "",
    type: "Bachelor",
    description: "",
    highlightBullets: [],
    logo: "",
    thumbnail: "",
    diplomaImage: "",
    certificateUrl: null,
    links: {},
  };
}

function educationFromUnknown(x: unknown): Education {
  const o = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
  const cert = o.certificateUrl;
  return {
    id: asStr(o.id) || `school-${Date.now()}`,
    school: asStr(o.school),
    degree: asStr(o.degree),
    field: asStr(o.field),
    startYear: asNum(o.startYear),
    endYear: asNum(o.endYear),
    location: asStr(o.location),
    type: asStr(o.type) || "Bachelor",
    description: asStr(o.description),
    highlightBullets: asStrArr(o.highlightBullets),
    logo: asStr(o.logo),
    thumbnail: asStr(o.thumbnail),
    diplomaImage: asStr(o.diplomaImage),
    certificateUrl: cert === null ? null : asStr(cert) || null,
    links: asLinks(o.links),
  };
}

export default function SiteContentPanel({ showToast }: { showToast: (s: string) => void }) {
  const [sub, setSub] = useState<Sub>("testimonials");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [testimonials, setTestimonials] = useState<unknown[]>([]);
  const [experience, setExperience] = useState<unknown[]>([]);
  const [education, setEducation] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [tModal, setTModal] = useState<Testimonial | null>(null);
  const [tNew, setTNew] = useState(false);
  const [eModal, setEModal] = useState<Experience | null>(null);
  const [eNew, setENew] = useState(false);
  const [edModal, setEdModal] = useState<Education | null>(null);
  const [edNew, setEdNew] = useState(false);
  const [del, setDel] = useState<{ col: SiteCollection; id: string; label: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await getSiteCollections();
      setTestimonials(data.testimonials);
      setExperience(data.experience);
      setEducation(data.education);
      setProjectIds(data.projectIds);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load site.json");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveTestimonial(t: Testimonial, isNew: boolean) {
    const payload = {
      id: t.id,
      quote: t.quote,
      author: t.author,
      relatedProjectId: t.relatedProjectId || undefined,
      date: t.date,
      verified: t.verified,
      featured: t.featured,
    };
    if (isNew) await createSiteItem("testimonials", payload);
    else await updateSiteItem("testimonials", t.id, payload);
    await load();
    showToast(isNew ? "Testimonial added" : "Testimonial saved");
    setTModal(null);
    setTNew(false);
  }

  async function saveExperience(ex: Experience, isNew: boolean) {
    const links: Record<string, string> = {};
    for (const [k, v] of Object.entries(ex.links)) {
      if (v.trim()) links[k] = v.trim();
    }
    const payload = {
      id: ex.id,
      title: ex.title,
      company: ex.company,
      type: ex.type,
      startYear: ex.startYear,
      endYear: ex.endYear,
      duration: ex.duration,
      location: ex.location,
      description: ex.description,
      highlightBullets: ex.highlightBullets.filter(Boolean),
      techUsed: ex.techUsed,
      keywords: ex.keywords,
      thumbnail: ex.thumbnail,
      logo: ex.logo,
      featured: ex.featured,
      links: Object.keys(links).length ? links : undefined,
    };
    if (isNew) await createSiteItem("experience", payload);
    else await updateSiteItem("experience", ex.id, payload);
    await load();
    showToast(isNew ? "Experience added" : "Experience saved");
    setEModal(null);
    setENew(false);
  }

  async function saveEducation(ed: Education, isNew: boolean) {
    const links: Record<string, string> = {};
    for (const [k, v] of Object.entries(ed.links)) {
      if (v.trim()) links[k] = v.trim();
    }
    const payload = {
      id: ed.id,
      school: ed.school,
      degree: ed.degree,
      field: ed.field,
      startYear: ed.startYear,
      endYear: ed.endYear,
      location: ed.location,
      type: ed.type,
      description: ed.description,
      highlightBullets: ed.highlightBullets.filter(Boolean),
      logo: ed.logo,
      thumbnail: ed.thumbnail,
      diplomaImage: ed.diplomaImage || undefined,
      certificateUrl: ed.certificateUrl && ed.certificateUrl.trim() ? ed.certificateUrl : null,
      links: Object.keys(links).length ? links : undefined,
    };
    if (isNew) await createSiteItem("education", payload);
    else await updateSiteItem("education", ed.id, payload);
    await load();
    showToast(isNew ? "Education added" : "Education saved");
    setEdModal(null);
    setEdNew(false);
  }

  return (
    <section className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-1 rounded-lg border border-border-subtle bg-surface-raised p-1">
        {(
          [
            ["testimonials", "Testimonials"],
            ["experience", "Experience"],
            ["education", "Education"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSub(id)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              sub === id
                ? "bg-surface-overlay text-brand shadow-sm"
                : "text-brand-dim hover:text-brand"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {err ? (
        <p className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">
          {err}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-brand-dim">Loading site.json…</p>
      ) : sub === "testimonials" ? (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setTNew(true);
                setTModal(emptyTestimonial());
              }}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-surface hover:bg-accent-muted"
            >
              New testimonial
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {testimonials.map((raw) => {
              const t = testimonialFromUnknown(raw);
              return (
                <li
                  key={t.id}
                  className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface-raised px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{t.author.name || t.id}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-brand-dim">{t.quote}</p>
                    <p className="mt-1 font-mono text-[11px] text-brand-dim">{t.date}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTNew(false);
                        setTModal(t);
                      }}
                      className="rounded-lg border border-border-subtle px-3 py-1.5 text-sm hover:bg-surface-overlay"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDel({
                          col: "testimonials",
                          id: t.id,
                          label: t.author.name || t.id,
                        })
                      }
                      className="rounded-lg px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/40"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : sub === "experience" ? (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setENew(true);
                setEModal(emptyExperience());
              }}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-surface hover:bg-accent-muted"
            >
              New experience
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {experience.map((raw) => {
              const ex = experienceFromUnknown(raw);
              return (
                <li
                  key={ex.id}
                  className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface-raised px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {ex.title} · {ex.company}
                    </p>
                    <p className="text-sm text-brand-dim">{ex.duration}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setENew(false);
                        setEModal(ex);
                      }}
                      className="rounded-lg border border-border-subtle px-3 py-1.5 text-sm hover:bg-surface-overlay"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDel({ col: "experience", id: ex.id, label: ex.company })
                      }
                      className="rounded-lg px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/40"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setEdNew(true);
                setEdModal(emptyEducation());
              }}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-surface hover:bg-accent-muted"
            >
              New education
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {education.map((raw) => {
              const ed = educationFromUnknown(raw);
              return (
                <li
                  key={ed.id}
                  className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface-raised px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{ed.school}</p>
                    <p className="text-sm text-brand-dim">
                      {ed.degree} · {ed.field}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEdNew(false);
                        setEdModal(ed);
                      }}
                      className="rounded-lg border border-border-subtle px-3 py-1.5 text-sm hover:bg-surface-overlay"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDel({ col: "education", id: ed.id, label: ed.school })
                      }
                      className="rounded-lg px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/40"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {tModal ? (
        <TestimonialModal
          value={tModal}
          isNew={tNew}
          projectIds={projectIds}
          onClose={() => {
            setTModal(null);
            setTNew(false);
          }}
          onSave={(t) => saveTestimonial(t, tNew)}
        />
      ) : null}

      {eModal ? (
        <ExperienceModal
          value={eModal}
          isNew={eNew}
          onClose={() => {
            setEModal(null);
            setENew(false);
          }}
          onSave={(ex) => saveExperience(ex, eNew)}
        />
      ) : null}

      {edModal ? (
        <EducationModal
          value={edModal}
          isNew={edNew}
          onClose={() => {
            setEdModal(null);
            setEdNew(false);
          }}
          onSave={(ed) => saveEducation(ed, edNew)}
        />
      ) : null}

      {del ? (
        <ConfirmModal
          title="Delete from site.json?"
          body={`Remove “${del.label}” (${del.col})? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setDel(null)}
          onConfirm={async () => {
            try {
              await deleteSiteItem(del.col, del.id);
              await load();
              showToast("Removed");
            } catch (e) {
              showToast(e instanceof Error ? e.message : "Delete failed");
            } finally {
              setDel(null);
            }
          }}
        />
      ) : null}
    </section>
  );
}

function TestimonialModal({
  value,
  isNew,
  projectIds,
  onClose,
  onSave,
}: {
  value: Testimonial;
  isNew: boolean;
  projectIds: string[];
  onClose: () => void;
  onSave: (t: Testimonial) => void | Promise<void>;
}) {
  const [t, setT] = useState(value);
  const [busy, setBusy] = useState(false);
  useEffect(() => setT(value), [value]);

  return (
    <Modal title={isNew ? "New testimonial" : "Edit testimonial"} onClose={onClose} wide>
      <div className="flex max-h-[min(75vh,620px)] flex-col gap-3 overflow-y-auto pr-1">
        <FormField
          label="ID"
          value={t.id}
          disabled={!isNew}
          mono
          onChange={(id) => setT((x) => ({ ...x, id }))}
        />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-brand-dim">Quote</span>
          <textarea
            value={t.quote}
            onChange={(e) => setT((x) => ({ ...x, quote: e.target.value }))}
            rows={4}
            className="input-base resize-y text-sm"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label="Author name"
            value={t.author.name}
            onChange={(name) => setT((x) => ({ ...x, author: { ...x.author, name } }))}
          />
          <FormField
            label="Author title"
            value={t.author.title}
            onChange={(title) => setT((x) => ({ ...x, author: { ...x.author, title } }))}
          />
          <FormField
            label="Company"
            value={t.author.company}
            onChange={(company) => setT((x) => ({ ...x, author: { ...x.author, company } }))}
          />
          <FormField
            label="Date"
            value={t.date}
            onChange={(date) => setT((x) => ({ ...x, date }))}
          />
        </div>
        <ImageUploadField
          label="Avatar"
          category="testimonial"
          value={t.author.avatar}
          onChange={(avatar) => setT((x) => ({ ...x, author: { ...x.author, avatar } }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label="LinkedIn URL"
            value={t.author.linkedin}
            onChange={(linkedin) => setT((x) => ({ ...x, author: { ...x.author, linkedin } }))}
          />
          <FormField
            label="Company URL"
            value={t.author.companyUrl}
            onChange={(companyUrl) => setT((x) => ({ ...x, author: { ...x.author, companyUrl } }))}
          />
        </div>
        <ImageUploadField
          label="Company logo"
          category="testimonial"
          value={t.author.companyLogo}
          onChange={(companyLogo) => setT((x) => ({ ...x, author: { ...x.author, companyLogo } }))}
        />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-brand-dim">
            Related project
          </span>
          <select
            value={t.relatedProjectId}
            onChange={(e) => setT((x) => ({ ...x, relatedProjectId: e.target.value }))}
            className="input-base text-sm"
          >
            <option value="">— None —</option>
            {projectIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={t.verified}
            onChange={(e) => setT((x) => ({ ...x, verified: e.target.checked }))}
          />
          Verified
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={t.featured}
            onChange={(e) => setT((x) => ({ ...x, featured: e.target.checked }))}
          />
          Featured
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
          disabled={busy || !t.id.trim() || !t.quote.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(t);
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

function ExperienceModal({
  value,
  isNew,
  onClose,
  onSave,
}: {
  value: Experience;
  isNew: boolean;
  onClose: () => void;
  onSave: (ex: Experience) => void | Promise<void>;
}) {
  const [ex, setEx] = useState(value);
  const [bullets, setBullets] = useState(value.highlightBullets.join("\n"));
  const [tech, setTech] = useState(value.techUsed.join(", "));
  const [kw, setKw] = useState(value.keywords.join(", "));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEx(value);
    setBullets(value.highlightBullets.join("\n"));
    setTech(value.techUsed.join(", "));
    setKw(value.keywords.join(", "));
  }, [value]);

  function build(): Experience {
    return {
      ...ex,
      highlightBullets: bullets
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      techUsed: tech
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      keywords: kw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  return (
    <Modal title={isNew ? "New experience" : "Edit experience"} onClose={onClose} wide>
      <div className="flex max-h-[min(78vh,680px)] flex-col gap-3 overflow-y-auto pr-1">
        <FormField
          label="ID"
          value={ex.id}
          disabled={!isNew}
          mono
          onChange={(id) => setEx((x) => ({ ...x, id }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Title" value={ex.title} onChange={(title) => setEx((x) => ({ ...x, title }))} />
          <FormField
            label="Company"
            value={ex.company}
            onChange={(company) => setEx((x) => ({ ...x, company }))}
          />
          <FormField label="Type" value={ex.type} onChange={(type) => setEx((x) => ({ ...x, type }))} />
          <FormField
            label="Duration label"
            value={ex.duration}
            onChange={(duration) => setEx((x) => ({ ...x, duration }))}
          />
          <FormField
            label="Start year"
            value={ex.startYear === null ? "" : String(ex.startYear)}
            onChange={(s) =>
              setEx((x) => ({ ...x, startYear: s.trim() ? Number.parseInt(s, 10) : null }))
            }
          />
          <FormField
            label="End year (empty = present)"
            value={ex.endYear === null ? "" : String(ex.endYear)}
            onChange={(s) =>
              setEx((x) => ({
                ...x,
                endYear: s.trim() ? Number.parseInt(s, 10) : null,
              }))
            }
          />
          <FormField
            label="Location"
            value={ex.location}
            onChange={(location) => setEx((x) => ({ ...x, location }))}
          />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-brand-dim">
            Description
          </span>
          <textarea
            value={ex.description}
            onChange={(e) => setEx((x) => ({ ...x, description: e.target.value }))}
            rows={3}
            className="input-base resize-y text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-brand-dim">
            Highlight bullets (one per line)
          </span>
          <textarea
            value={bullets}
            onChange={(e) => setBullets(e.target.value)}
            rows={4}
            className="input-base resize-y font-mono text-xs"
          />
        </label>
        <FormField
          label="Tech used (comma-separated)"
          value={tech}
          onChange={setTech}
        />
        <FormField label="Keywords (comma-separated)" value={kw} onChange={setKw} />
        <ImageUploadField
          label="Thumbnail"
          category="experience"
          value={ex.thumbnail}
          onChange={(thumbnail) => setEx((x) => ({ ...x, thumbnail }))}
        />
        <ImageUploadField
          label="Logo"
          category="experience"
          value={ex.logo}
          onChange={(logo) => setEx((x) => ({ ...x, logo }))}
        />
        <p className="text-xs font-medium uppercase tracking-wider text-brand-dim">Links</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["companySite", "caseStudy", "projectDemo", "certificate"] as const).map((key) => (
            <FormField
              key={key}
              label={key}
              value={ex.links[key] ?? ""}
              onChange={(v) => setEx((x) => ({ ...x, links: { ...x.links, [key]: v } }))}
            />
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ex.featured}
            onChange={(e) => setEx((x) => ({ ...x, featured: e.target.checked }))}
          />
          Featured
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
          disabled={busy || !ex.id.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(build());
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

function EducationModal({
  value,
  isNew,
  onClose,
  onSave,
}: {
  value: Education;
  isNew: boolean;
  onClose: () => void;
  onSave: (ed: Education) => void | Promise<void>;
}) {
  const [ed, setEd] = useState(value);
  const [bullets, setBullets] = useState(value.highlightBullets.join("\n"));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEd(value);
    setBullets(value.highlightBullets.join("\n"));
  }, [value]);

  function build(): Education {
    return {
      ...ed,
      highlightBullets: bullets
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  return (
    <Modal title={isNew ? "New education" : "Edit education"} onClose={onClose} wide>
      <div className="flex max-h-[min(78vh,680px)] flex-col gap-3 overflow-y-auto pr-1">
        <FormField
          label="ID"
          value={ed.id}
          disabled={!isNew}
          mono
          onChange={(id) => setEd((x) => ({ ...x, id }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label="School"
            value={ed.school}
            onChange={(school) => setEd((x) => ({ ...x, school }))}
          />
          <FormField
            label="Degree"
            value={ed.degree}
            onChange={(degree) => setEd((x) => ({ ...x, degree }))}
          />
          <FormField label="Field" value={ed.field} onChange={(field) => setEd((x) => ({ ...x, field }))} />
          <FormField label="Type" value={ed.type} onChange={(type) => setEd((x) => ({ ...x, type }))} />
          <FormField
            label="Location"
            value={ed.location}
            onChange={(location) => setEd((x) => ({ ...x, location }))}
          />
          <FormField
            label="Start year"
            value={ed.startYear === null ? "" : String(ed.startYear)}
            onChange={(s) =>
              setEd((x) => ({ ...x, startYear: s.trim() ? Number.parseInt(s, 10) : null }))
            }
          />
          <FormField
            label="End year"
            value={ed.endYear === null ? "" : String(ed.endYear)}
            onChange={(s) =>
              setEd((x) => ({ ...x, endYear: s.trim() ? Number.parseInt(s, 10) : null }))
            }
          />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-brand-dim">
            Description
          </span>
          <textarea
            value={ed.description}
            onChange={(e) => setEd((x) => ({ ...x, description: e.target.value }))}
            rows={3}
            className="input-base resize-y text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-brand-dim">
            Highlight bullets (one per line)
          </span>
          <textarea
            value={bullets}
            onChange={(e) => setBullets(e.target.value)}
            rows={3}
            className="input-base resize-y font-mono text-xs"
          />
        </label>
        <ImageUploadField
          label="Logo"
          category="education"
          value={ed.logo}
          onChange={(logo) => setEd((x) => ({ ...x, logo }))}
        />
        <ImageUploadField
          label="Thumbnail"
          category="education"
          value={ed.thumbnail}
          onChange={(thumbnail) => setEd((x) => ({ ...x, thumbnail }))}
        />
        <ImageUploadField
          label="Diploma image"
          category="education"
          value={ed.diplomaImage}
          onChange={(diplomaImage) => setEd((x) => ({ ...x, diplomaImage }))}
        />
        <FormField
          label="Certificate URL (optional)"
          value={ed.certificateUrl ?? ""}
          onChange={(certificateUrl) =>
            setEd((x) => ({ ...x, certificateUrl: certificateUrl.trim() || null }))
          }
        />
        <FormField
          label="School site"
          value={ed.links.schoolSite ?? ""}
          onChange={(v) => setEd((x) => ({ ...x, links: { ...x.links, schoolSite: v } }))}
        />
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
          disabled={busy || !ed.id.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(build());
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
