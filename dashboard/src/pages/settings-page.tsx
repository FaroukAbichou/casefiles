import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  getCloudinaryConfig,
  getDashboardSettings,
  setDashboardToken,
  saveDashboardSettings,
  type DashboardSettings,
} from "@/api";
import type { DashboardOutletContext } from "@/dashboard-context";

export default function SettingsPage() {
  const { showToast } = useOutletContext<DashboardOutletContext>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cloudName, setCloudName] = useState<string | null>(null);
  const [model, setModel] = useState<DashboardSettings>({
    cloudinary: { autoSync: true, folderPrefix: "portfolio-content" },
    security: { dashboardToken: "" },
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [settings, cloudinary] = await Promise.all([
        getDashboardSettings(),
        getCloudinaryConfig(),
      ]);
      setModel(settings);
      setDashboardToken(settings.security.dashboardToken);
      setCloudName(cloudinary.cloudName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      setDashboardToken(model.security.dashboardToken);
      const next = await saveDashboardSettings(model);
      setModel(next);
      setDashboardToken(next.security.dashboardToken);
      showToast("Settings saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading settings...</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Configure dashboard behavior here without editing code or env files.
      </p>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Cloudinary sync</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Cloud name: {cloudName ?? "Not configured"}
        </p>

        <label className="mt-4 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={model.cloudinary.autoSync}
            onChange={(e) =>
              setModel((prev) => ({
                ...prev,
                cloudinary: { ...prev.cloudinary, autoSync: e.target.checked },
              }))
            }
          />
          Auto-sync dashboard writes to Cloudinary
        </label>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-muted-foreground">
            Cloudinary folder prefix
          </label>
          <input
            value={model.cloudinary.folderPrefix}
            onChange={(e) =>
              setModel((prev) => ({
                ...prev,
                cloudinary: {
                  ...prev.cloudinary,
                  folderPrefix: e.target.value,
                },
              }))
            }
            placeholder="portfolio-content"
            className="input-base w-full"
          />
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Dashboard access token</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Optional. If set, requests must include this token in <code>x-dashboard-token</code>.
        </p>
        <input
          type="password"
          value={model.security.dashboardToken}
          onChange={(e) =>
            setModel((prev) => ({
              ...prev,
              security: { ...prev.security, dashboardToken: e.target.value },
            }))
          }
          placeholder="Leave empty to disable token gate"
          className="input-base mt-3 w-full"
        />
      </section>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={load}
          className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm hover:bg-accent"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </div>
  );
}
