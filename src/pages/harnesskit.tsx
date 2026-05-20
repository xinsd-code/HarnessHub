import {
  ArrowLeft,
  ArrowRight,
  Blocks,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Layers3,
  Pencil,
  Plus,
  Save,
  Search,
  Server,
  Trash2,
  X,
} from "lucide-react";
import type { ElementType } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AgentConfigHubPage } from "@/components/agent-config-hub/agent-config-hub-page";
import { HarnessKitSection } from "@/components/harness-kit/harness-kit-section";
import { ProjectInstallPanel } from "@/components/shared/project-install-panel";
import { canInstallAtScope } from "@/lib/agent-capabilities";
import type {
  ConfigScope,
  Extension,
  ExtensionKind,
  KitAssetCandidate,
  KitSummary,
  KitSyncConflict,
  NewKitAsset,
  Project,
  SyncKitToProjectRequest,
  UpdateKitRequest,
} from "@/lib/types";
import {
  agentDisplayName,
  logicalAssetKey,
  normalizePathForComparison,
  pathsEqual,
  sortAgents,
} from "@/lib/types";
import { useAgentConfigTemplateStore } from "@/stores/agent-config-template-store";
import { useAgentStore } from "@/stores/agent-store";
import { useExtensionStore } from "@/stores/extension-store";
import { useHubStore } from "@/stores/hub-store";
import { useKitStore } from "@/stores/kit-store";
import { useProjectStore } from "@/stores/project-store";

type KitTab = "skill" | "mcp";
type HarnessKitSectionKey = "harness-kit" | "agent-config" | "extensions-kit";

const tabs: Array<{ key: KitTab; label: string; icon: ElementType }> = [
  { key: "skill", label: "Skills", icon: Blocks },
  { key: "mcp", label: "MCP", icon: Server },
];

function countSelected(
  candidates: KitAssetCandidate[],
  selected: Set<string>,
  kind: ExtensionKind,
) {
  return candidates.filter(
    (candidate) => candidate.kind === kind && selected.has(candidate.id),
  ).length;
}

function candidateIdForAsset(
  asset: NewKitAsset,
  candidates: KitAssetCandidate[],
): string | null {
  const matched = candidates.find(
    (candidate) =>
      candidate.hub_extension_id === asset.hub_extension_id ||
      (candidate.kind === asset.kind && candidate.name === asset.asset_name),
  );
  return matched?.id ?? null;
}

function projectScopeForPath(
  projects: Project[],
  projectPath: string,
): ConfigScope | null {
  const project = projects.find((item) => pathsEqual(item.path, projectPath));
  return project
    ? { type: "project", name: project.name, path: project.path }
    : null;
}

function kitProjectAgentKey(kitId: string, projectPath: string, agent: string) {
  return `${kitId}:${normalizePathForComparison(projectPath)}:${agent}`;
}

function isKitSyncedToProjectAgent(
  assets: NewKitAsset[],
  extensions: Extension[],
  projectScope: ConfigScope,
  agent: string,
) {
  if (projectScope.type !== "project" || assets.length === 0) return false;
  return assets.every((asset) =>
    extensions.some(
      (ext) =>
        ext.kind === asset.kind &&
        ext.name === asset.asset_name &&
        ext.agents.includes(agent) &&
        ext.scope.type === "project" &&
        pathsEqual(ext.scope.path, projectScope.path),
    ),
  );
}

function AssetIcon({ kind }: { kind: ExtensionKind }) {
  const Icon = kind === "skill" ? Blocks : kind === "mcp" ? Server : Layers3;
  return <Icon size={15} aria-hidden="true" />;
}

function SourceBadge({
  status,
}: {
  status: KitAssetCandidate["source_status"];
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
      <CheckCircle2 size={10} aria-hidden="true" />
      {status === "in_local_hub" ? "In Hub" : "Will Sync"}
    </span>
  );
}

