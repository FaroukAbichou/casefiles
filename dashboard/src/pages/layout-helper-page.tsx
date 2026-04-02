import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { DashboardOutletContext } from "@/dashboard-context";
import { ConfirmModal } from "@/ui";

type LayoutReport = {
  manifestSlugs: string[];
  folderSlugs: string[];
  flatSlugs: string[];
  duplicates: string[];
  missingInManifest: string[];
  missingFilesForManifest: string[];
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("dashboardToken")?.trim() || "" : "";
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-dashboard-token": token } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error((data as any).error ?? res.statusText);
  return data as T;
}

export default function LayoutHelperPage() {
  const { showToast } = useOutletContext<DashboardOutletContext>();
  const [report, setReport] = useState<LayoutReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [migrate, setMigrate] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await api<LayoutReport>("/api/tools/layout/report");
      setReport(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load layout report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    if (!report) return null;
    return [
      { label: "Manifest slugs", value: report.manifestSlugs.length },
      { label: "Folder case studies", value: report.folderSlugs.length },
      { label: "Flat case studies", value: report.flatSlugs.length },
      { label: "Duplicates", value: report.duplicates.length },
      { label: "Missing in manifest", value: report.missingInManifest.length },
      { label: "Missing files for manifest", value: report.missingFilesForManifest.length },
    ];
  }, [report]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        This checks your <code className="rounded bg-muted px-1 py-0.5 text-xs">portfolio-content</code>{" "}
        layout and highlights mixed case-study formats so it’s easier to keep things consistent.
      </p>

      {err ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {err}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : report ? (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            {summary?.map((s) => (
              <div key={s.label} className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-semibold">{s.value}</p>
              </div>
            ))}
          </div>

          {report.duplicates.length ? (
            <div className="rounded-lg border bg-card p-4">
              <p className="font-medium">Duplicates (flat + folder exist)</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your API prefers the folder file. You can migrate flat → folder to clean up.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {report.duplicates.map((slug) => (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => setMigrate(slug)}
                    className="rounded-md border border-input bg-background px-3 py-1.5 font-mono text-xs hover:bg-accent"
                  >
                    migrate {slug}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {report.missingInManifest.length ? (
            <div className="rounded-lg border bg-card p-4">
              <p className="font-medium">Case studies missing in manifest</p>
              <p className="mt-1 text-sm text-muted-foreground">
                These exist on disk but aren’t listed in <code className="rounded bg-muted px-1 py-0.5 text-xs">case-studies/manifest.json</code>.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {report.missingInManifest.map((slug) => (
                  <span key={slug} className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                    {slug}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={load}
          className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm hover:bg-accent"
        >
          Refresh report
        </button>
      </div>

      {migrate ? (
        <ConfirmModal
          title="Migrate flat case study?"
          body={`This will create case-studies/${migrate}/project.json from case-studies/${migrate}.json (if needed) and remove the flat file. It will also ensure manifest + site.json entry exist.`}
          confirmLabel="Migrate"
          onCancel={() => setMigrate(null)}
          onConfirm={async () => {
            await api(`/api/tools/layout/migrate-flat/${encodeURIComponent(migrate)}`, {
              method: "POST",
            });
            setMigrate(null);
            showToast(`Migrated ${migrate}`);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

