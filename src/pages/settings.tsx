import { clsx } from "clsx";
import {
  Bot,
  Check,
  Download,
  FolderKanban,
  HardDrive,
  FolderSearch,
  Loader2,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppearanceSettingsSection } from "@/components/settings/appearance-settings-section";
import { LocalHubSettingsSection } from "@/components/settings/local-hub-settings-section";
import { ProjectPathsSection } from "@/components/settings/project-paths-section";
import {
  AGENT_BASE_CONFIGS,
  type AgentBaseConfigProfile,
  buildHomeRelativePath,
  buildProjectRelativePath,
  deriveAgentBasePath,
} from "@/lib/agent-base-config";
import { getAgentIconPath } from "@/lib/agent-icons";
import {
  openDirectoryPicker,
  openFilePicker,
  PICKER_UNSUPPORTED_MESSAGE,
  type PickerResult,
  selectedPickerPath,
} from "@/lib/platform/dialog";
import { isDesktop } from "@/lib/transport";
import {
  type AgentInfo,
  agentDisplayName,
  type ConfigScope,
  type DiscoveredProject,
  normalizePathForComparison,
} from "@/lib/types";
import { useAgentConfigStore } from "@/stores/agent-config-store";
import { useAgentStore } from "@/stores/agent-store";
import { useProjectStore } from "@/stores/project-store";
import { toast } from "@/stores/toast-store";
import { useUIStore } from "@/stores/ui-store";
import { useUpdateStore } from "@/stores/update-store";
import { useWebUpdateStore } from "@/stores/web-update-store";

const SETTINGS_SECTIONS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "local-hub", label: "Exts Hub", icon: HardDrive },
  { id: "agent-paths", label: "Agents", icon: Bot },
  { id: "project-paths", label: "Projects", icon: FolderKanban },
] as const;

const FORCE_DELETABLE_AGENTS = new Set(["copilot", "windsurf"]);

function inferHomeDirectory(paths: string[]): string | null {
  for (const path of paths) {
    if (!path.startsWith("/")) continue;
    const segments = path.split("/").filter(Boolean);
    if (segments[0] === "Users" && segments[1]) {
      return `/${segments[0]}/${segments[1]}`;
    }
    if (segments[0] === "home" && segments[1]) {
      return `/${segments[0]}/${segments[1]}`;
    }
  }
  return null;
}

function displayHomePath(path: string, homeDir: string | null): string {
  if (path === "~" || path.startsWith("~/")) return path;
  if (path === "～" || path.startsWith("～/")) {
    return `~${path.slice(1)}`;
  }
  if (!homeDir || !path.startsWith(homeDir)) return path;
  const suffix = path.slice(homeDir.length).replace(/^\/+/, "");
  return suffix ? `~/${suffix}` : "~";
}

function AgentLogo({
  agent,
  className = "h-10 w-10",
}: {
  agent: Pick<AgentInfo, "name" | "icon_path">;
  className?: string;
}) {
  const iconPath = getAgentIconPath(agent.name, agent.icon_path);
  const [iconError, setIconError] = useState(false);

  const initials = agentDisplayName(agent.name)
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (iconPath && !iconError) {
    return (
      <img
        src={iconPath}
        alt={agentDisplayName(agent.name)}
        className={clsx(
          "rounded-lg border border-border bg-card object-contain p-1",
          className,
        )}
        onError={() => setIconError(true)}
      />
    );
  }

  return (
    <div
      className={clsx(
        "flex items-center justify-center rounded-lg border border-border bg-muted text-[11px] font-semibold text-muted-foreground",
        className,
      )}
    >
      {initials}
    </div>
  );
}

function PresetIcon({ src, label }: { src: string; label: string }) {
  const [iconError, setIconError] = useState(false);
  const initials = label
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (iconError) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-xs font-semibold text-muted-foreground">
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={label}
      className="h-10 w-10 object-contain"
      onError={() => setIconError(true)}
    />
  );
}

function CustomIconPreview({ src }: { src: string }) {
  const [iconError, setIconError] = useState(false);
  if (iconError) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border bg-card text-[10px] text-muted-foreground">
        No icon
      </div>
    );
  }
  return (
    <img
      src={src}
      alt="Custom agent icon"
      className="h-12 w-12 rounded-lg border border-border bg-card object-contain p-1"
      onError={() => setIconError(true)}
    />
  );
}

