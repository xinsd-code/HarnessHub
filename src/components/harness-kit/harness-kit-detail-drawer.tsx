import {
  Blocks,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Layers3,
  Pencil,
  Server,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/invoke";
import type {
  HarnessKitAssets,
  HarnessKitSummary,
  NewHarnessKitAgentConfig,
  Project,
} from "@/lib/types";
import { ProjectInstallPanel } from "@/components/shared/project-install-panel";
import type { AgentInstallIconItem } from "@/components/shared/agent-install-icon-row";

const AGENT_CONFIG_PREVIEW_MAX_LINES = 9;
const AGENT_CONFIG_PREVIEW_MAX_CHARS = 520;
function getAgentConfigPreviewSnippet(content: string): string {
  const lines = content.split("\n");
  if (lines.length > AGENT_CONFIG_PREVIEW_MAX_LINES) {
    return `${lines.slice(0, AGENT_CONFIG_PREVIEW_MAX_LINES).join("\n")}\n...`;
  }
  if (content.length > AGENT_CONFIG_PREVIEW_MAX_CHARS) {
    return `${content.slice(0, AGENT_CONFIG_PREVIEW_MAX_CHARS)}\n...`;
  }
  return content;
}

type Props = {
  harnessKit: HarnessKitSummary;
  assets: HarnessKitAssets;
  loading: boolean;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
  editor: React.ReactNode;
  onNavigateAsset?: (asset: {
    kind: "agent-config" | "extensions-kit" | "skill" | "mcp";
    id: string;
    name: string;
  }) => void;
  /** Insert to Project panel */
  projects?: Project[];
  selectedProjectPath?: string;
  onProjectChange?: (path: string) => void;
  agentItems?: AgentInstallIconItem[];
};

export function HarnessKitDetailDrawer({
  harnessKit,
  assets,
  loading,
  editing,
  onEdit,
  onClose,
  editor,
  onNavigateAsset,
  projects,
  selectedProjectPath,
  onProjectChange,
  agentItems,
}: Props) {
  const [expanded, setExpanded] = useState({
    agentConfig: false,
    extensionsKit: false,
    skills: false,
    mcp: false,
  });

  const [tooltip, setTooltip] = useState<{
    rect: DOMRect;
    data: NewHarnessKitAgentConfig;
  } | null>(null);
  const [agentConfigPreviewCache, setAgentConfigPreviewCache] = useState<
    Map<string, string>
  >(new Map());
  const [agentConfigPreviewLoading, setAgentConfigPreviewLoading] = useState<
    Set<string>
  >(new Set());
  const tooltipHideTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tooltipHideTimer.current != null) {
        window.clearTimeout(tooltipHideTimer.current);
      }
    };
  }, []);

  const clearTooltipHideTimer = () => {
    if (tooltipHideTimer.current != null) {
      window.clearTimeout(tooltipHideTimer.current);
      tooltipHideTimer.current = null;
    }
  };

  const scheduleTooltipHide = () => {
    clearTooltipHideTimer();
    tooltipHideTimer.current = window.setTimeout(() => {
      setTooltip(null);
      tooltipHideTimer.current = null;
    }, 120);
  };

  const showTooltip = (
    rect: DOMRect,
    data: NewHarnessKitAgentConfig,
    onShow?: () => void,
  ) => {
    clearTooltipHideTimer();
    setTooltip({ rect, data });
    onShow?.();
  };

  const ensureAgentConfigPreview = async (templateId: string) => {
    if (
      agentConfigPreviewCache.has(templateId) ||
      agentConfigPreviewLoading.has(templateId)
    ) {
      return;
    }
    setAgentConfigPreviewLoading((current) => {
      const next = new Set(current);
      next.add(templateId);
      return next;
    });
    try {
      const content = await api.getAgentConfigTemplateContent(templateId);
      setAgentConfigPreviewCache((current) => {
        const next = new Map(current);
        next.set(templateId, content);
        return next;
      });
    } catch {
      setAgentConfigPreviewCache((current) => {
        const next = new Map(current);
        next.set(templateId, "Failed to load preview.");
        return next;
      });
    } finally {
      setAgentConfigPreviewLoading((current) => {
        const next = new Set(current);
        next.delete(templateId);
        return next;
      });
    }
  };

  if (editing) {
    return (
      <aside className="absolute inset-y-0 right-0 z-50 flex w-full max-w-6xl flex-col border-l border-border bg-background shadow-xl">
        {editor}
      </aside>
    );
  }

  const skills = assets.extra_assets.filter((asset) => asset.kind === "skill");
  const mcps = assets.extra_assets.filter((asset) => asset.kind === "mcp");
  const groups = [
    {
      key: "agentConfig" as const,
      label: "Agent Config",
      icon: FileText,
      count: assets.agent_configs.length,
      rows: assets.agent_configs.map((item) => ({
        name: item.template_name,
        id: item.template_id,
        kind: "agent-config" as const,
        raw: item as NewHarnessKitAgentConfig | undefined,
      })),
    },
    {
      key: "extensionsKit" as const,
      label: "Extensions Kit",
      icon: Layers3,
      count: assets.extension_kits.length,
      rows: assets.extension_kits.map((item) => ({
        name: item.kit_name,
        id: item.kit_id,
        kind: "extensions-kit" as const,
        raw: undefined as NewHarnessKitAgentConfig | undefined,
      })),
    },
    {
      key: "skills" as const,
      label: "Extra Skills",
      icon: Blocks,
      count: skills.length,
      rows: skills.map((item) => ({
        name: item.asset_name,
        id: item.hub_extension_id,
        kind: "skill" as const,
        raw: undefined as NewHarnessKitAgentConfig | undefined,
      })),
    },
    {
      key: "mcp" as const,
      label: "Extra MCP",
      icon: Server,
      count: mcps.length,
      rows: mcps.map((item) => ({
        name: item.asset_name,
        id: item.hub_extension_id,
        kind: "mcp" as const,
        raw: undefined as NewHarnessKitAgentConfig | undefined,
      })),
    },
  ];

  return (
    <aside className="absolute inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background shadow-xl">
      <header className="border-b border-border px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Harness Kit
            </p>
            <h3 className="mt-1 text-base font-semibold text-foreground">
              {harnessKit.name}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Pencil size={14} /> Edit
            </button>
            <button
              type="button"
              aria-label="Close details"
              onClick={onClose}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <section>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Description
          </p>
          <p className="mt-2 text-sm leading-6 text-foreground/90">
            {harnessKit.description || "No description provided."}
          </p>
        </section>
        {loading ? (
          <div className="mt-6 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="mt-6 space-y-4">
            {groups.map((group) => {
              const Icon = group.icon;
              const open = expanded[group.key];
              return (
                <section key={group.key}>
                  <button
                    type="button"
                    aria-label={`${group.label} ${group.count}`}
                    onClick={() =>
                      setExpanded((c) => ({ ...c, [group.key]: !c[group.key] }))
                    }
                    className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left hover:bg-accent/40"
                  >
                    <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {open ? (
                        <ChevronDown size={15} />
                      ) : (
                        <ChevronRight size={15} />
                      )}
                      <Icon size={16} /> {group.label}
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {group.count}
                      </span>
                    </span>
                  </button>
                  {open &&
                    (group.rows.length === 0 ? (
                      <div className="mt-2 px-1 py-3 text-xs text-muted-foreground">
                        No assets in this group.
                      </div>
                    ) : (
                      <div className="mt-1 space-y-0.5 relative pl-4.5">
                        <div className="absolute left-2.5 top-0 bottom-3.5 w-px bg-border/70" />
                        {group.rows.map((row) => (
                          <div key={row.id} className="relative group">
                            <div className="absolute -left-2 top-3.5 w-2 h-px bg-border/70" />
                            <div
                              className="flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-accent/50"
                              onMouseEnter={(e) => {
                                if (row.kind === "agent-config" && row.raw) {
                                  showTooltip(
                                    e.currentTarget.getBoundingClientRect(),
                                    row.raw,
                                    () => {
                                      void ensureAgentConfigPreview(row.id);
                                    },
                                  );
                                }
                              }}
                              onMouseLeave={scheduleTooltipHide}
                            >
                              <span className="text-sky-500 shrink-0">
                                <Icon size={13} aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                                {row.name}
                              </span>
                              {onNavigateAsset && (
                                <button
                                  type="button"
                                  aria-label={`Navigate to ${row.name}`}
                                  onClick={() =>
                                    onNavigateAsset({
                                      kind: row.kind,
                                      id: row.id,
                                      name: row.name,
                                    })
                                  }
                                  className="shrink-0 rounded p-1 text-muted-foreground/80 opacity-0 transition-all hover:bg-accent hover:text-primary group-hover:opacity-100"
                                >
                                  <ExternalLink size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                </section>
              );
            })}
          </div>
        )}

        {projects && (
          <ProjectInstallPanel
            projects={projects}
            selectedProjectPath={selectedProjectPath ?? ""}
            onProjectChange={onProjectChange ?? (() => {})}
            agentItems={agentItems ?? []}
            className="mt-6"
            title="Insert to Project"
            placeholder="Select an existing project"
            selectAriaLabel="Select target project"
            emptyProjectText="Add a project first"
            emptyAgentsText="No project-capable agents detected"
          />
        )}
      </div>

      {/* Tooltip — 亮暗主题自适应且只展示配置文件内容 */}
      {tooltip && (
        <div
          role="tooltip"
          aria-label="Asset preview"
          onMouseEnter={clearTooltipHideTimer}
          onMouseLeave={scheduleTooltipHide}
          className="fixed z-[100] w-64 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-md px-3.5 py-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: Math.min(tooltip.rect.left, window.innerWidth - 272),
            top: Math.min(tooltip.rect.bottom + 4, window.innerHeight - 256),
          }}
        >
          {(() => {
            const d = tooltip.data;
            const preview = agentConfigPreviewCache.get(d.template_id);
            const loadingPreview = agentConfigPreviewLoading.has(d.template_id);
            return (
              <>
                <p className="text-sm font-bold tracking-tight text-foreground">
                  {d.template_name}
                </p>
                <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap text-[10px] font-mono leading-relaxed text-black dark:text-white">
                  {loadingPreview
                    ? "Loading content..."
                    : preview
                      ? getAgentConfigPreviewSnippet(preview)
                      : "No content available."}
                </pre>
              </>
            );
          })()}
        </div>
      )}
    </aside>
  );
}
