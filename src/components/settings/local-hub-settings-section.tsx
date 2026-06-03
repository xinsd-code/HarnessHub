import { clsx } from "clsx";
import {
  FolderSearch,
  Loader2,
  Save,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  openDirectoryPicker,
  PICKER_UNSUPPORTED_MESSAGE,
  selectedPickerPath,
} from "@/lib/platform/dialog";
import { isDesktop } from "@/lib/transport";
import {
  normalizePathForComparison,
  type LocalHubSettings,
} from "@/lib/types";
import { useHubStore } from "@/stores/hub-store";
import { toast } from "@/stores/toast-store";
import { api } from "@/lib/invoke";

type MigrationMode = "migrate" | "empty" | null;

export function LocalHubSettingsSection() {
  const refreshHubSettings = useHubStore((s) => s.refreshHubSettings);
  const refreshHubExtensions = useHubStore((s) => s.fetch);
  const [settings, setSettings] = useState<LocalHubSettings | null>(null);
  const [pathInput, setPathInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingMode, setPendingMode] = useState<MigrationMode>(null);

  useEffect(() => {
    let alive = true;
    void api
      .getLocalHubSettings()
      .then((next) => {
        if (!alive) return;
        setSettings(next);
        setPathInput(next.effective_path);
      })
      .catch((error) => {
        console.error("Failed to load Exts Hub settings:", error);
        toast.error("Failed to load Exts Hub settings");
      });
    return () => {
      alive = false;
    };
  }, []);

  const currentPath = settings?.effective_path ?? "";
  const configuredPath = settings?.configured_path ?? null;

  const hasChanges = useMemo(() => {
    if (!settings) return false;
    return (
      normalizePathForComparison(pathInput) !==
      normalizePathForComparison(currentPath)
    );
  }, [currentPath, pathInput, settings]);

  const handleBrowse = async () => {
    const result = await openDirectoryPicker({
      title: "Select Exts Hub Directory",
    });
    if (result.status === "unsupported") {
      toast.info(PICKER_UNSUPPORTED_MESSAGE);
      return;
    }
    const selected = selectedPickerPath(result);
    if (selected) {
      setPathInput(selected);
    }
  };

  const applyChange = async (migrateAssets: boolean) => {
    if (!settings) return;
    const nextPath = pathInput.trim();
    if (!nextPath) return;
    setSaving(true);
    try {
      const nextSettings = await api.setLocalHubDir(nextPath, migrateAssets);
      setSettings(nextSettings);
      setPathInput(nextSettings.effective_path);
      setShowConfirm(false);
      setPendingMode(null);
      await refreshHubSettings();
      await refreshHubExtensions();
      toast.success(
        migrateAssets
          ? "Exts Hub assets migrated"
          : "Exts Hub directory updated",
      );
    } catch (error) {
      console.error("Failed to update Exts Hub directory:", error);
      toast.error("Failed to update Exts Hub directory");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!hasChanges || !pathInput.trim()) {
      return;
    }
    setPendingMode("empty");
    setShowConfirm(true);
  };

  return (
    <section id="local-hub" className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground tracking-tight">
          Exts Hub
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose where HarnessKit stores shared skills, MCP servers, plugins,
          and agent config templates.
        </p>
      </div>

      <div className="rounded-xl border border-border/40 bg-card/45 p-5 backdrop-blur-xs shadow-xs space-y-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-foreground">
            Hub directory
          </span>
          <p className="text-[11px] text-muted-foreground">
            {configuredPath
              ? "Currently using a custom Exts Hub directory."
              : "Currently using the default Exts Hub directory."}
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="Enter Exts Hub directory"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {isDesktop() && (
            <button
              type="button"
              onClick={handleBrowse}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <FolderSearch size={12} />
              Browse
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasChanges || !pathInput.trim()}
            className={clsx(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
              saving || !hasChanges || !pathInput.trim()
                ? "bg-primary/50 text-primary-foreground/80"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {saving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Save size={12} />
            )}
            Save
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-background/60 p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Effective path
            </div>
            <div className="mt-1 truncate text-xs text-foreground">
              {currentPath || "Loading..."}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/60 p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Default path
            </div>
            <div className="mt-1 truncate text-xs text-foreground">
              {settings?.default_path || "Loading..."}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/60 p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Assets
            </div>
            <div className="mt-1 text-xs text-foreground">
              {settings ? settings.asset_count : "Loading..."}
            </div>
          </div>
        </div>
      </div>

      {showConfirm && settings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!saving) {
              setShowConfirm(false);
              setPendingMode(null);
            }
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-base font-semibold text-foreground">
                  Move Exts Hub assets?
                </h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Change the Exts Hub directory from{" "}
                  <span className="font-medium text-foreground">
                    {currentPath}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium text-foreground">
                    {pathInput.trim()}
                  </span>
                  .
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!saving) {
                    setShowConfirm(false);
                    setPendingMode(null);
                  }
                }}
                className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>

            <p className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
              Migrating will copy the current Exts Hub contents into the new
              directory. Choosing a new empty directory keeps the old assets in
              place and switches the active path immediately.
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setPendingMode(null);
                  setShowConfirm(false);
                }}
                disabled={saving}
                className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingMode("empty");
                  void applyChange(false);
                }}
                disabled={saving}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground transition-colors hover:bg-accent disabled:opacity-40"
              >
                {pendingMode === "empty" && saving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : null}
                Use new empty dir
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingMode("migrate");
                  void applyChange(true);
                }}
                disabled={saving}
                className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
              >
                {pendingMode === "migrate" && saving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : null}
                Migrate assets
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
