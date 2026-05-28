import { clsx } from "clsx";
import {
  Bot,
  Check,
  Download,
  FolderKanban,
  FolderOpen,
  FolderSearch,
  Loader2,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AGENT_BASE_CONFIGS,
  type AgentBaseConfigProfile,
  buildHomeRelativePath,
  buildProjectRelativePath,
  deriveAgentBasePath,
} from "@/lib/agent-base-config";
import { getAgentIconPath } from "@/lib/agent-icons";
import { api } from "@/lib/invoke";
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
  type DiscoveredProject,
  normalizePathForComparison,
} from "@/lib/types";
import { useAgentStore } from "@/stores/agent-store";
import { useProjectStore } from "@/stores/project-store";
import { toast } from "@/stores/toast-store";
import type { AppIcon, ThemeName } from "@/stores/ui-store";
import { useUIStore } from "@/stores/ui-store";
import { useUpdateStore } from "@/stores/update-store";
import { useWebUpdateStore } from "@/stores/web-update-store";

const THEME_OPTIONS: {
  value: ThemeName;
  label: string;
  colors: [string, string, string];
}[] = [
  {
    value: "tiesen",
    label: "Tiesen",
    colors: [
      "oklch(0.5144 0.1605 267.4400)",
      "oklch(0.9851 0 0)",
      "oklch(0 0 0)",
    ],
  },
  {
    value: "claude",
    label: "Claude",
    colors: [
      "oklch(0.6171 0.1375 39.0427)",
      "oklch(0.9665 0.0067 97.3521)",
      "oklch(0.2679 0.0036 106.6427)",
    ],
  },
];

const ICON_OPTIONS: { value: AppIcon; label: string; src: string }[] = [
  { value: "icon-1", label: "Tiesen", src: "/icons/app-icon-1.png" },
  { value: "icon-2", label: "Claude", src: "/icons/app-icon-2.png" },
];

