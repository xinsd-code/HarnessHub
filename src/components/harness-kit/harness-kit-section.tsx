import {
  Blocks,
  FileText,
  Layers3,
  Plus,
  Search,
  Server,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { HarnessKitDetailDrawer } from "@/components/harness-kit/harness-kit-detail-drawer";
import HarnessKitEditor from "@/components/harness-kit/harness-kit-editor";
import type {
  CreateHarnessKitRequest,
  HarnessKitAssets,
  HarnessKitSummary,
  UpdateHarnessKitRequest,
} from "@/lib/types";
import { useHarnessKitStore } from "@/stores/harness-kit-store";
import { useKitStore } from "@/stores/kit-store";

export function HarnessKitSection() {
  const harnessKits = useHarnessKitStore((s) => s.harnessKits);
  const candidates = useHarnessKitStore((s) => s.candidates);
  const loading = useHarnessKitStore((s) => s.loading);
  const candidateLoading = useHarnessKitStore((s) => s.candidateLoading);
  const fetch = useHarnessKitStore((s) => s.fetch);
  const fetchCandidates = useHarnessKitStore((s) => s.fetchCandidates);
  const createHarnessKit = useHarnessKitStore((s) => s.createHarnessKit);
  const updateHarnessKit = useHarnessKitStore((s) => s.updateHarnessKit);
  const deleteHarnessKit = useHarnessKitStore((s) => s.deleteHarnessKit);
  const fetchHarnessKitAssets = useHarnessKitStore(
    (s) => s.fetchHarnessKitAssets,
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKit, setSelectedKit] = useState<HarnessKitSummary | null>(
    null,
  );
  const [kitAssets, setKitAssets] = useState<HarnessKitAssets | null>(null);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  useEffect(() => {
    if (creating) void fetchCandidates();
  }, [creating, fetchCandidates]);

  const filteredKits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return harnessKits;
    return harnessKits.filter((kit) => kit.name.toLowerCase().includes(q));
  }, [harnessKits, searchQuery]);

  const loadExtensionKitAssets = async (
    id: string,
  ): Promise<HarnessKitAssets> => {
    const extra_assets = await useKitStore.getState().fetchKitAssets(id);
    return { agent_configs: [], extension_kits: [], extra_assets };
  };

  const openKitDetails = async (kit: HarnessKitSummary) => {
    setSelectedKit(kit);
    setKitAssets(null);
    setLoadingAssets(true);
    setEditing(false);
    try {
      const assets = await fetchHarnessKitAssets(kit.id);
      setKitAssets(assets);
    } finally {
      setLoadingAssets(false);
    }
  };

  const closeDetails = () => {
    setSelectedKit(null);
    setKitAssets(null);
    setEditing(false);
  };

  const startEditing = async () => {
    if (!selectedKit) return;
    await fetchCandidates();
    // Ensure we have the latest assets loaded
    if (!kitAssets) {
      setLoadingAssets(true);
      try {
        const assets = await fetchHarnessKitAssets(selectedKit.id);
        setKitAssets(assets);
      } finally {
        setLoadingAssets(false);
      }
    }
    setEditing(true);
  };

  const handleCreate = async (
    request: Omit<CreateHarnessKitRequest, never>,
  ) => {
    await createHarnessKit(request);
    setCreating(false);
  };

  const handleUpdate = async (
    request: Omit<UpdateHarnessKitRequest, "id">,
  ) => {
    if (!selectedKit) return;
    await updateHarnessKit({ ...request, id: selectedKit.id });
    // Refresh data after update
    const refreshed = useHarnessKitStore
      .getState()
      .harnessKits.find((kit) => kit.id === selectedKit.id);
    if (refreshed) setSelectedKit(refreshed);
    const assets = await fetchHarnessKitAssets(selectedKit.id);
    setKitAssets(assets);
    setEditing(false);
  };

  return (
    <div className="space-y-5 px-6 pt-6 pb-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            Harness Kit
          </h2>
          <p className="mt-1.5 text-[14px] text-muted-foreground/80">
            Combine Agent Configs, Extensions Kits, Skills, and MCP into one
            traceable Harness Kit.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-[12px] font-semibold shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card/90 hover:shadow-md"
        >
          <Plus size={14} className="text-primary" />
          New Harness Kit
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1 group">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors group-focus-within:text-primary"
          />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-10 w-full rounded-xl border border-border/60 bg-card/40 pl-10 pr-4 text-sm shadow-sm outline-none backdrop-blur-sm transition-all focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
            placeholder="Search harness kits by name..."
          />
        </div>
        <span className="ml-auto pl-4 text-sm font-medium text-muted-foreground/80 shrink-0">
          {filteredKits.length}{" "}
          {filteredKits.length === 1 ? "result" : "results"}
        </span>
      </div>

      {loading && filteredKits.length === 0 ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground shadow-sm"
        >
          Loading Harness Kits...
        </div>
      ) : filteredKits.length === 0 ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-16 text-sm text-muted-foreground"
        >
          <Blocks className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <p>
            {searchQuery.trim()
              ? "No Harness Kits found."
              : "No Harness Kits yet."}
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-4 font-medium text-primary hover:underline"
          >
            Create your first Harness Kit
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filteredKits.map((kit) => (
            <article
              key={kit.id}
              onClick={() => void openKitDetails(kit)}
              className="group relative flex min-h-44 cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-xl"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-[var(--kind-mcp)] to-transparent opacity-80" />
              <div className="absolute right-4 top-4 h-16 w-16 rounded-full bg-primary/8 blur-2xl transition-opacity group-hover:opacity-80" />
              <div className="relative flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary shadow-inner">
                      <Layers3 size={21} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-foreground transition-colors group-hover:text-primary">
                        {kit.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">
                        {kit.description || "No description provided."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${kit.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (
                        window.confirm(
                          `Delete ${kit.name}? Harness Kit assets will be preserved.`,
                        )
                      ) {
                        void deleteHarnessKit(kit.id);
                      }
                    }}
                    className="rounded-lg p-2 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="mt-auto flex flex-wrap gap-2 pt-5 text-[11px] font-semibold">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-2.5 py-1 text-foreground shadow-sm">
                    <FileText size={12} className="text-primary" />
                    Agent Config {kit.agent_config_count}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-2.5 py-1 text-foreground shadow-sm">
                    <Layers3 size={12} className="text-primary" />
                    Extensions Kit {kit.extensions_kit_count}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-2.5 py-1 text-foreground shadow-sm">
                    <Blocks size={12} className="text-primary" />
                    Skills {kit.skills_count}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-2.5 py-1 text-foreground shadow-sm">
                    <Server size={12} className="text-primary" />
                    MCP {kit.mcp_count}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create dialog */}
      {creating && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New Harness Kit"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm"
        >
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border bg-muted/20 px-6 py-4">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-foreground">
                  New Harness Kit
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Combine Agent Configs, Extensions Kits, Skills, and MCP into
                  one traceable Harness Kit.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close New Harness Kit"
                onClick={() => setCreating(false)}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
              <HarnessKitEditor
                initialName=""
                initialDescription=""
                candidates={candidates}
                candidateLoading={candidateLoading}
                loadExtensionKitAssets={loadExtensionKitAssets}
                onCancel={() => setCreating(false)}
                onSubmit={handleCreate}
              />
            </div>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {selectedKit && kitAssets && (
        <>
          <button
            type="button"
            aria-label="Close Harness Kit details"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={closeDetails}
          />
          <HarnessKitDetailDrawer
            harnessKit={selectedKit}
            assets={kitAssets}
            loading={loadingAssets}
            editing={editing}
            onEdit={() => void startEditing()}
            onClose={closeDetails}
            editor={
              editing ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
                  <header className="border-b border-border px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Harness Kit
                        </p>
                        <h3 className="mt-1 text-base font-semibold text-foreground">
                          {selectedKit.name}
                        </h3>
                      </div>
                      <button
                        type="button"
                        aria-label="Close details"
                        onClick={closeDetails}
                        className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </header>
                  <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    <HarnessKitEditor
                      initialName={selectedKit.name}
                      initialDescription={selectedKit.description}
                      initialAssets={kitAssets}
                      candidates={candidates}
                      candidateLoading={candidateLoading}
                      loadExtensionKitAssets={loadExtensionKitAssets}
                      onCancel={() => setEditing(false)}
                      onSubmit={handleUpdate}
                    />
                  </div>
                </div>
              ) : null
            }
          />
        </>
      )}
    </div>
  );
}
