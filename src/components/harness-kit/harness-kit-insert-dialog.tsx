import { Blocks, FileText, Loader2, Server, X } from "lucide-react";
import { useCallback, useState } from "react";
import type {
  HarnessKitAgentConfigPath,
  HarnessKitSyncPreview,
} from "@/lib/types";

export type AgentConfigRow = {
  template_id: string;
  template_name: string;
  original_file_name?: string;
};

type Props = {
  projectName: string;
  projectPath: string;
  targetAgent: string;
  agentConfigs: AgentConfigRow[];
  preview: HarnessKitSyncPreview | null;
  defaultRelPath: string;
  pending: boolean;
  onPreview: (paths: HarnessKitAgentConfigPath[]) => Promise<void> | void;
  onConfirm: (request: {
    paths: HarnessKitAgentConfigPath[];
    forceHubExtensionIds: string[];
    forceAgentConfigTemplateIds: string[];
  }) => Promise<void> | void;
  onCancel: () => void;
};

export function HarnessKitInsertDialog({
  projectName,
  projectPath,
  targetAgent,
  agentConfigs,
  preview,
  defaultRelPath,
  pending,
  onPreview,
  onConfirm,
  onCancel,
}: Props) {
  const [paths, setPaths] = useState<HarnessKitAgentConfigPath[]>(
    agentConfigs.map((item) => ({
      template_id: item.template_id,
      rel_path: item.original_file_name ?? defaultRelPath,
    })),
  );
  const [selectedAssetConflicts, setSelectedAssetConflicts] = useState<
    Set<string>
  >(new Set());
  const [selectedConfigConflicts, setSelectedConfigConflicts] = useState<
    Set<string>
  >(new Set());
  const [localError, setLocalError] = useState<string | null>(null);

  const hasPreview = preview !== null;

  const validateUniquePaths = useCallback((): boolean => {
    const values = paths.map((p) => p.rel_path.trim()).filter(Boolean);
    return new Set(values).size === values.length;
  }, [paths]);

  const handlePreview = useCallback(() => {
    if (pending) return;
    setLocalError(null);
    if (!validateUniquePaths()) {
      setLocalError(
        "Config paths must have unique relative paths to avoid overwriting each other.",
      );
      return;
    }
    void onPreview(paths);
  }, [paths, onPreview, pending, validateUniquePaths]);

  const handleConfirm = useCallback(() => {
    if (pending) return;
    const forceHubExtensionIds = Array.from(selectedAssetConflicts);
    const forceAgentConfigTemplateIds = Array.from(selectedConfigConflicts);
    void onConfirm({
      paths,
      forceHubExtensionIds,
      forceAgentConfigTemplateIds,
    });
  }, [
    paths,
    selectedAssetConflicts,
    selectedConfigConflicts,
    onConfirm,
    pending,
  ]);

  const handlePathChange = (templateId: string, relPath: string) => {
    setPaths((prev) =>
      prev.map((p) =>
        p.template_id === templateId ? { ...p, rel_path: relPath } : p,
      ),
    );
    setLocalError(null);
  };

  const toggleAssetConflict = (id: string) => {
    setSelectedAssetConflicts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleConfigConflict = (id: string) => {
    setSelectedConfigConflicts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Insert Harness Kit to Project"
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/20 px-6 py-4">
          <h3 className="text-xl font-bold tracking-tight text-foreground">
            Insert Harness Kit to Project
          </h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
          {/* Info section */}
          <div className="mb-5 space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Project
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {projectName}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {projectPath}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Target Agent
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {targetAgent}
              </p>
            </div>
          </div>

          {/* Config paths */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Agent Config Paths
            </p>
            {agentConfigs.map((config) => (
              <div key={config.template_id} className="space-y-1">
                <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <FileText size={14} className="shrink-0 text-sky-500" />
                  {config.template_name}
                </label>
                <input
                  type="text"
                  value={
                    paths.find((p) => p.template_id === config.template_id)
                      ?.rel_path ?? ""
                  }
                  onChange={(e) =>
                    handlePathChange(config.template_id, e.target.value)
                  }
                  className="h-10 w-full rounded-xl border border-border bg-muted/20 px-3.5 py-2 text-sm outline-none transition-all hover:border-border/80 focus:border-primary/45 focus:bg-background focus:ring-4 focus:ring-primary/10"
                  placeholder="Relative project path..."
                />
              </div>
            ))}
          </div>

          {/* Local error */}
          {localError && (
            <p className="mt-3 text-xs font-medium text-destructive">
              {localError}
            </p>
          )}

          {/* Preview button (before preview) */}
          {!hasPreview && (
            <div className="mt-5">
              <button
                type="button"
                disabled={pending}
                onClick={handlePreview}
                className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
              >
                {pending ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 size={14} className="animate-spin" />
                    Previewing...
                  </span>
                ) : (
                  "Preview"
                )}
              </button>
            </div>
          )}

          {/* After preview: conflicts */}
          {hasPreview && (
            <div className="mt-4 space-y-4 min-h-0 flex-1 overflow-y-auto">
              {/* Asset conflicts */}
              {preview.asset_conflicts.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Asset Conflicts
                  </p>
                  <div className="space-y-1.5">
                    {preview.asset_conflicts.map((conflict) => (
                      <label
                        key={conflict.hub_extension_id}
                        className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAssetConflicts.has(
                            conflict.hub_extension_id,
                          )}
                          onChange={() =>
                            toggleAssetConflict(conflict.hub_extension_id)
                          }
                          className="mt-0.5 rounded border-border accent-primary"
                        />
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="shrink-0 mt-0.5 text-muted-foreground">
                            {conflict.kind === "skill" ? (
                              <Blocks size={14} />
                            ) : (
                              <Server size={14} />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {conflict.asset_name}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {conflict.kind === "skill" ? "Skill" : "MCP"}{" "}
                              already installed — check to force replace
                            </p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Config conflicts */}
              {preview.config_conflicts.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Config Conflicts
                  </p>
                  <div className="space-y-1.5">
                    {preview.config_conflicts.map((conflict) => (
                      <label
                        key={conflict.template_id}
                        className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40"
                      >
                        <input
                          type="checkbox"
                          checked={selectedConfigConflicts.has(
                            conflict.template_id,
                          )}
                          onChange={() =>
                            toggleConfigConflict(conflict.template_id)
                          }
                          className="mt-0.5 rounded border-border accent-primary"
                        />
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="shrink-0 mt-0.5 text-sky-500">
                            <FileText size={14} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {conflict.template_name}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {conflict.rel_path} — {conflict.message}
                            </p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <p className="text-xs text-muted-foreground">
                {preview.installable_asset_count} installable assets,{" "}
                {preview.writable_config_count} writable configs
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
          >
            Cancel
          </button>
          {hasPreview && (
            <button
              type="button"
              disabled={pending}
              onClick={handleConfirm}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            >
              {pending ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin" />
                  Syncing...
                </span>
              ) : (
                "Continue"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
