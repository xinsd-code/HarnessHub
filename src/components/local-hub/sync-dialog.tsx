import { Loader2, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { KindBadge } from "@/components/shared/kind-badge";
import { api } from "@/lib/invoke";
import type { Extension, ExtensionKind } from "@/lib/types";
import { useHubStore } from "@/stores/hub-store";
import { toast } from "@/stores/toast-store";

interface SyncDialogProps {
  open: boolean;
  onClose: () => void;
}

const tabOrder: Array<{ key: "all" | ExtensionKind; label: string }> = [
  { key: "all", label: "All" },
  { key: "skill", label: "Skills" },
  { key: "mcp", label: "MCP" },
];
const syncableKinds = new Set<ExtensionKind>(["skill", "mcp"]);
const MAX_VISIBLE_SYNC_ROWS = 10;

export function SyncDialog({ open, onClose }: SyncDialogProps) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [toSync, setToSync] = useState<Extension[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | ExtensionKind>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fetch = useHubStore((s) => s.fetch);

  useEffect(() => {
    if (open) {
      setPreviewFailed(false);
      setActiveTab("all");
      setLoading(true);
      api
        .previewSyncToHub()
        .then((result) => {
          const syncableExtensions = result.to_sync.filter((extension) =>
            syncableKinds.has(extension.kind),
          );
          setToSync(syncableExtensions);
          // Select all non-conflict extensions by default
          setSelectedIds(new Set(syncableExtensions.map((e) => e.id)));
        })
        .catch((e) => {
          setPreviewFailed(true);
          console.error("Failed to preview sync:", e);
          toast.error("Failed to preview sync");
        })
        .finally(() => setLoading(false));
    }
  }, [open]);

  const handleSync = async () => {
    if (selectedIds.size === 0) return;

    setSyncing(true);
    try {
      const ids = [...selectedIds];
      const synced = await api.syncExtensionsToHub(ids);
      toast.success(`Synced ${synced.length} extension(s) to Exts Hub`);
      await fetch();
      onClose();
    } catch (e) {
      console.error("Sync failed:", e);
      toast.error("Failed to sync extensions");
    } finally {
      setSyncing(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    setSelectedIds(new Set(toSync.map((e) => e.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const visibleExtensions = useMemo(
    () =>
      activeTab === "all"
        ? toSync
        : toSync.filter((ext) => ext.kind === activeTab),
    [activeTab, toSync],
  );
  const totalCount = toSync.length;
  const tabCounts = useMemo(() => {
    const counts = new Map<"all" | ExtensionKind, number>();
    counts.set("all", toSync.length);
    counts.set("skill", toSync.filter((ext) => ext.kind === "skill").length);
    counts.set("mcp", toSync.filter((ext) => ext.kind === "mcp").length);
    return counts;
  }, [toSync]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 px-4 pt-20 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex max-h-[calc(100vh-7rem)] w-[760px] flex-col rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RefreshCw size={16} />
            </div>
            <h3 className="font-semibold text-lg">Sync to Exts Hub</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-accent/80 text-muted-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2
                size={24}
                className="animate-spin text-muted-foreground"
              />
            </div>
          ) : previewFailed ? (
            <div className="text-center py-8 text-muted-foreground">
              Failed to load sync preview. Please retry.
            </div>
          ) : totalCount === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              All extensions are already synced to Exts Hub
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center justify-between">
                <p className="text-sm">
                  Found <strong>{toSync.length}</strong> new extension(s) to
                  sync
                </p>
                {toSync.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-accent"
                    >
                      Select All
                    </button>
                    <button
                      onClick={deselectAll}
                      className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
                    >
                      Deselect All
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-1 pb-3">
                {tabOrder.map((tab) => {
                  const count = tabCounts.get(tab.key) ?? 0;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all shadow-sm ${
                        activeTab === tab.key
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/50 text-muted-foreground border border-border/40 hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      {tab.label} ({count})
                    </button>
                  );
                })}
              </div>

              {visibleExtensions.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest pl-1">
                    {activeTab === "all"
                      ? "New Extensions"
                      : `${tabOrder.find((tab) => tab.key === activeTab)?.label ?? "Extensions"}`}
                  </h4>
                  <div className="overflow-hidden rounded-xl border border-border/50 shadow-sm">
                    <div className="grid grid-cols-[minmax(0,1.4fr)_auto_minmax(0,1fr)] gap-4 border-b border-border/50 bg-muted/40 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">
                      <span>Name</span>
                      <span>Kind</span>
                      <span>Description</span>
                    </div>
                    <div
                      className="overflow-y-auto divide-y divide-border/40 bg-card/40"
                      style={{ maxHeight: `${MAX_VISIBLE_SYNC_ROWS * 68}px` }}
                    >
                      {visibleExtensions.map((ext) => (
                        <label
                          key={ext.id}
                          className="grid cursor-pointer grid-cols-[minmax(0,1.4fr)_auto_minmax(0,1fr)] gap-4 px-5 py-3.5 transition-colors hover:bg-accent/40"
                        >
                          <div className="flex min-w-0 items-start gap-3.5">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(ext.id)}
                              onChange={() => toggleSelection(ext.id)}
                              className="mt-1 h-4 w-4 rounded border-border/60 bg-muted/50 accent-primary transition-all cursor-pointer"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-medium text-foreground/90">
                                {ext.name}
                              </p>
                              {ext.pack && (
                                <p className="truncate text-xs text-muted-foreground/70 font-mono mt-0.5">
                                  {ext.pack}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="pt-0.5">
                            <KindBadge kind={ext.kind} />
                          </div>
                          <p className="truncate text-[13px] text-muted-foreground/80 pt-0.5">
                            {ext.description || "—"}
                          </p>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/50">
                  No extensions in this category need syncing.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border/50 bg-muted/10 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-border/60 bg-card px-5 py-2.5 text-sm font-semibold shadow-sm transition-all hover:bg-accent hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleSync}
            disabled={syncing || selectedIds.size === 0}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary"
          >
            {syncing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                Sync {selectedIds.size > 0 && `(${selectedIds.size})`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
