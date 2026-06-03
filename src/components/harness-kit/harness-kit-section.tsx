import { Blocks, Layers3, Plus, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HarnessKitDetailDrawer } from "@/components/harness-kit/harness-kit-detail-drawer";
import HarnessKitEditor from "@/components/harness-kit/harness-kit-editor";
import { HarnessKitInsertDialog } from "@/components/harness-kit/harness-kit-insert-dialog";
import type { AgentInstallIconItem } from "@/components/shared/agent-install-icon-row";
import type {
  CreateHarnessKitRequest,
  HarnessKitAssets,
  HarnessKitSummary,
  HarnessKitSyncPreview,
  HarnessKitSyncStatus,
  UpdateHarnessKitRequest,
} from "@/lib/types";
import { useAgentConfigTemplateStore } from "@/stores/agent-config-template-store";
import { useAgentStore } from "@/stores/agent-store";
import { useHarnessKitStore } from "@/stores/harness-kit-store";
import { useKitStore } from "@/stores/kit-store";
import { useProjectStore } from "@/stores/project-store";

type NavigateHarnessAsset = {
  kind: "agent-config" | "extensions-kit" | "skill" | "mcp";
  id: string;
  name: string;
};

function defaultProjectRelPath(agentName: string): string {
  const map: Record<string, string> = {
    codex: ".codex/AGENTS.md",
    claude: ".claude/CLAUDE.md",
    gemini: ".gemini/GEMINI.md",
  };
  return map[agentName] ?? "";
}