function AssetRow({
  candidate,
  action,
  onClick,
}: {
  candidate: KitAssetCandidate;
  action: "add" | "remove";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        action === "add"
          ? "group flex min-h-[64px] w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-transparent px-3 py-2.5 text-left transition-all hover:border-primary/25 hover:bg-background hover:shadow-sm"
          : "group flex min-h-[64px] w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-primary/15 bg-background/80 px-3 py-2.5 text-left shadow-sm transition-all hover:border-destructive/30 hover:bg-destructive/5"
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={
              action === "add"
                ? "text-muted-foreground group-hover:text-primary"
                : "text-primary"
            }
          >
            <AssetIcon kind={candidate.kind} />
          </span>
          <span className="truncate text-[13px] font-semibold text-foreground">
            {candidate.name}
          </span>
          {action === "add" && <SourceBadge status={candidate.source_status} />}
        </div>
        <p className="mt-1 max-w-full truncate text-[11px] leading-4 text-muted-foreground">
          {candidate.description || "No description available."}
        </p>
      </div>
      <span
        className={
          action === "add"
            ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 transition-opacity group-hover:opacity-100"
            : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
        }
      >
        {action === "add" ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
      </span>
    </button>
  );
}

function EmptyList({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/45 px-6 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-sm">
        <Layers3 size={20} />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-56 text-xs leading-5 text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
}

export default function HarnessKitPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] =
    useState<HarnessKitSectionKey>("harness-kit");
  const kits = useKitStore((s) => s.kits);
  const candidates = useKitStore((s) => s.candidates);
  const loading = useKitStore((s) => s.loading);
  const candidateLoading = useKitStore((s) => s.candidateLoading);
  const fetch = useKitStore((s) => s.fetch);
  const fetchCandidates = useKitStore((s) => s.fetchCandidates);
  const fetchKitAssets = useKitStore((s) => s.fetchKitAssets);
  const createKit = useKitStore((s) => s.createKit);
  const updateKit = useKitStore((s) => s.updateKit);
  const deleteKit = useKitStore((s) => s.deleteKit);
  const previewKitProjectConflicts = useKitStore(
    (s) => s.previewKitProjectConflicts,
  );
  const syncKitToProject = useKitStore((s) => s.syncKitToProject);
  const unsyncKitFromProject = useKitStore((s) => s.unsyncKitFromProject);
  const agents = useAgentStore((s) => s.agents);
  const agentOrder = useAgentStore((s) => s.agentOrder);
  const fetchAgents = useAgentStore((s) => s.fetch);
  const extensions = useExtensionStore((s) => s.extensions);
  const extensionsLoaded = useExtensionStore((s) => s.hasFetched);
  const fetchExtensions = useExtensionStore((s) => s.fetch);
  const projects = useProjectStore((s) => s.projects);
  const projectsLoaded = useProjectStore((s) => s.loaded);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedKit, setSelectedKit] = useState<KitSummary | null>(null);
  const [kitAssets, setKitAssets] = useState<NewKitAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [editingDetail, setEditingDetail] = useState(false);
  const [syncingAgent, setSyncingAgent] = useState<string | null>(null);
  const [projectAgentInstallOverrides, setProjectAgentInstallOverrides] =
    useState<Map<string, boolean>>(new Map());
  const [kitConflictDialog, setKitConflictDialog] = useState<{
    request: SyncKitToProjectRequest;
    conflicts: KitSyncConflict[];
    selectedIds: Set<string>;
    syncKey: string;
  } | null>(null);
  const [selectedProjectPath, setSelectedProjectPath] = useState("");
  const [searchKitQuery, setSearchKitQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<
    Record<KitTab, boolean>
  >({
    skill: false,
    mcp: false,
  });
  const [activeTab, setActiveTab] = useState<KitTab>("skill");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);
  const [searchAvailable, setSearchAvailable] = useState("");
  const [searchSelected, setSearchSelected] = useState("");

  const handleNavigateHarnessAsset = async (asset: {
    kind: "agent-config" | "extensions-kit" | "skill" | "mcp";
    id: string;
    name: string;
  }) => {
    if (asset.kind === "agent-config") {
      setActiveSection("agent-config");
      useAgentConfigTemplateStore.getState().select(asset.id);
      return;
    }

    if (asset.kind === "extensions-kit") {
      setActiveSection("extensions-kit");
      const targetKit =
        useKitStore.getState().kits.find((kit) => kit.id === asset.id) ?? null;
      if (targetKit) {
        await openKitDetails(targetKit);
      }
      return;
    }

    if (asset.id) {
      useHubStore.getState().setSelectedId(asset.id);
      navigate("/local-hub");
      return;
    }

    useExtensionStore
      .getState()
      .setSelectedId(logicalAssetKey({ kind: asset.kind, name: asset.name }));
    navigate("/extensions");
  };

  useEffect(() => {
    void fetch();
  }, [fetch]);

  useEffect(() => {
    if (showCreate) void fetchCandidates();
  }, [showCreate, fetchCandidates]);

  useEffect(() => {
    if (agents.length === 0) {
      void fetchAgents();
    }
  }, [agents.length, fetchAgents]);

  useEffect(() => {
    if (!extensionsLoaded) {
      void fetchExtensions();
    }
  }, [extensionsLoaded, fetchExtensions]);

  useEffect(() => {
    if (!projectsLoaded) {
      void loadProjects();
    }
  }, [projectsLoaded, loadProjects]);

  const openKitDetails = async (kit: KitSummary) => {
    setSelectedKit(kit);
    setKitAssets([]);
    setLoadingAssets(true);
    setEditingDetail(false);
    setSelectedProjectPath("");
    setFormError(null);
    setExpandedSections({ skill: false, mcp: false });

    try {
      await fetchCandidates();
      const assets = await fetchKitAssets(kit.id);
      setKitAssets(assets);
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleTabChange = (key: KitTab) => {
    setActiveTab(key);
    setSearchAvailable("");
    setSearchSelected("");
  };

  const populateEditorState = (
    kit: KitSummary,
    assets: NewKitAsset[],
    nextCandidates: KitAssetCandidate[],
  ) => {
    setName(kit.name);
    setDescription(kit.description);
    setSelected(
      new Set(
        assets
          .map((asset) => candidateIdForAsset(asset, nextCandidates))
          .filter((candidateId): candidateId is string => Boolean(candidateId)),
      ),
    );
    setActiveTab(
      assets.some((asset) => asset.kind === "skill") ? "skill" : "mcp",
    );
    setSearchAvailable("");
    setSearchSelected("");
    setFormError(null);
  };

  const startEditingDetail = async () => {
    if (!selectedKit) return;
    await fetchCandidates();
    const nextCandidates = useKitStore.getState().candidates;
    populateEditorState(selectedKit, kitAssets, nextCandidates);
    setEditingDetail(true);
  };

  const visibleCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.kind === activeTab),
    [activeTab, candidates],
  );

  const availableFiltered = useMemo(() => {
    const query = searchAvailable.trim().toLowerCase();
    return visibleCandidates.filter((candidate) => {
      if (selected.has(candidate.id)) return false;
      if (!query) return true;
      return candidate.name.toLowerCase().includes(query);
    });
  }, [visibleCandidates, selected, searchAvailable]);

  const selectedFiltered = useMemo(() => {
    const query = searchSelected.trim().toLowerCase();
    return visibleCandidates.filter((candidate) => {
      if (!selected.has(candidate.id)) return false;
      if (!query) return true;
      return candidate.name.toLowerCase().includes(query);
    });
  }, [visibleCandidates, selected, searchSelected]);

  const selectedSummary = `${countSelected(candidates, selected, "skill")} Skills · ${countSelected(candidates, selected, "mcp")} MCP`;
  const availableProjects = projects.filter((project) => project.exists);
  const filteredKits = useMemo(() => {
    const q = searchKitQuery.trim().toLowerCase();
    if (!q) return kits;
    return kits.filter((kit) => kit.name.toLowerCase().includes(q));
  }, [kits, searchKitQuery]);
  const detectedAgents = useMemo(
    () =>
      sortAgents(
        agents.filter((agent) => agent.detected),
        agentOrder,
      ),
    [agents, agentOrder],
  );
  const detailProjectScope = projectScopeForPath(
    availableProjects,
    selectedProjectPath,
  );
  const projectAssetKinds = Array.from(
    new Set(
      kitAssets
        .map((asset) => asset.kind)
        .filter((kind): kind is KitTab => kind === "skill" || kind === "mcp"),
    ),
  );
  const performKitProjectSync = async (
    request: SyncKitToProjectRequest,
    syncKey: string,
  ) => {
    const result = await syncKitToProject(request);
    if (result.skipped_conflict_count === 0) {
      setProjectAgentInstallOverrides((current) => {
        const next = new Map(current);
        next.set(syncKey, true);
        return next;
      });
      await fetchExtensions();
    }
  };
  const projectAgentItems =
    detailProjectScope?.type === "project"
      ? detectedAgents
          .filter((agent) =>
            projectAssetKinds.every((kind) =>
              canInstallAtScope(agent.name, kind, detailProjectScope),
            ),
          )
          .map((agent) => {
            const key = selectedKit
              ? kitProjectAgentKey(
                  selectedKit.id,
                  detailProjectScope.path,
                  agent.name,
                )
              : "";
            const override = projectAgentInstallOverrides.get(key);
            const installed =
              override ??
              isKitSyncedToProjectAgent(
                kitAssets,
                extensions,
                detailProjectScope,
                agent.name,
              );
            return {
              name: agent.name,
              installed,
              pending: syncingAgent === agent.name,
              title: installed
                ? `${agentDisplayName(agent.name)} · Remove Kit from project`
                : `Sync Kit to ${agentDisplayName(agent.name)}`,
              onClick: async () => {
                if (!selectedKit || detailProjectScope.type !== "project")
                  return;
                const request = {
                  kit_id: selectedKit.id,
                  project_path: detailProjectScope.path,
                  target_agent: agent.name,
                };
                setSyncingAgent(agent.name);
                try {
                  if (installed) {
                    await unsyncKitFromProject(request);
                    setProjectAgentInstallOverrides((current) => {
                      const next = new Map(current);
                      next.set(key, false);
                      return next;
                    });
                    await fetchExtensions();
                  } else {
                    const preview = await previewKitProjectConflicts(request);
                    if (preview.conflicts.length > 0) {
                      setKitConflictDialog({
                        request,
                        conflicts: preview.conflicts,
                        selectedIds: new Set(),
                        syncKey: key,
                      });
                      return;
                    }
                    await performKitProjectSync(request, key);
                  }
                } finally {
                  setSyncingAgent(null);
                }
              },
            };
          })
      : [];

  const resetForm = () => {
    setName("");
    setDescription("");
    setSelected(new Set());
    setActiveTab("skill");
    setSearchAvailable("");
    setSearchSelected("");
    setFormError(null);
  };

  const submit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Kit name is required");
      return;
    }
    if (selected.size === 0) {
      setFormError("Select at least one asset");
      return;
    }
    await createKit({
      name: trimmedName,
      description: description.trim(),
      candidate_ids: Array.from(selected),
    });
    resetForm();
    setShowCreate(false);
  };

  const submitDetailUpdate = async () => {
    if (!selectedKit) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Kit name is required");
      return;
    }
    if (selected.size === 0) {
      setFormError("Select at least one asset");
      return;
    }

    await updateKit({
      id: selectedKit.id,
      name: trimmedName,
      description: description.trim(),
      candidate_ids: Array.from(selected),
    } satisfies UpdateKitRequest);
    await fetchCandidates();
    const assets = await fetchKitAssets(selectedKit.id);
    setKitAssets(assets);
    const refreshed = useKitStore
      .getState()
      .kits.find((kit) => kit.id === selectedKit.id);
    if (refreshed) {
      setSelectedKit(refreshed);
    }
    setEditingDetail(false);
    setFormError(null);
  };

  function ExtensionsKitContent() {
    return (
      <main className="min-w-0 flex-1 min-h-0 space-y-5 px-6 pt-6 pb-4">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Extensions Kit
            </h2>
            <p className="mt-1.5 text-[14px] text-muted-foreground/80">
              一个组合的 Skills、MCP，形成可追溯的 Kit 清单。保存前自动把未在
              Local Hub 的资产同步进去。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-[12px] font-semibold shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card/90 hover:shadow-md"
          >
            <Plus size={14} className="text-primary" />
            New Extensions Kit
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-64 flex-1 group">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors group-focus-within:text-primary"
            />
            <input
              value={searchKitQuery}
              onChange={(event) => setSearchKitQuery(event.target.value)}
              className="h-10 w-full rounded-xl border border-border/60 bg-card/40 pl-10 pr-4 text-sm shadow-sm outline-none backdrop-blur-sm transition-all focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
              placeholder="Search kits by name..."
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
            Loading Kits...
          </div>
        ) : filteredKits.length === 0 ? (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-16 text-sm text-muted-foreground"
          >
            <Blocks className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <p>{searchKitQuery.trim() ? "No Kits found." : "No Kits yet."}</p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-4 font-medium text-primary hover:underline"
            >
              Create your first Kit
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
                            `Delete ${kit.name}? Local Hub assets will be preserved.`,
                          )
                        ) {
                          void deleteKit(kit.id);
                        }
                      }}
                      className="rounded-lg p-2 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2 pt-5 text-[11px] font-semibold">
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
      </main>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 gap-5 relative overflow-hidden">
      <aside className="w-44 shrink-0 border-r border-border pr-3">
        <div className="mb-3 px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          HarnessKit
        </div>
        <button
          type="button"
          onClick={() => setActiveSection("harness-kit")}
          className={
            activeSection === "harness-kit"
              ? "w-full rounded-lg bg-accent px-3 py-2 text-left text-sm font-semibold text-foreground shadow-sm"
              : "w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          }
        >
          Harness Kit
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("agent-config")}
          className={
            activeSection === "agent-config"
              ? "mt-1 w-full rounded-lg bg-accent px-3 py-2 text-left text-sm font-semibold text-foreground shadow-sm"
              : "mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          }
        >
          Agent Config
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("extensions-kit")}
          className={
            activeSection === "extensions-kit"
              ? "mt-1 w-full rounded-lg bg-accent px-3 py-2 text-left text-sm font-semibold text-foreground shadow-sm"
              : "mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          }
        >
          Extensions Kit
        </button>
      </aside>

      {activeSection === "harness-kit" ? (
        <main className="min-w-0 flex-1 min-h-0 pb-4 relative overflow-hidden">
          <HarnessKitSection onNavigateAsset={handleNavigateHarnessAsset} />
        </main>
      ) : activeSection === "agent-config" ? (
        <main className="min-w-0 flex-1 min-h-0 pb-4 relative overflow-hidden">
          <AgentConfigHubPage />
        </main>
      ) : (
        <ExtensionsKitContent />
      )}

      {showCreate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New Extensions Kit"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm"
        >
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border bg-muted/20 px-6 py-4">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-foreground">
                  New Extensions Kit
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Combine Skills and MCP assets into one traceable Extensions
                  Kit.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close New Kit"
                onClick={() => {
                  resetForm();
                  setShowCreate(false);
                }}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden p-6">
              <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                <label className="grid gap-1.5 text-sm font-semibold">
                  <span className="text-foreground/90">Kit Name</span>
                  <input
                    aria-label="Kit name"
                    value={name}
                    placeholder="e.g. Data Analysis Kit"
                    onChange={(event) => setName(event.target.value)}
                    className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                  <span className="text-foreground/90">Description</span>
                  <input
                    aria-label="Description"
                    value={description}
                    placeholder="Briefly describe what this Kit does"
                    onChange={(event) => setDescription(event.target.value)}
                    className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
              </div>

              <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-muted/10">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/55 px-4 py-3">
                  <div className="flex gap-2">
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => handleTabChange(tab.key)}
                          className={
                            activeTab === tab.key
                              ? "inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm"
                              : "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          }
                        >
                          <Icon size={15} />
                          {tab.label}
                          <span className="rounded-full bg-background/20 px-1.5 text-[10px]">
                            {countSelected(candidates, selected, tab.key)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-sm font-semibold text-muted-foreground">
                    Added{" "}
                    <span className="text-foreground">{selectedSummary}</span>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 gap-6 p-4 lg:grid-cols-2">
                  <div className="flex min-h-0 min-w-0 flex-col rounded-2xl border border-border/70 bg-card/65 shadow-sm">
                    <div className="border-b border-border/70 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Existing Assets
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {availableFiltered.length} available
                        </span>
                      </div>
                      <div className="relative">
                        <Search
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          size={15}
                        />
                        <input
                          type="text"
                          placeholder={`Search existing ${activeTab === "skill" ? "Skills" : "MCP"} by name`}
                          value={searchAvailable}
                          onChange={(event) =>
                            setSearchAvailable(event.target.value)
                          }
                          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
                        />
                      </div>
                    </div>
                    <div className="min-h-[220px] flex-1 overflow-y-auto p-2">
                      {candidateLoading ? (
                        <EmptyList
                          title="Loading assets"
                          subtitle="Scanning Local Hub and Extensions."
                        />
                      ) : availableFiltered.length === 0 ? (
                        <EmptyList
                          title="No assets found"
                          subtitle="Try a different name search or switch tabs."
                        />
                      ) : (
                        <div className="grid gap-1.5">
                          {availableFiltered.map((candidate) => (
                            <AssetRow
                              key={candidate.id}
                              candidate={candidate}
                              action="add"
                              onClick={() => {
                                setSelected((current) => {
                                  const next = new Set(current);
                                  next.add(candidate.id);
                                  return next;
                                });
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex min-h-0 min-w-0 flex-col rounded-2xl border border-primary/15 bg-primary/5 shadow-sm">
                    <div className="border-b border-primary/15 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Added Assets
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {selectedFiltered.length} shown
                        </span>
                      </div>
                      <div className="relative">
                        <Search
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          size={15}
                        />
                        <input
                          type="text"
                          placeholder={`Search added ${activeTab === "skill" ? "Skills" : "MCP"} by name`}
                          value={searchSelected}
                          onChange={(event) =>
                            setSearchSelected(event.target.value)
                          }
                          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
                        />
                      </div>
                    </div>
                    <div className="min-h-[220px] flex-1 overflow-y-auto p-2">
                      {selectedFiltered.length === 0 ? (
                        <EmptyList
                          title="No added assets"
                          subtitle="Choose assets from the left panel to add them to this Kit."
                        />
                      ) : (
                        <div className="grid gap-1.5">
                          {selectedFiltered.map((candidate) => (
                            <AssetRow
                              key={candidate.id}
                              candidate={candidate}
                              action="remove"
                              onClick={() => {
                                setSelected((current) => {
                                  const next = new Set(current);
                                  next.delete(candidate.id);
                                  return next;
                                });
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-border bg-muted/20 px-6 py-4">
              <div className="min-h-5 flex-1">
                {formError && (
                  <p className="text-sm font-semibold text-destructive">
                    {formError}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowCreate(false);
                }}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]"
              >
                Save Kit
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedKit && (
        <>
          <button
            type="button"
            aria-label="Close Kit details"
            className="absolute inset-0 z-40 cursor-default bg-transparent"
            onClick={() => {
              setSelectedKit(null);
              setEditingDetail(false);
              setFormError(null);
            }}
          />
          <aside
            className={`absolute inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-background shadow-xl transition-[max-width] duration-200 ${
              editingDetail ? "max-w-6xl" : "max-w-md"
            }`}
          >
            <header className="border-b border-border px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Extensions Kit
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-foreground">
                    {selectedKit.name}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {!editingDetail && (
                    <button
                      type="button"
                      onClick={() => void startEditingDetail()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Close details"
                    onClick={() => {
                      setSelectedKit(null);
                      setEditingDetail(false);
                      setFormError(null);
                    }}
                    className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {editingDetail ? (
                <div className="flex min-h-full flex-col gap-5">
                  <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                    <label className="grid gap-1.5 text-sm font-semibold">
                      <span className="text-foreground/90">Kit Name</span>
                      <input
                        aria-label="Kit name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-semibold">
                      <span className="text-foreground/90">Description</span>
                      <input
                        aria-label="Description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                    </label>
                  </div>

                  <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-muted/10">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/55 px-4 py-3">
                      <div className="flex gap-2">
                        {tabs.map((tab) => {
                          const Icon = tab.icon;
                          return (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => handleTabChange(tab.key)}
                              className={
                                activeTab === tab.key
                                  ? "inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm"
                                  : "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                              }
                            >
                              <Icon size={15} />
                              {tab.label}
                              <span className="rounded-full bg-background/20 px-1.5 text-[10px]">
                                {countSelected(candidates, selected, tab.key)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-sm font-semibold text-muted-foreground">
                        Added{" "}
                        <span className="text-foreground">
                          {selectedSummary}
                        </span>
                      </div>
                    </div>

                    <div className="grid min-h-0 flex-1 gap-6 p-4 lg:grid-cols-2">
                      <div className="flex min-h-0 min-w-0 flex-col rounded-2xl border border-border/70 bg-card/65 shadow-sm">
                        <div className="border-b border-border/70 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Existing Assets
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {availableFiltered.length} available
                            </span>
                          </div>
                          <div className="relative">
                            <Search
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                              size={15}
                            />
                            <input
                              type="text"
                              placeholder={`Search existing ${activeTab === "skill" ? "Skills" : "MCP"} by name`}
                              value={searchAvailable}
                              onChange={(event) =>
                                setSearchAvailable(event.target.value)
                              }
                              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
                            />
                          </div>
                        </div>
                        <div className="min-h-[220px] flex-1 overflow-y-auto p-2">
                          {candidateLoading ? (
                            <EmptyList
                              title="Loading assets"
                              subtitle="Scanning Local Hub and Extensions."
                            />
                          ) : availableFiltered.length === 0 ? (
                            <EmptyList
                              title="No assets found"
                              subtitle="Try a different name search or switch tabs."
                            />
                          ) : (
                            <div className="grid gap-1.5">
                              {availableFiltered.map((candidate) => (
                                <AssetRow
                                  key={candidate.id}
                                  candidate={candidate}
                                  action="add"
                                  onClick={() => {
                                    setSelected((current) => {
                                      const next = new Set(current);
                                      next.add(candidate.id);
                                      return next;
                                    });
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex min-h-0 min-w-0 flex-col rounded-2xl border border-primary/15 bg-primary/5 shadow-sm">
                        <div className="border-b border-primary/15 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Added Assets
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {selectedFiltered.length} shown
                            </span>
                          </div>
                          <div className="relative">
                            <Search
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                              size={15}
                            />
                            <input
                              type="text"
                              placeholder={`Search added ${activeTab === "skill" ? "Skills" : "MCP"} by name`}
                              value={searchSelected}
                              onChange={(event) =>
                                setSearchSelected(event.target.value)
                              }
                              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
                            />
                          </div>
                        </div>
                        <div className="min-h-[220px] flex-1 overflow-y-auto p-2">
                          {selectedFiltered.length === 0 ? (
                            <EmptyList
                              title="No added assets"
                              subtitle="Choose assets from the left panel to add them to this Kit."
                            />
                          ) : (
                            <div className="grid gap-1.5">
                              {selectedFiltered.map((candidate) => (
                                <AssetRow
                                  key={candidate.id}
                                  candidate={candidate}
                                  action="remove"
                                  onClick={() => {
                                    setSelected((current) => {
                                      const next = new Set(current);
                                      next.delete(candidate.id);
                                      return next;
                                    });
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  <div className="mt-auto flex items-center justify-between gap-4 border-t border-border pt-4">
                    <div className="min-h-5 flex-1">
                      {formError && (
                        <p className="text-sm font-semibold text-destructive">
                          {formError}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDetail(false);
                        setFormError(null);
                      }}
                      className="rounded-xl px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitDetailUpdate()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]"
                    >
                      <Save size={15} />
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <section>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Description
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground/90">
                      {selectedKit.description || "No description provided."}
                    </p>
                  </section>

                  <div className="mt-6 space-y-4">
                    {tabs.map((tab) => {
                      const assetsOfKind = kitAssets.filter(
                        (asset) => asset.kind === tab.key,
                      );
                      const Icon = tab.icon;
                      const expanded = expandedSections[tab.key];

                      return (
                        <section key={tab.key}>
                          <button
                            type="button"
                            aria-label={`${tab.label} ${assetsOfKind.length}`}
                            onClick={() =>
                              setExpandedSections((current) => ({
                                ...current,
                                [tab.key]: !current[tab.key],
                              }))
                            }
                            className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left hover:bg-accent/40"
                          >
                            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                              {expanded ? (
                                <ChevronDown size={15} />
                              ) : (
                                <ChevronRight size={15} />
                              )}
                              <Icon size={16} />
                              {tab.label}
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                                {assetsOfKind.length}
                              </span>
                            </span>
                          </button>

                          {expanded &&
                            (loadingAssets ? (
                              <div className="mt-2 border border-border bg-background px-3 py-4 text-center text-sm text-muted-foreground">
                                Loading...
                              </div>
                            ) : assetsOfKind.length === 0 ? (
                              <div className="mt-2 border border-dashed border-border bg-background/60 px-3 py-4 text-center text-sm text-muted-foreground">
                                No {tab.label} in this Kit.
                              </div>
                            ) : (
                              <div className="mt-2 overflow-hidden border border-border bg-background">
                                {assetsOfKind.map((asset) => (
                                  <div
                                    key={`${asset.kind}:${asset.hub_extension_id}`}
                                    className="flex items-center gap-2 border-b border-border px-3 py-2.5 text-sm last:border-b-0"
                                  >
                                    <span className="text-primary">
                                      <AssetIcon kind={tab.key} />
                                    </span>
                                    <span className="truncate text-sm font-medium text-foreground">
                                      {asset.asset_name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ))}
                        </section>
                      );
                    })}
                  </div>

                  <div className="mt-6">
                    <ProjectInstallPanel
                      projects={availableProjects}
                      selectedProjectPath={selectedProjectPath}
                      onProjectChange={setSelectedProjectPath}
                      agentItems={projectAgentItems}
                      selectedProjectName={
                        detailProjectScope?.type === "project"
                          ? detailProjectScope.name
                          : null
                      }
                      placeholder="Select an existing project"
                      emptyProjectText="Select a project first"
                      emptyAgentsText="No project-capable agents detected"
                    />
                  </div>
                </>
              )}
            </div>
          </aside>
        </>
      )}

      {kitConflictDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Resolve Kit asset conflicts"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm"
        >
          <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Resolve asset conflicts
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Selected assets will overwrite the project version. Unselected
                  conflicts are skipped, while non-conflicting assets continue
                  to install.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close conflict dialog"
                onClick={() => setKitConflictDialog(null)}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[360px] overflow-y-auto p-3">
              {kitConflictDialog.conflicts.map((conflict) => (
                <label
                  key={conflict.hub_extension_id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-accent/50"
                >
                  <input
                    type="checkbox"
                    checked={kitConflictDialog.selectedIds.has(
                      conflict.hub_extension_id,
                    )}
                    onChange={() =>
                      setKitConflictDialog((current) => {
                        if (!current) return current;
                        const nextSelected = new Set(current.selectedIds);
                        if (nextSelected.has(conflict.hub_extension_id)) {
                          nextSelected.delete(conflict.hub_extension_id);
                        } else {
                          nextSelected.add(conflict.hub_extension_id);
                        }
                        return { ...current, selectedIds: nextSelected };
                      })
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="text-primary">
                    <AssetIcon kind={conflict.kind} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {conflict.asset_name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Existing {conflict.kind} in{" "}
                      {kitConflictDialog.request.target_agent}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/20 px-5 py-4">
              <button
                type="button"
                onClick={() => setKitConflictDialog(null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const dialog = kitConflictDialog;
                  setKitConflictDialog(null);
                  setSyncingAgent(dialog.request.target_agent);
                  void performKitProjectSync(
                    {
                      ...dialog.request,
                      force_hub_extension_ids: Array.from(dialog.selectedIds),
                    },
                    dialog.syncKey,
                  ).finally(() => setSyncingAgent(null));
                }}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