function UpdateSection() {
  const available = useUpdateStore((s) => s.available);
  const checking = useUpdateStore((s) => s.checking);
  const installing = useUpdateStore((s) => s.installing);
  const checkForUpdate = useUpdateStore((s) => s.checkForUpdate);
  const promptUpdate = useUpdateStore((s) => s.promptUpdate);

  const handleCheck = async () => {
    await checkForUpdate();
    // Show toast if no update found (checked becomes true, available stays null)
    if (!useUpdateStore.getState().available) {
      toast.success("You're up to date");
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground">v{__APP_VERSION__}</span>
      {available ? (
        <button
          onClick={promptUpdate}
          disabled={installing}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-xs text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {installing ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Download size={12} />
          )}
          {installing ? "Updating..." : `Update to v${available.version}`}
        </button>
      ) : (
        <button
          onClick={handleCheck}
          disabled={checking}
          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
        >
          {checking ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          {checking ? "Checking..." : "Check for Updates"}
        </button>
      )}
    </div>
  );
}

function WebUpdateSection() {
  const available = useWebUpdateStore((s) => s.available);
  const checking = useWebUpdateStore((s) => s.checking);
  const checkForUpdate = useWebUpdateStore((s) => s.checkForUpdate);
  const promptUpdate = useWebUpdateStore((s) => s.promptUpdate);

  const handleCheck = async () => {
    await checkForUpdate(true);
    if (!useWebUpdateStore.getState().available) {
      toast.success("You're up to date");
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground">v{__APP_VERSION__}</span>
      {available ? (
        <button
          onClick={promptUpdate}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-xs text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          <Download size={12} />
          Update to v{available.version}
        </button>
      ) : (
        <button
          onClick={handleCheck}
          disabled={checking}
          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
        >
          {checking ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          {checking ? "Checking..." : "Check for Updates"}
        </button>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const {
    themeName,
    mode,
    appIcon,
    setThemeName,
    setMode,
    setAppIcon: setAppIconState,
  } = useUIStore();
  const {
    projects,
    loading,
    loadProjects,
    addProject,
    discoverProjects,
    removeProject,
  } = useProjectStore();
  const addCustomPaths = useAgentConfigStore((s) => s.addCustomPaths);

  const {
    agents,
    fetch: fetchAgents,
    updatePath,
    createAgent,
    removeAgent,
    setEnabled,
  } = useAgentStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSection, setActiveSection] =
    useState<(typeof SETTINGS_SECTIONS)[number]["id"]>("appearance");

  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [editingPath, setEditingPath] = useState("");
  const [createMode, setCreateMode] = useState<"preset" | "custom">("preset");
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [customAgentName, setCustomAgentName] = useState("");
  const [customAgentPath, setCustomAgentPath] = useState("");
  const [customAgentIconPath, setCustomAgentIconPath] = useState<string | null>(
    null,
  );
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [showCreateAgentDialog, setShowCreateAgentDialog] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState<AgentInfo | null>(null);
  const [adding, setAdding] = useState(false);
  const [projectPathInput, setProjectPathInput] = useState("");
  const [discoveredProjects, setDiscoveredProjects] = useState<
    DiscoveredProject[] | null
  >(null);
  const [discoveredSelected, setDiscoveredSelected] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    const scrollTo = searchParams.get("scrollTo");
    if (
      scrollTo &&
      SETTINGS_SECTIONS.some((section) => section.id === scrollTo)
    ) {
      setActiveSection(scrollTo as (typeof SETTINGS_SECTIONS)[number]["id"]);
      searchParams.delete("scrollTo");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const agentOrder = useAgentStore((s) => s.agentOrder);
  const agentNames = agentOrder;
  const agentMap = new Map(agents.map((a) => [a.name.toLowerCase(), a]));
  const homeDir = inferHomeDirectory(agents.map((agent) => agent.path));
  const availablePresets = AGENT_BASE_CONFIGS.filter(
    (preset) =>
      !agentMap.has(preset.id.toLowerCase()) &&
      preset.id.toLowerCase() !== "openclaw",
  );

  const existingPaths = new Set(
    projects.map((p) => normalizePathForComparison(p.path)),
  );

  const handleAddPath = async (path: string) => {
    if (!path) return;
    setAdding(true);
    try {
      await addProject(path);
      setDiscoveredProjects(null);
      setProjectPathInput("");
      toast.success("Project added");
    } catch {
      try {
        const results = await discoverProjects(path);
        if (results.length > 0) {
          setDiscoveredProjects(results);
          setDiscoveredSelected(new Set());
        } else {
          toast.error("No projects found in directory");
        }
      } catch (e) {
        console.error("Failed to discover projects:", e);
        toast.error("Failed to discover projects");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleBrowseProject = async () => {
    const result = await openDirectoryPicker({
      title: "Select Project Directory",
    });
    if (result.status === "unsupported") {
      toast.info(PICKER_UNSUPPORTED_MESSAGE);
      return;
    }
    const path = selectedPickerPath(result);
    if (path) handleAddPath(path);
  };

  const handleAddDiscovered = async () => {
    setAdding(true);
    let added = 0;
    const failed: string[] = [];
    try {
      for (const path of discoveredSelected) {
        try {
          await addProject(path);
          added++;
        } catch {
          failed.push(path);
        }
      }
      if (added > 0)
        toast.success(`${added} project${added > 1 ? "s" : ""} added`);
      if (failed.length > 0)
        toast.error(
          `Failed to add ${failed.length} project${failed.length > 1 ? "s" : ""}: ${failed.join(", ")}`,
        );
    } finally {
      setAdding(false);
      setDiscoveredProjects(null);
      setDiscoveredSelected(new Set());
    }
  };

  const toggleDiscovered = (path: string) => {
    setDiscoveredSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleBrowseAgentPath = async (
    options?: Parameters<typeof openDirectoryPicker>[0],
  ) => {
    return openDirectoryPicker({
      title: "Select Agent Directory",
      ...options,
    });
  };

  const handlePickerResult = (result: PickerResult): string | null => {
    if (result.status === "unsupported") {
      toast.info(PICKER_UNSUPPORTED_MESSAGE);
      return null;
    }
    return selectedPickerPath(result);
  };

  const handleCreateAgent = async () => {
    if (createMode === "custom") {
      const name = customAgentName.trim().toLowerCase();
      const path = customAgentPath.trim();
      if (!name || !path) return;
      if (agentMap.has(name)) {
        toast.error("Agent already exists");
        return;
      }
      setCreatingAgent(true);
      try {
        const created = await createAgent(name, path, customAgentIconPath);
        if (created) {
          setCustomAgentName("");
          setCustomAgentPath("");
          setCustomAgentIconPath(null);
          setShowCreateAgentDialog(false);
        }
      } finally {
        setCreatingAgent(false);
      }
      return;
    }

    const preset = AGENT_BASE_CONFIGS.find(
      (item) => item.id === selectedPresetId,
    );
    if (!preset) return;

    const name = preset.id.trim().toLowerCase();
    const path = deriveAgentBasePath(preset);
    if (agentMap.has(name)) {
      toast.error("Agent already exists");
      return;
    }
    setCreatingAgent(true);
    try {
      const created = await createAgent(name, path, preset.iconPath);
      if (created) {
        await attachPresetConfigs(name, preset);
        setCreateMode("preset");
        setSelectedPresetId(null);
        setShowCreateAgentDialog(false);
      }
    } finally {
      setCreatingAgent(false);
    }
  };

  const attachPresetConfigs = async (
    agentName: string,
    preset: AgentBaseConfigProfile,
  ) => {
    const configPaths: Array<{
      agent: string;
      path: string;
      label: string;
      category: string;
      targetScope: ConfigScope;
    }> = [
        {
          agent: agentName,
          path: buildHomeRelativePath(preset.globalSkillsPath),
          label: "Global Skills",
          category: "settings",
          targetScope: { type: "global" },
        },
      ];

    for (const project of projects) {
      configPaths.push({
        agent: agentName,
        path: buildProjectRelativePath(project.path, preset.projectSkillsPath),
        label: "Project Skills",
        category: "settings",
        targetScope: {
          type: "project",
          name: project.name,
          path: project.path,
        },
      });
    }

    if (preset.mcpConfigPath) {
      configPaths.push({
        agent: agentName,
        path: buildHomeRelativePath(preset.mcpConfigPath),
        label: "MCP Config",
        category: "settings",
        targetScope: { type: "global" },
      });
    }

    if (preset.hooksConfigPath) {
      configPaths.push({
        agent: agentName,
        path: buildHomeRelativePath(preset.hooksConfigPath),
        label: "Hooks Config",
        category: "settings",
        targetScope: { type: "global" },
      });
    }

    await addCustomPaths(configPaths);
    await fetchAgents();
  };

  const handleDeleteAgentPath = async () => {
    if (!deletingAgent) return;
    const target = deletingAgent;
    setDeletingAgent(null);
    if (editingAgent === target.name) {
      setEditingAgent(null);
      setEditingPath("");
    }
    if (target.builtin) {
      await updatePath(target.name, null);
      return;
    }
    await removeAgent(target.name);
  };

  const switchSection = (
    sectionId: (typeof SETTINGS_SECTIONS)[number]["id"],
  ) => {
    setActiveSection(sectionId);
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 -mb-6">
      <div className="shrink-0 pb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight select-none">
            Settings
          </h2>
          {isDesktop() ? <UpdateSection /> : <WebUpdateSection />}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl gap-8 pb-6">
          {/* Sidebar */}
          <aside className="sticky top-0 hidden h-fit w-52 shrink-0 lg:block">
            <nav className="space-y-1">
              {SETTINGS_SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => switchSection(section.id)}
                    className={clsx(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-200 active:scale-[0.98]",
                      activeSection === section.id
                        ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                        : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                    )}
                  >
                    <Icon size={15} strokeWidth={2} />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0 flex-1 space-y-4">
            {/* Small Screen Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {SETTINGS_SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => switchSection(section.id)}
                    className={clsx(
                      "flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95",
                      activeSection === section.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon size={13} strokeWidth={2} />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="py-1">
              {activeSection === "appearance" && (
                <AppearanceSettingsSection
                  appIcon={appIcon}
                  mode={mode}
                  onAppIconChange={setAppIconState}
                  onModeChange={setMode}
                  onThemeNameChange={setThemeName}
                  showDesktopIcon={isDesktop()}
                  themeName={themeName}
                />
              )}

              {activeSection === "local-hub" && <LocalHubSettingsSection />}

              {/* Agent Paths */}
              {activeSection === "agent-paths" && (
                <section id="agent-paths" className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground tracking-tight">
                        Agent Paths
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Manage built-in and custom agents. Override search
                        directories or add a preset AI tool with default
                        configurations.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCreateAgentDialog(true)}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-sm transition-[color,background-color,box-shadow] duration-200 hover:bg-primary/90 hover:shadow-md active:scale-95"
                    >
                      <Plus size={12} />
                      Add Agent
                    </button>
                  </div>
                  <div className="space-y-3">
                    {agentNames.map((agent) => {
                      const info = agentMap.get(agent);
                      const isEnabled = info?.enabled ?? true;
                      const canDelete =
                        !!info &&
                        (FORCE_DELETABLE_AGENTS.has(info.name) ||
                          !info.builtin);
                      return (
                        <div
                          key={agent}
                          className={clsx(
                            "group flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-border/50 bg-card/45 p-4 transition-all duration-300 hover:border-border/90 hover:bg-card/75 hover:shadow-xs",
                            !isEnabled && "opacity-55",
                          )}
                        >
                          <div className="flex items-center gap-3.5 w-full md:w-36 shrink-0 min-w-0">
                            {info ? (
                              <div className="shrink-0 transition-transform duration-300 group-hover:scale-105">
                                <AgentLogo agent={info} className="h-9 w-9" />
                              </div>
                            ) : (
                              <div className="h-9 w-9 shrink-0 bg-muted rounded-lg" />
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-foreground tracking-tight truncate">
                                {agentDisplayName(agent)}
                              </span>
                              <span className="block text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wider">
                                {info?.builtin ? "Built-in" : "Custom"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-1 w-full md:max-w-lg lg:max-w-xl">
                            <input
                              type="text"
                              readOnly={editingAgent !== agent}
                              disabled={!isEnabled}
                              value={
                                editingAgent === agent
                                  ? editingPath
                                  : displayHomePath(info?.path ?? "", homeDir)
                              }
                              placeholder="Not detected"
                              aria-label={`${agent} config path`}
                              onChange={(e) => setEditingPath(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && editingPath.trim()) {
                                  updatePath(agent, editingPath.trim());
                                  setEditingAgent(null);
                                }
                                if (e.key === "Escape") setEditingAgent(null);
                              }}
                              className={clsx(
                                "flex-1 rounded-md border border-border px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground truncate disabled:opacity-40",
                                editingAgent === agent
                                  ? "bg-card ring-1 ring-ring"
                                  : "bg-muted/60 cursor-default hover:bg-muted/80",
                              )}
                            />
                            {editingAgent === agent ? (
                              <>
                                {isDesktop() && (
                                  <button
                                    type="button"
                                    aria-label={`Browse ${agent} path`}
                                    className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95"
                                    onClick={async () => {
                                      const path = await handleBrowseAgentPath({
                                        title: `Select ${agent} directory`,
                                      });
                                      const selected = handlePickerResult(path);
                                      if (selected) {
                                        updatePath(agent, selected);
                                        setEditingAgent(null);
                                      }
                                    }}
                                  >
                                    <FolderSearch size={14} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  aria-label="Cancel"
                                  className="shrink-0 rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground transition-colors active:scale-95"
                                  onClick={() => setEditingAgent(null)}
                                >
                                  <X size={14} />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Save"
                                  disabled={!editingPath.trim()}
                                  className="shrink-0 rounded-md bg-primary p-1.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors active:scale-95"
                                  onClick={() => {
                                    updatePath(agent, editingPath.trim());
                                    setEditingAgent(null);
                                  }}
                                >
                                  <Check size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                {canDelete && (
                                  <button
                                    type="button"
                                    aria-label={
                                      info?.builtin
                                        ? `Remove ${agent} custom path`
                                        : `Delete ${agent}`
                                    }
                                    className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-90"
                                    onClick={() => {
                                      if (info) setDeletingAgent(info);
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={!isEnabled}
                                  aria-label={`Edit ${agent} path`}
                                  className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:pointer-events-none disabled:opacity-40 active:scale-90"
                                  onClick={() => {
                                    setEditingAgent(agent);
                                    setEditingPath(info?.path ?? "");
                                  }}
                                >
                                  <Pencil size={14} />
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setEnabled(agent, !isEnabled)}
                              className={clsx(
                                "shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase transition-all duration-200 active:scale-95",
                                isEnabled
                                  ? "bg-primary/10 text-primary hover:bg-primary/20"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80",
                              )}
                            >
                              {isEnabled ? "Active" : "Inactive"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Project Paths */}
              {activeSection === "project-paths" && (
                <ProjectPathsSection
                  adding={adding}
                  discoveredProjects={discoveredProjects}
                  discoveredSelected={discoveredSelected}
                  existingPaths={existingPaths}
                  isDesktop={isDesktop()}
                  loading={loading}
                  onAddDiscovered={handleAddDiscovered}
                  onAddPath={handleAddPath}
                  onBrowseProject={handleBrowseProject}
                  onCancelDiscovered={() => setDiscoveredProjects(null)}
                  onInputChange={setProjectPathInput}
                  onRemoveProject={(id) => {
                    removeProject(id);
                    toast.success("Project removed");
                  }}
                  onToggleDiscovered={toggleDiscovered}
                  projectPathInput={projectPathInput}
                  projects={projects}
                />
              )}
            </div>

            {/* Footer */}
            <footer className="flex items-center justify-center gap-1.5 border-t border-border pt-6 pb-2 text-xs text-muted-foreground/50">
              <span>HarnessHub</span>
              <span>&middot;</span>
              <span>One home for every agent</span>
              <span>&middot;</span>
              <a
                href="https://github.com/xinsd-code/HarnessHub"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-muted-foreground"
              >
                GitHub
              </a>
            </footer>
          </div>
        </div>
      </div>
      {showCreateAgentDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
          onClick={() => setShowCreateAgentDialog(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-base font-semibold text-foreground">
                  Add Agent
                </h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick a bundled AI tool preset. HarnessHub will create the
                  agent with its default Global Skills, Project Skills, MCP
                  Config, and Hooks Config paths when available.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateAgentDialog(false)}
                className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mt-4">
              <div className="mb-4 flex rounded-lg border border-border p-1">
                {(["preset", "custom"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCreateMode(mode)}
                    className={clsx(
                      "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      createMode === mode
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {mode === "preset" ? "Preset Agent" : "Custom Agent"}
                  </button>
                ))}
              </div>

              {createMode === "preset" ? (
                availablePresets.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                    All bundled agent presets have already been added.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {availablePresets.map((preset) => {
                      const selected = selectedPresetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setSelectedPresetId(preset.id)}
                          className={clsx(
                            "flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all",
                            selected
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border hover:border-primary/40 hover:bg-accent/60",
                          )}
                          title={preset.label}
                        >
                          {preset.iconPath ? (
                            <PresetIcon
                              src={preset.iconPath}
                              label={preset.label}
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-xs font-semibold text-muted-foreground">
                              {preset.label.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="text-xs font-medium text-foreground">
                              {preset.label}
                            </div>
                            <div className="mt-1 text-[10px] text-muted-foreground">
                              {preset.id}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
                  <div className="space-y-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        Agent Name
                      </span>
                      <input
                        type="text"
                        value={customAgentName}
                        onChange={(e) => setCustomAgentName(e.target.value)}
                        placeholder="e.g. openclaw-dev"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        Agent Path
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={customAgentPath}
                          onChange={(e) => setCustomAgentPath(e.target.value)}
                          placeholder={
                            isDesktop()
                              ? "Paste a path or browse..."
                              : "Paste an agent path..."
                          }
                          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        {isDesktop() && (
                          <button
                            type="button"
                            disabled={creatingAgent}
                            onClick={async () => {
                              const path = await handleBrowseAgentPath({
                                title: "Select Custom Agent Directory",
                              });
                              const selected = handlePickerResult(path);
                              if (selected) setCustomAgentPath(selected);
                            }}
                            className="shrink-0 rounded-md border border-border bg-background p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                            title="Browse..."
                          >
                            <FolderSearch size={16} />
                          </button>
                        )}
                      </div>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        Custom Icon
                      </span>
                      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3">
                        {customAgentIconPath ? (
                          <CustomIconPreview src={customAgentIconPath} />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border bg-card text-[10px] text-muted-foreground">
                            No icon
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {isDesktop() && (
                            <button
                              type="button"
                              onClick={async () => {
                                const result = await openFilePicker({
                                  title: "Select Agent Icon",
                                });
                                const path = handlePickerResult(result);
                                if (path) setCustomAgentIconPath(path);
                              }}
                              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            >
                              Upload Icon
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setCustomAgentIconPath(null)}
                            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Supports local image paths. Uploaded icon will be used
                        as this custom agent&apos;s display icon.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateAgentDialog(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateAgent}
                disabled={
                  creatingAgent ||
                  (createMode === "preset"
                    ? !selectedPresetId
                    : !customAgentName.trim() || !customAgentPath.trim())
                }
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground shadow-sm transition-[color,background-color,box-shadow] duration-200 hover:bg-primary/90 hover:shadow-md disabled:opacity-50"
              >
                {creatingAgent ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                {createMode === "preset" ? "Add Agent" : "Create Agent"}
              </button>
            </div>
          </div>
        </div>
      )}
      {deletingAgent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
          onClick={() => setDeletingAgent(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-destructive/10 p-2 text-destructive">
                <Trash2 size={16} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">
                  {deletingAgent.builtin
                    ? "Remove custom path override?"
                    : "Delete custom agent?"}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {deletingAgent.builtin
                    ? `This will remove the custom path for ${agentDisplayName(deletingAgent.name)} and fall back to the auto-detected default path.`
                    : `This will remove ${agentDisplayName(deletingAgent.name)} from Agent Paths.`}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingAgent(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAgentPath}
                className="rounded-lg bg-destructive px-3 py-1.5 text-sm text-destructive-foreground transition-colors hover:bg-destructive/90"
              >
                {deletingAgent.builtin ? "Remove Path" : "Delete Agent"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