export function HarnessKitSection({
  onNavigateAsset,
}: {
  onNavigateAsset?: (asset: NavigateHarnessAsset) => void;
}) {
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
  const previewProjectConflicts = useHarnessKitStore(
    (s) => s.previewProjectConflicts,
  );
  const fetchSyncStatuses = useHarnessKitStore((s) => s.fetchSyncStatuses);
  const syncToProject = useHarnessKitStore((s) => s.syncToProject);
  const unsyncFromProject = useHarnessKitStore((s) => s.unsyncFromProject);

  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const projectsLoaded = useProjectStore((s) => s.loaded);

  const agents = useAgentStore((s) => s.agents);
  const agentOrder = useAgentStore((s) => s.agentOrder);
  const fetchAgents = useAgentStore((s) => s.fetch);
  const agentConfigTemplates = useAgentConfigTemplateStore((s) => s.templates);
  const agentConfigTemplatesLoading = useAgentConfigTemplateStore(
    (s) => s.loading,
  );
  const fetchAgentConfigTemplates = useAgentConfigTemplateStore((s) => s.fetch);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKit, setSelectedKit] = useState<HarnessKitSummary | null>(
    null,
  );
  const [kitAssets, setKitAssets] = useState<HarnessKitAssets | null>(null);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedProjectPath, setSelectedProjectPath] = useState("");
  const [syncingAgent, setSyncingAgent] = useState<string | null>(null);
  const [insertDialog, setInsertDialog] = useState<{
    agentName: string;
    harnessKitId: string;
  } | null>(null);
  const [insertPreview, setInsertPreview] =
    useState<HarnessKitSyncPreview | null>(null);
  const [syncStatuses, setSyncStatuses] = useState<HarnessKitSyncStatus[]>([]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  useEffect(() => {
    if (creating) void fetchCandidates();
  }, [creating, fetchCandidates]);

  useEffect(() => {
    if (agents.length === 0) {
      void fetchAgents();
    }
  }, [agents.length, fetchAgents]);

  useEffect(() => {
    if (agentConfigTemplates.length === 0 && !agentConfigTemplatesLoading) {
      void fetchAgentConfigTemplates();
    }
  }, [
    agentConfigTemplates.length,
    agentConfigTemplatesLoading,
    fetchAgentConfigTemplates,
  ]);

  useEffect(() => {
    if (!projectsLoaded) {
      void loadProjects();
    }
  }, [projectsLoaded, loadProjects]);

  useEffect(() => {
    if (!selectedKit || !selectedProjectPath) {
      setSyncStatuses([]);
      return;
    }
    let cancelled = false;
    fetchSyncStatuses({
      harness_kit_id: selectedKit.id,
      project_path: selectedProjectPath,
    })
      .then((statuses) => {
        if (!cancelled) setSyncStatuses(statuses);
      })
      .catch(() => {
        if (!cancelled) setSyncStatuses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedKit, selectedProjectPath, fetchSyncStatuses]);

  const filteredKits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return harnessKits;
    return harnessKits.filter((kit) => kit.name.toLowerCase().includes(q));
  }, [harnessKits, searchQuery]);

  const agentConfigOriginalNames = useMemo(
    () =>
      new Map(
        agentConfigTemplates.map((template) => [
          template.id,
          template.original_file_name,
        ]),
      ),
    [agentConfigTemplates],
  );

  const loadExtensionKitAssets = useCallback(
    async (id: string): Promise<HarnessKitAssets> => {
      const extra_assets = await useKitStore.getState().fetchKitAssets(id);
      return { agent_configs: [], extension_kits: [], extra_assets };
    },
    [],
  );

  const agentItems: AgentInstallIconItem[] = useMemo(() => {
    const selectedKitId = selectedKit?.id;
    if (!selectedProjectPath || !selectedKitId) return [];
    const orderedAgents = [...agents].sort((a, b) => {
      const idx = (name: string) => agentOrder.indexOf(name);
      return (idx(a.name) ?? 99) - (idx(b.name) ?? 99);
    });
    return orderedAgents.map((agent) => {
      const synced = syncStatuses.some(
        (s) => s.target_agent === agent.name && s.synced,
      );
      return {
        name: agent.name,
        title: synced ? `Remove ${agent.name} sync` : `Sync to ${agent.name}`,
        installed: synced,
        pending: syncingAgent === agent.name,
        disabled: !agent.detected,
        onClick: synced
          ? () => {
              if (window.confirm(`Remove Harness Kit from ${agent.name}?`)) {
                setSyncingAgent(agent.name);
                unsyncFromProject({
                  harness_kit_id: selectedKitId,
                  project_path: selectedProjectPath,
                  target_agent: agent.name,
                })
                  .then(() => {
                    setSyncingAgent(null);
                    return fetchSyncStatuses({
                      harness_kit_id: selectedKitId,
                      project_path: selectedProjectPath,
                    });
                  })
                  .then(setSyncStatuses)
                  .catch(() => setSyncingAgent(null));
              }
            }
          : async () => {
              if (agentConfigTemplates.length === 0) {
                await fetchAgentConfigTemplates();
              }
              setInsertDialog({
                agentName: agent.name,
                harnessKitId: selectedKitId,
              });
              setInsertPreview(null);
            },
      };
    });
  }, [
    agents,
    agentOrder,
    agentConfigTemplates.length,
    fetchAgentConfigTemplates,
    selectedProjectPath,
    syncStatuses,
    syncingAgent,
    selectedKit,
    fetchSyncStatuses,
    unsyncFromProject,
  ]);

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

  const handleUpdate = async (request: Omit<UpdateHarnessKitRequest, "id">) => {
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
    <div className="space-y-6 px-6 pt-6 pb-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/80">
            Harness Kit
          </h2>
          <p className="mt-1.5 text-[14px] text-muted-foreground/80 leading-relaxed">
            将 Agent Config、Extensions Kit、Skill 和 MCP 组合为可追踪的 Harness
            Kit，其中 Skill 和 MCP 将同步至 Exts Hub。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-primary/20 bg-card px-4 py-2 text-xs font-bold text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md hover:shadow-primary/5 active:scale-[0.98]"
        >
          <Plus size={14} className="text-primary stroke-[2.5]" />
          New Harness Kit
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1 group">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors group-focus-within:text-primary"
          />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-card/45 pl-10 pr-4 text-sm shadow-sm outline-none backdrop-blur-md transition-all duration-200 focus:border-primary/45 focus:bg-card focus:ring-4 focus:ring-primary/10"
            placeholder="Search harness kits by name..."
          />
        </div>
        <span className="ml-auto pl-4 text-xs font-semibold text-muted-foreground/70 tracking-wide uppercase shrink-0">
          {filteredKits.length}{" "}
          {filteredKits.length === 1 ? "result" : "results"}
        </span>
      </div>

      {loading && filteredKits.length === 0 ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-border bg-card/75 p-12 text-center text-sm text-muted-foreground shadow-sm backdrop-blur-sm animate-pulse"
        >
          Loading Harness Kits...
        </div>
      ) : filteredKits.length === 0 ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/10 py-16 px-6 text-center transition-all"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary shadow-sm">
            <Blocks className="h-7 w-7 text-primary/70 stroke-[1.5]" />
          </div>
          <p className="text-sm font-bold text-foreground">
            {searchQuery.trim()
              ? "No Harness Kits found"
              : "No Harness Kits yet"}
          </p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground/80">
            {searchQuery.trim()
              ? "Try adjusting your keywords or search query."
              : "Group your agent assets to deploy them across projects smoothly."}
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-5 inline-flex items-center gap-1 rounded-xl bg-primary/10 hover:bg-primary/15 border border-primary/20 px-4 py-2 text-xs font-bold text-primary transition-all active:scale-95"
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
              className="group relative flex min-h-48 cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/90 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/45 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-[var(--kind-mcp)] to-transparent opacity-85 transition-all duration-300 group-hover:h-[4px]" />
              <div className="absolute right-4 top-4 h-16 w-16 rounded-full bg-primary/6 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

              <div className="relative flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary shadow-inner transition-transform duration-300 group-hover:scale-105">
                      <Layers3 size={20} className="stroke-[1.5]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-foreground tracking-tight transition-colors duration-200 group-hover:text-primary">
                        {kit.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 min-h-[36px] text-xs leading-relaxed text-muted-foreground/80">
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
                    className="rounded-lg p-2 text-muted-foreground/60 opacity-0 transform scale-90 translate-x-1 transition-all duration-300 hover:bg-destructive/15 hover:text-destructive hover:scale-105 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-x-0"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="mt-auto flex flex-wrap gap-2 pt-5 text-[10px] font-bold tracking-wide">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-primary">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/80 shrink-0" />
                    Agent Config {kit.agent_config_count}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-primary">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/80 shrink-0" />
                    Extensions Kit {kit.extensions_kit_count}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-primary">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/80 shrink-0" />
                    Skills {kit.skills_count}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-primary">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/80 shrink-0" />
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
                  将 Agent Config、Extensions Kit、Skill 和 MCP 组合为可追踪的
                  Harness Kit，其中 Skill 和 MCP 将同步至 Exts Hub。
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
            className="absolute inset-0 z-40 cursor-default bg-transparent"
            onClick={closeDetails}
          />
          <HarnessKitDetailDrawer
            harnessKit={selectedKit}
            assets={kitAssets}
            loading={loadingAssets}
            editing={editing}
            onEdit={() => void startEditing()}
            onClose={closeDetails}
            onNavigateAsset={onNavigateAsset}
            projects={projects}
            selectedProjectPath={selectedProjectPath}
            onProjectChange={setSelectedProjectPath}
            agentItems={agentItems}
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

      {/* Insert dialog */}
      {insertDialog &&
        selectedKit &&
        kitAssets &&
        (() => {
          const project = projects.find((p) => p.path === selectedProjectPath);
          return (
            <HarnessKitInsertDialog
              projectName={project?.name ?? selectedProjectPath}
              projectPath={selectedProjectPath}
              targetAgent={insertDialog.agentName}
              agentConfigs={kitAssets.agent_configs.map((c) => ({
                template_id: c.template_id,
                template_name: c.template_name,
                original_file_name: agentConfigOriginalNames.get(c.template_id),
              }))}
              preview={insertPreview}
              defaultRelPath={defaultProjectRelPath(insertDialog.agentName)}
              pending={syncingAgent === insertDialog.agentName}
              onPreview={async (paths) => {
                const preview = await previewProjectConflicts({
                  harness_kit_id: insertDialog.harnessKitId,
                  project_path: selectedProjectPath,
                  target_agent: insertDialog.agentName,
                  agent_config_paths: paths,
                });
                setInsertPreview(preview);
              }}
              onConfirm={async ({
                paths,
                forceHubExtensionIds,
                forceAgentConfigTemplateIds,
              }) => {
                setSyncingAgent(insertDialog.agentName);
                try {
                  await syncToProject({
                    harness_kit_id: insertDialog.harnessKitId,
                    project_path: selectedProjectPath,
                    target_agent: insertDialog.agentName,
                    agent_config_paths: paths,
                    force_hub_extension_ids: forceHubExtensionIds,
                    force_agent_config_template_ids:
                      forceAgentConfigTemplateIds,
                  });
                  setInsertDialog(null);
                  setInsertPreview(null);
                  const statuses = await fetchSyncStatuses({
                    harness_kit_id: insertDialog.harnessKitId,
                    project_path: selectedProjectPath,
                  });
                  setSyncStatuses(statuses);
                } finally {
                  setSyncingAgent(null);
                }
              }}
              onCancel={() => {
                setInsertDialog(null);
                setInsertPreview(null);
              }}
            />
          );
        })()}
    </div>
  );
}