const SETTINGS_SECTIONS = [
  { id: "appearance", label: "Appearance", icon: Palette },
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
  const { projects, loading, loadProjects, addProject, removeProject } =
    useProjectStore();

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
        const results = await api.discoverProjects(path);
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
    await api.addCustomConfigPath(
      agentName,
      buildHomeRelativePath(preset.globalSkillsPath),
      "Global Skills",
      "settings",
      { type: "global" },
    );

    for (const project of projects) {
      await api.addCustomConfigPath(
        agentName,
        buildProjectRelativePath(project.path, preset.projectSkillsPath),
        "Project Skills",
        "settings",
        { type: "project", name: project.name, path: project.path },
      );
    }

    if (preset.mcpConfigPath) {
      await api.addCustomConfigPath(
        agentName,
        buildHomeRelativePath(preset.mcpConfigPath),
        "MCP Config",
        "settings",
        { type: "global" },
      );
    }

    if (preset.hooksConfigPath) {
      await api.addCustomConfigPath(
        agentName,
        buildHomeRelativePath(preset.hooksConfigPath),
        "Hooks Config",
        "settings",
        { type: "global" },
      );
    }

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
              {/* Appearance */}
              {activeSection === "appearance" && (
                <section id="appearance" className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground tracking-tight">
                      Appearance Settings
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Personalize theme, color mode, and desktop app icon.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/40 bg-card/45 p-5 backdrop-blur-xs shadow-xs space-y-5">
                    {/* Theme */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-sm font-semibold text-foreground">
                          Color Theme
                        </span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Select a design theme for the dashboard
                        </p>
                      </div>
                      <div className="flex rounded-lg border border-border bg-muted/20 p-1">
                        {THEME_OPTIONS.map((t, _i) => (
                          <button
                            key={t.value}
                            onClick={() => {
                              setThemeName(t.value);
                              toast.success(`Theme: ${t.label}`);
                            }}
                            aria-pressed={themeName === t.value}
                            className={clsx(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                              themeName === t.value
                                ? "bg-primary text-primary-foreground shadow-sm animate-scale-in"
                                : "text-muted-foreground hover:bg-card/40 hover:text-foreground",
                            )}
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full border border-primary-foreground/20 transition-transform duration-300"
                              style={{
                                backgroundColor:
                                  themeName === t.value
                                    ? "oklch(1 0 0 / 0.9)"
                                    : t.colors[0],
                              }}
                            />
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-border/40" />

                    {/* Mode */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-sm font-semibold text-foreground">
                          Interface Mode
                        </span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Toggle between light, dark, or system preference
                        </p>
                      </div>
                      <div className="flex rounded-lg border border-border bg-muted/20 p-1">
                        {(["system", "light", "dark"] as const).map((m, _i) => (
                          <button
                            key={m}
                            onClick={() => {
                              setMode(m);
                              toast.success(
                                `Mode: ${m === "system" ? "System" : m === "light" ? "Light" : "Dark"}`,
                              );
                            }}
                            aria-pressed={mode === m}
                            className={clsx(
                              "px-3.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                              mode === m
                                ? "bg-primary text-primary-foreground shadow-sm animate-scale-in"
                                : "text-muted-foreground hover:bg-card/40 hover:text-foreground",
                            )}
                          >
                            {m === "system"
                              ? "System"
                              : m === "light"
                                ? "Light"
                                : "Dark"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {isDesktop() && (
                      <>
                        <div className="border-t border-border/40" />

                        {/* App Icon — desktop only */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <span className="text-sm font-semibold text-foreground">
                              App Launcher Icon
                            </span>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Customize the app icon of your desktop client
                            </p>
                          </div>
                          <div className="flex gap-3">
                            {ICON_OPTIONS.map((icon) => (
                              <button
                                key={icon.value}
                                onClick={() => {
                                  setAppIconState(icon.value);
                                  api
                                    .setAppIcon(icon.value)
                                    .then(() => {
                                      toast.success(`Icon: ${icon.label}`);
                                    })
                                    .catch(() => {
                                      toast.error("Failed to set icon");
                                    });
                                }}
                                aria-pressed={appIcon === icon.value}
                                className={clsx(
                                  "rounded-xl p-0.5 transition-all duration-200 active:scale-95",
                                  appIcon === icon.value
                                    ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
                                    : "ring-1 ring-border hover:ring-primary/50",
                                )}
                              >
                                <img
                                  src={icon.src}
                                  alt={icon.label}
                                  className="h-10 w-10 rounded-lg"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </section>
              )}

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
                <section id="project-paths" className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground tracking-tight">
                      Projects Configuration
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add project directories to scan their local extensions
                      (.claude/skills, .mcp.json, hooks).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={
                        isDesktop()
                          ? "Paste a project path or browse..."
                          : "Paste a project path..."
                      }
                      value={projectPathInput}
                      onChange={(e) => setProjectPathInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && projectPathInput.trim())
                          handleAddPath(projectPathInput.trim());
                      }}
                      className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    {isDesktop() && (
                      <button
                        type="button"
                        disabled={adding}
                        onClick={handleBrowseProject}
                        className="shrink-0 rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 active:scale-95"
                        title="Browse..."
                      >
                        <FolderSearch size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => handleAddPath(projectPathInput.trim())}
                      disabled={adding || !projectPathInput.trim()}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-[color,background-color,box-shadow] duration-200 hover:bg-primary/90 hover:shadow-md disabled:opacity-50 active:scale-95"
                    >
                      {adding ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Plus size={12} />
                      )}
                      <span>Add Project</span>
                    </button>
                  </div>

                  {/* Discovered projects (shown when user selected a non-project root dir) */}
                  {discoveredProjects !== null && (
                    <div className="space-y-3 rounded-lg bg-muted/30 p-4">
                      <p className="text-xs text-muted-foreground">
                        The selected directory is not a project. Found{" "}
                        {discoveredProjects.length} project(s) inside:
                      </p>
                      {discoveredProjects.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          No projects found.
                        </p>
                      ) : (
                        <>
                          <div className="space-y-1 max-h-48 overflow-y-auto overscroll-contain">
                            {discoveredProjects.map((dp) => {
                              const already = existingPaths.has(
                                normalizePathForComparison(dp.path),
                              );
                              return (
                                <label
                                  key={dp.path}
                                  className={clsx(
                                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer transition-colors",
                                    already
                                      ? "opacity-50 cursor-not-allowed"
                                      : "hover:bg-muted",
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    disabled={already}
                                    checked={discoveredSelected.has(dp.path)}
                                    onChange={() => toggleDiscovered(dp.path)}
                                    className="rounded border-border"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <span className="font-medium text-foreground">
                                      {dp.name}
                                    </span>
                                    <span className="ml-2 text-xs text-muted-foreground truncate">
                                      {dp.path}
                                    </span>
                                  </div>
                                  {already && (
                                    <span className="text-xs text-muted-foreground">
                                      Added
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setDiscoveredProjects(null)}
                              className="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleAddDiscovered}
                              disabled={discoveredSelected.size === 0 || adding}
                              className="rounded-lg bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                              Add Selected ({discoveredSelected.size})
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Project list */}
                  {loading ? (
                    <p className="text-xs text-muted-foreground">Loading...</p>
                  ) : projects.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-card/25 p-8 text-center">
                      <FolderOpen
                        size={24}
                        className="mx-auto text-muted-foreground/45"
                      />
                      <h4 className="mt-3 text-sm font-semibold text-foreground">
                        No projects yet
                      </h4>
                      <p className="mt-1.5 text-xs text-muted-foreground max-w-sm mx-auto">
                        Add a project directory to scan for local extensions and
                        manage their settings.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {projects.map((project) => (
                        <div
                          key={project.id}
                          className={clsx(
                            "group flex w-full items-center justify-between gap-3 rounded-xl border p-4 transition-all duration-300 hover:border-border/90 hover:bg-card/75 hover:shadow-xs",
                            project.exists
                              ? "border-border/50 bg-card/45"
                              : "border-destructive/20 bg-destructive/[0.015] hover:border-destructive/40 hover:bg-destructive/[0.03]",
                          )}
                        >
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground group-hover:scale-105 group-hover:bg-primary/5 group-hover:text-primary transition-all duration-300">
                              <FolderOpen size={15} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={clsx(
                                    "font-semibold text-sm tracking-tight",
                                    project.exists
                                      ? "text-foreground"
                                      : "text-muted-foreground/75 line-through",
                                  )}
                                >
                                  {project.name}
                                </span>
                                {!project.exists && (
                                  <span className="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded bg-destructive/10 text-destructive inline-flex items-center gap-1">
                                    <TriangleAlert size={9} /> Missing
                                  </span>
                                )}
                              </div>
                              <span className="block text-xs text-muted-foreground mt-0.5 truncate">
                                {project.path}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              removeProject(project.id);
                              toast.success("Project removed");
                            }}
                            className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10 transition-all duration-200 cursor-pointer focus:outline-none active:scale-90"
                            aria-label={`Remove ${project.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>

            {/* Footer */}
            <footer className="flex items-center justify-center gap-1.5 border-t border-border pt-6 pb-2 text-xs text-muted-foreground/50">
              <span>HarnessKit</span>
              <span>&middot;</span>
              <span>One home for every agent</span>
              <span>&middot;</span>
              <a
                href="https://github.com/RealZST/HarnessKit"
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
                  Pick a bundled AI tool preset. HarnessKit will create the
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
