import {
  ArrowLeft,
  ArrowRight,
  Blocks,
  CheckCircle2,
  FileText,
  Layers3,
  Plus,
  Search,
  Server,
} from "lucide-react";
import type { ElementType } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/invoke";
import type {
  HarnessKitAssetCandidates,
  HarnessKitAssets,
  HarnessKitExtensionKitCandidate,
  KitAssetCandidate,
  NewHarnessKitAgentConfig,
  NewKitAsset,
} from "@/lib/types";

export type HarnessKitEditorSelection = {
  agentConfigTemplateIds: Set<string>;
  extensionKitIds: Set<string>;
  extraCandidateIds: Set<string>;
};

const TOOLTIP_HIDE_DELAY_MS = 120;
const AGENT_CONFIG_PREVIEW_MAX_LINES = 9;
const AGENT_CONFIG_PREVIEW_MAX_CHARS = 520;
const ASSET_LIST_MAX_VISIBLE_HEIGHT = "max-h-[268px]";

export function assetIdentity(
  asset: Pick<NewKitAsset, "hub_extension_id" | "kind" | "asset_name">,
) {
  return asset.hub_extension_id || `${asset.kind}:${asset.asset_name}`;
}

export function candidateIdentity(candidate: KitAssetCandidate) {
  return candidate.hub_extension_id || `${candidate.kind}:${candidate.name}`;
}

export function buildCoveredAssetMap(
  selectedExtensionKitIds: Set<string>,
  extensionKitAssets: Map<string, HarnessKitAssets>,
  extensionKits: HarnessKitExtensionKitCandidate[],
) {
  const kitNameById = new Map(extensionKits.map((kit) => [kit.id, kit.name]));
  const covered = new Map<string, string>();
  for (const kitId of selectedExtensionKitIds) {
    const assets = extensionKitAssets.get(kitId);
    if (!assets) continue;
    const kitName = kitNameById.get(kitId) ?? "Extensions Kit";
    for (const asset of assets.extra_assets) {
      if (asset.kind !== "skill" && asset.kind !== "mcp") continue;
      const key = assetIdentity(asset);
      if (!covered.has(key)) covered.set(key, kitName);
    }
  }
  return covered;
}

export function removeCoveredExtraCandidates(
  selectedExtraIds: Set<string>,
  candidates: HarnessKitAssetCandidates,
  coveredAssetMap: Map<string, string>,
) {
  const byId = new Map(
    [...candidates.skills, ...candidates.mcps].map((candidate) => [
      candidate.id,
      candidate,
    ]),
  );
  return new Set(
    [...selectedExtraIds].filter((candidateId) => {
      const candidate = byId.get(candidateId);
      return candidate
        ? !coveredAssetMap.has(candidateIdentity(candidate))
        : true;
    }),
  );
}

type Tab = "agent-config" | "extensions-kit" | "skills" | "mcp";

const tabs: Tab[] = ["agent-config", "extensions-kit", "skills", "mcp"];
const tabLabels: Record<Tab, string> = {
  "agent-config": "Agent Config",
  "extensions-kit": "Extensions Kit",
  skills: "Skills",
  mcp: "MCP",
};
const tabIcons: Record<Tab, ElementType> = {
  "agent-config": FileText,
  "extensions-kit": Layers3,
  skills: Blocks,
  mcp: Server,
};

function countSelectedForTab(
  candidates: HarnessKitAssetCandidates,
  selectedAgentConfigIds: Set<string>,
  selectedExtensionKitIds: Set<string>,
  selectedExtraIds: Set<string>,
  tab: Tab,
): number {
  switch (tab) {
    case "agent-config":
      return candidates.agent_configs.filter((c) =>
        selectedAgentConfigIds.has(c.template_id),
      ).length;
    case "extensions-kit":
      return candidates.extension_kits.filter((c) =>
        selectedExtensionKitIds.has(c.id),
      ).length;
    case "skills":
      return candidates.skills.filter((c) => selectedExtraIds.has(c.id)).length;
    case "mcp":
      return candidates.mcps.filter((c) => selectedExtraIds.has(c.id)).length;
  }
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

type HarnessKitEditorProps = {
  initialName: string;
  initialDescription: string;
  initialAssets?: HarnessKitAssets;
  candidates: HarnessKitAssetCandidates;
  candidateLoading: boolean;
  loadExtensionKitAssets: (id: string) => Promise<HarnessKitAssets>;
  onCancel: () => void;
  onSubmit: (request: {
    name: string;
    description: string;
    agent_config_template_ids: string[];
    extension_kit_ids: string[];
    extra_candidate_ids: string[];
  }) => Promise<void>;
};

export default function HarnessKitEditor({
  initialName,
  initialDescription,
  initialAssets,
  candidates,
  candidateLoading,
  loadExtensionKitAssets,
  onCancel,
  onSubmit,
}: HarnessKitEditorProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [activeTab, setActiveTab] = useState<Tab>("agent-config");
  const [selectedAgentConfigIds, setSelectedAgentConfigIds] = useState<
    Set<string>
  >(new Set(initialAssets?.agent_configs.map((a) => a.template_id) ?? []));
  const [selectedExtensionKitIds, setSelectedExtensionKitIds] = useState<
    Set<string>
  >(new Set(initialAssets?.extension_kits.map((k) => k.kit_id) ?? []));
  const [selectedExtraIds, setSelectedExtraIds] = useState<Set<string>>(
    new Set(
      initialAssets?.extra_assets
        .map((asset) => {
          const matched = [...candidates.skills, ...candidates.mcps].find(
            (c) => candidateIdentity(c) === assetIdentity(asset),
          );
          return matched?.id ?? null;
        })
        .filter((id): id is string => Boolean(id)) ?? [],
    ),
  );
  const [extensionKitAssets, setExtensionKitAssets] = useState<
    Map<string, HarnessKitAssets>
  >(new Map());
  const [saving, setSaving] = useState(false);
  const [searchAvailable, setSearchAvailable] = useState("");
  const [searchSelected, setSearchSelected] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    type: "agent-config" | "extensions-kit";
    rect: DOMRect;
    data: NewHarnessKitAgentConfig | HarnessKitExtensionKitCandidate;
  } | null>(null);
  const [agentConfigPreviewCache, setAgentConfigPreviewCache] = useState<
    Map<string, string>
  >(new Map());
  const [agentConfigPreviewLoading, setAgentConfigPreviewLoading] = useState<
    Set<string>
  >(new Set());
  const tooltipHideTimer = useRef<number | null>(null);

  // Load extension kit assets when a new kit is selected
  useEffect(() => {
    const pending = [...selectedExtensionKitIds].filter(
      (id) => !extensionKitAssets.has(id),
    );
    if (pending.length === 0) return;
    let cancelled = false;
    void (async () => {
      const next = new Map(extensionKitAssets);
      for (const kitId of pending) {
        try {
          const assets = await loadExtensionKitAssets(kitId);
          if (!cancelled) next.set(kitId, assets);
        } catch {
          // kit assets failed to load; skip
        }
      }
      if (!cancelled) setExtensionKitAssets(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedExtensionKitIds, extensionKitAssets, loadExtensionKitAssets]);

  const coveredAssetMap = useMemo(
    () =>
      buildCoveredAssetMap(
        selectedExtensionKitIds,
        extensionKitAssets,
        candidates.extension_kits,
      ),
    [selectedExtensionKitIds, extensionKitAssets, candidates.extension_kits],
  );

  // Remove covered extra candidates from selection when dependencies change
  useEffect(() => {
    setSelectedExtraIds((current) => {
      const cleaned = removeCoveredExtraCandidates(
        current,
        candidates,
        coveredAssetMap,
      );
      return cleaned.size !== current.size ? cleaned : current;
    });
  }, [candidates, coveredAssetMap]);

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

  const dismissTooltip = () => {
    clearTooltipHideTimer();
    setTooltip(null);
  };

  const scheduleTooltipHide = () => {
    clearTooltipHideTimer();
    tooltipHideTimer.current = window.setTimeout(() => {
      setTooltip(null);
      tooltipHideTimer.current = null;
    }, TOOLTIP_HIDE_DELAY_MS);
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
        if (!next.has(templateId)) {
          next.set(templateId, "Unable to load file content.");
        }
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

  const ensureExtensionKitPreview = async (kitId: string) => {
    if (extensionKitAssets.has(kitId)) return;
    try {
      const assets = await loadExtensionKitAssets(kitId);
      setExtensionKitAssets((current) => {
        if (current.has(kitId)) return current;
        const next = new Map(current);
        next.set(kitId, assets);
        return next;
      });
    } catch {
      // ignore preview load failures and keep current tooltip copy minimal
    }
  };

  const showTooltip = (
    nextTooltip: NonNullable<typeof tooltip>,
    loadPreview?: () => void,
  ) => {
    clearTooltipHideTimer();
    setTooltip(nextTooltip);
    loadPreview?.();
  };

  const getAgentConfigPreviewSnippet = (content: string) => {
    const trimmedByChars = content.slice(0, AGENT_CONFIG_PREVIEW_MAX_CHARS);
    const lines = trimmedByChars.split("\n");
    const limited = lines.slice(0, AGENT_CONFIG_PREVIEW_MAX_LINES).join("\n");
    const truncated =
      content.length > limited.length ||
      lines.length > AGENT_CONFIG_PREVIEW_MAX_LINES;
    return truncated ? `${limited}\n…` : limited;
  };

  // Reset tab search when changing tabs
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSearchAvailable("");
    setSearchSelected("");
    dismissTooltip();
  };

  // Determine items for the active tab
  const availableItems = useMemo(() => {
    const query = searchAvailable.trim().toLowerCase();
    switch (activeTab) {
      case "agent-config": {
        const selected = selectedAgentConfigIds;
        return candidates.agent_configs.filter((item) => {
          if (selected.has(item.template_id)) return false;
          if (!query) return true;
          return item.template_name.toLowerCase().includes(query);
        });
      }
      case "extensions-kit": {
        const selected = selectedExtensionKitIds;
        return candidates.extension_kits.filter((item) => {
          if (selected.has(item.id)) return false;
          if (!query) return true;
          return item.name.toLowerCase().includes(query);
        });
      }
      case "skills": {
        const selected = selectedExtraIds;
        return candidates.skills.filter((item) => {
          if (selected.has(item.id)) return false;
          if (!query) return true;
          return item.name.toLowerCase().includes(query);
        });
      }
      case "mcp": {
        const selected = selectedExtraIds;
        return candidates.mcps.filter((item) => {
          if (selected.has(item.id)) return false;
          if (!query) return true;
          return item.name.toLowerCase().includes(query);
        });
      }
    }
  }, [
    activeTab,
    candidates,
    selectedAgentConfigIds,
    selectedExtensionKitIds,
    selectedExtraIds,
    searchAvailable,
  ]);

  const selectedItems = useMemo(() => {
    const query = searchSelected.trim().toLowerCase();
    switch (activeTab) {
      case "agent-config":
        return candidates.agent_configs.filter((item) => {
          if (!selectedAgentConfigIds.has(item.template_id)) return false;
          if (!query) return true;
          return item.template_name.toLowerCase().includes(query);
        });
      case "extensions-kit":
        return candidates.extension_kits.filter((item) => {
          if (!selectedExtensionKitIds.has(item.id)) return false;
          if (!query) return true;
          return item.name.toLowerCase().includes(query);
        });
      case "skills":
        return candidates.skills.filter((item) => {
          if (!selectedExtraIds.has(item.id)) return false;
          if (!query) return true;
          return item.name.toLowerCase().includes(query);
        });
      case "mcp":
        return candidates.mcps.filter((item) => {
          if (!selectedExtraIds.has(item.id)) return false;
          if (!query) return true;
          return item.name.toLowerCase().includes(query);
        });
    }
  }, [
    activeTab,
    candidates,
    selectedAgentConfigIds,
    selectedExtensionKitIds,
    selectedExtraIds,
    searchSelected,
  ]);

  const totalSelected =
    selectedAgentConfigIds.size +
    selectedExtensionKitIds.size +
    selectedExtraIds.size;

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Name is required");
      return;
    }
    if (totalSelected === 0) {
      setFormError("Select at least one asset");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await onSubmit({
        name: trimmedName,
        description: description.trim(),
        agent_config_template_ids: [...selectedAgentConfigIds],
        extension_kit_ids: [...selectedExtensionKitIds],
        extra_candidate_ids: [...selectedExtraIds],
      });
    } finally {
      setSaving(false);
    }
  };

  const isExtraTab = activeTab === "skills" || activeTab === "mcp";

  const renderAgentConfigRow = (
    item: NewHarnessKitAgentConfig,
    action: "add" | "remove",
    onClick: () => void,
  ) => (
    <button
      key={item.template_id}
      type="button"
      onClick={() => {
        dismissTooltip();
        onClick();
      }}
      onMouseEnter={(e) =>
        showTooltip(
          {
            type: "agent-config",
            rect: e.currentTarget.getBoundingClientRect(),
            data: item,
          },
          () => {
            void ensureAgentConfigPreview(item.template_id);
          },
        )
      }
      onMouseLeave={scheduleTooltipHide}
      className={
        action === "add"
          ? "group flex min-h-[64px] w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-transparent px-3 py-2.5 text-left transition-all duration-200 hover:translate-x-1 hover:border-primary/25 hover:bg-background hover:shadow-sm"
          : "group flex min-h-[64px] w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-primary/15 bg-background/80 px-3 py-2.5 text-left shadow-sm transition-all duration-200 hover:-translate-x-1 hover:border-destructive/30 hover:bg-destructive/5"
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={
              action === "add"
                ? "text-muted-foreground group-hover:text-primary transition-colors duration-200"
                : "text-primary"
            }
          >
            <FileText size={15} aria-hidden="true" />
          </span>
          <span className="truncate text-[13px] font-semibold text-foreground">
            {item.template_name}
          </span>
        </div>
      </div>
      <span
        className={
          action === "add"
            ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 scale-90 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100"
            : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive opacity-0 scale-90 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100"
        }
      >
        {action === "add" ? (
          <ArrowRight size={14} className="stroke-[2.5]" />
        ) : (
          <ArrowLeft size={14} className="stroke-[2.5]" />
        )}
      </span>
    </button>
  );

  const renderExtensionKitRow = (
    item: HarnessKitExtensionKitCandidate,
    action: "add" | "remove",
    onClick: () => void,
  ) => (
    <button
      key={item.id}
      type="button"
      onClick={() => {
        dismissTooltip();
        onClick();
      }}
      onMouseEnter={(e) =>
        showTooltip(
          {
            type: "extensions-kit",
            rect: e.currentTarget.getBoundingClientRect(),
            data: item,
          },
          () => {
            void ensureExtensionKitPreview(item.id);
          },
        )
      }
      onMouseLeave={scheduleTooltipHide}
      className={
        action === "add"
          ? "group flex min-h-[64px] w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-transparent px-3 py-2.5 text-left transition-all duration-200 hover:translate-x-1 hover:border-primary/25 hover:bg-background hover:shadow-sm"
          : "group flex min-h-[64px] w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-primary/15 bg-background/80 px-3 py-2.5 text-left shadow-sm transition-all duration-200 hover:-translate-x-1 hover:border-destructive/30 hover:bg-destructive/5"
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={
              action === "add"
                ? "text-muted-foreground group-hover:text-primary transition-colors duration-200"
                : "text-primary"
            }
          >
            <Layers3 size={15} aria-hidden="true" />
          </span>
          <span className="truncate text-[13px] font-semibold text-foreground">
            {item.name}
          </span>
        </div>
        <p className="mt-1 max-w-full truncate text-[11px] leading-4 text-muted-foreground">
          {item.description || "No description available."}
        </p>
      </div>
      <span
        className={
          action === "add"
            ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 scale-90 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100"
            : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive opacity-0 scale-90 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100"
        }
      >
        {action === "add" ? (
          <ArrowRight size={14} className="stroke-[2.5]" />
        ) : (
          <ArrowLeft size={14} className="stroke-[2.5]" />
        )}
      </span>
    </button>
  );

  const renderExtraRow = (
    candidate: KitAssetCandidate,
    action: "add" | "remove",
    onClick: () => void,
    coveredName?: string,
  ) => {
    const isCovered = Boolean(coveredName);
    const isDisabled = action === "add" && isCovered;
    return (
      <button
        key={candidate.id}
        type="button"
        onClick={isDisabled ? undefined : onClick}
        aria-disabled={isDisabled || undefined}
        className={
          isDisabled
            ? "flex min-h-[64px] w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-dashed border-border/80 bg-muted/20 px-3 py-2.5 text-left opacity-70 cursor-default"
            : action === "add"
              ? "group flex min-h-[64px] w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-transparent px-3 py-2.5 text-left transition-all duration-200 hover:translate-x-1 hover:border-primary/25 hover:bg-background hover:shadow-sm"
              : "group flex min-h-[64px] w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-primary/15 bg-background/80 px-3 py-2.5 text-left shadow-sm transition-all duration-200 hover:-translate-x-1 hover:border-destructive/30 hover:bg-destructive/5"
        }
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={
                isDisabled
                  ? "text-muted-foreground/45"
                  : action === "add"
                    ? "text-muted-foreground group-hover:text-primary transition-colors duration-200"
                    : "text-primary"
              }
            >
              {activeTab === "skills" ? (
                <Blocks size={15} aria-hidden="true" />
              ) : (
                <Server size={15} aria-hidden="true" />
              )}
            </span>
            <span
              className={
                isDisabled
                  ? "truncate text-[13px] font-semibold text-foreground/50"
                  : "truncate text-[13px] font-semibold text-foreground"
              }
            >
              {candidate.name}
            </span>
            {action === "add" && !isDisabled && (
              <SourceBadge status={candidate.source_status} />
            )}
            {isDisabled && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground/80 border border-border/40">
                Locked
              </span>
            )}
          </div>
          {isCovered ? (
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground/75 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-violet-500/60 shrink-0" />
              Included in Extensions Kit:{" "}
              <strong className="font-semibold text-violet-600 dark:text-violet-400">
                {coveredName}
              </strong>
            </p>
          ) : (
            <p className="mt-1 max-w-full truncate text-[11px] leading-4 text-muted-foreground">
              {candidate.description || "No description available."}
            </p>
          )}
        </div>
        {!isDisabled && (
          <span
            className={
              action === "add"
                ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 scale-90 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100"
                : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive opacity-0 scale-90 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100"
            }
          >
            {action === "add" ? (
              <ArrowRight size={14} className="stroke-[2.5]" />
            ) : (
              <ArrowLeft size={14} className="stroke-[2.5]" />
            )}
          </span>
        )}
      </button>
    );
  };

  const tabActiveStyles: Record<Tab, string> = {
    "agent-config":
      "bg-primary/10 text-primary border border-primary/20 shadow-inner",
    "extensions-kit":
      "bg-primary/10 text-primary border border-primary/20 shadow-inner",
    skills: "bg-primary/10 text-primary border border-primary/20 shadow-inner",
    mcp: "bg-primary/10 text-primary border border-primary/20 shadow-inner",
  };

  const tabBadgeStyles: Record<Tab, string> = {
    "agent-config": "bg-primary/20 text-primary",
    "extensions-kit": "bg-primary/20 text-primary",
    skills: "bg-primary/20 text-primary",
    mcp: "bg-primary/20 text-primary",
  };

  return (
    <div className="flex min-h-full flex-col gap-5">
      <div className="grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
        <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <span className="text-foreground/90">Name</span>
          <input
            aria-label="Name"
            value={name}
            placeholder="e.g. My Harness Kit"
            onChange={(event) => setName(event.target.value)}
            className="rounded-xl border border-border bg-muted/20 hover:border-border/80 focus:bg-background px-3.5 py-2 text-sm outline-none transition-all duration-200 focus:border-primary/45 focus:ring-4 focus:ring-primary/10"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <span className="text-foreground/90">Description</span>
          <textarea
            aria-label="Description"
            value={description}
            placeholder="Briefly describe what this Harness Kit does"
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className="resize-none rounded-xl border border-border bg-muted/20 hover:border-border/80 focus:bg-background px-3.5 py-2 text-sm outline-none transition-all duration-200 focus:border-primary/45 focus:ring-4 focus:ring-primary/10"
          />
        </label>
      </div>

      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-muted/10">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border bg-background/55 px-4 py-2.5">
          <div className="flex gap-2">
            {tabs.map((tab) => {
              const Icon = tabIcons[tab];
              const count = countSelectedForTab(
                candidates,
                selectedAgentConfigIds,
                selectedExtensionKitIds,
                selectedExtraIds,
                tab,
              );
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all duration-200 active:scale-95 ${
                    isActive
                      ? tabActiveStyles[tab]
                      : "border border-transparent text-muted-foreground/80 hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <Icon size={14} className="stroke-[2]" />
                  {tabLabels[tab]}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isActive
                        ? tabBadgeStyles[tab]
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="text-xs font-bold tracking-wide uppercase text-muted-foreground/75">
            Added{" "}
            <span className="text-foreground font-bold">{totalSelected}</span>{" "}
            assets
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-2">
          {/* Available (left column) */}
          <div className="flex min-h-0 min-w-0 flex-col">
            <div className="border-b border-border/60 pb-3 pt-1">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Available Assets
                </p>
                <span className="text-xs font-medium text-muted-foreground/75">
                  {availableItems.length} available
                </span>
              </div>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50"
                  size={15}
                />
                <input
                  type="text"
                  placeholder={`Search available ${tabLabels[activeTab]} by name`}
                  value={searchAvailable}
                  onChange={(event) => setSearchAvailable(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background py-1.5 pl-9 pr-3 text-sm outline-none transition-all duration-200 focus:border-primary/45 focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </div>
            <div className="min-h-[192px] flex-1 p-2">
              {candidateLoading ? (
                <div className="flex h-full min-h-[192px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/5 px-5 py-6 text-center">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary/70 animate-pulse">
                    <Layers3 size={18} className="stroke-[1.5]" />
                  </div>
                  <p className="text-xs font-bold text-foreground">
                    Loading assets
                  </p>
                  <p className="mt-1 max-w-[200px] text-[10px] leading-relaxed text-muted-foreground/70">
                    Scanning Local Hub and Extensions.
                  </p>
                </div>
              ) : availableItems.length === 0 ? (
                <div className="flex h-full min-h-[192px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/5 px-5 py-6 text-center">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary/70">
                    <Layers3 size={18} className="stroke-[1.5]" />
                  </div>
                  <p className="text-xs font-bold text-foreground">
                    No assets found
                  </p>
                  <p className="mt-1 max-w-[200px] text-[10px] leading-relaxed text-muted-foreground/70">
                    Try a different name search or switch tabs.
                  </p>
                </div>
              ) : (
                <div
                  className={`${ASSET_LIST_MAX_VISIBLE_HEIGHT} overflow-y-auto pr-1`}
                >
                  <div className="grid gap-1">
                    {activeTab === "agent-config" &&
                      (availableItems as NewHarnessKitAgentConfig[]).map(
                        (item) =>
                          renderAgentConfigRow(item, "add", () => {
                            setSelectedAgentConfigIds((current) => {
                              const next = new Set(current);
                              next.add(item.template_id);
                              return next;
                            });
                          }),
                      )}
                    {activeTab === "extensions-kit" &&
                      (availableItems as HarnessKitExtensionKitCandidate[]).map(
                        (item) =>
                          renderExtensionKitRow(item, "add", () => {
                            setSelectedExtensionKitIds((current) => {
                              const next = new Set(current);
                              next.add(item.id);
                              return next;
                            });
                          }),
                      )}
                    {isExtraTab &&
                      (availableItems as KitAssetCandidate[]).map((candidate) =>
                        renderExtraRow(
                          candidate,
                          "add",
                          () => {
                            setSelectedExtraIds((current) => {
                              const next = new Set(current);
                              next.add(candidate.id);
                              return next;
                            });
                          },
                          coveredAssetMap.get(candidateIdentity(candidate)),
                        ),
                      )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Selected (right column) */}
          <div className="flex min-h-0 min-w-0 flex-col">
            <div className="border-b border-border/60 pb-3 pt-1">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Added Assets
                </p>
                <span className="text-xs font-medium text-primary/80">
                  {selectedItems.length} shown
                </span>
              </div>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40"
                  size={15}
                />
                <input
                  type="text"
                  placeholder={`Search added ${tabLabels[activeTab]} by name`}
                  value={searchSelected}
                  onChange={(event) => setSearchSelected(event.target.value)}
                  className="w-full rounded-xl border border-primary/15 bg-background py-1.5 pl-9 pr-3 text-sm outline-none transition-all duration-200 focus:border-primary/45 focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </div>
            <div className="min-h-[192px] flex-1 p-2">
              {selectedItems.length === 0 ? (
                <div className="flex h-full min-h-[192px] flex-col items-center justify-center rounded-2xl border border-dashed border-primary/15 bg-muted/5 px-5 py-6 text-center">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/15 bg-primary/5 text-primary">
                    <Plus size={18} className="stroke-[2.5]" />
                  </div>
                  <p className="text-xs font-bold text-foreground">
                    No added assets
                  </p>
                  <p className="mt-1 max-w-[200px] text-[10px] leading-relaxed text-muted-foreground/70">
                    Choose assets from the left panel to add them to this
                    Harness Kit.
                  </p>
                </div>
              ) : (
                <div
                  className={`${ASSET_LIST_MAX_VISIBLE_HEIGHT} overflow-y-auto pr-1`}
                >
                  <div className="grid gap-1">
                    {activeTab === "agent-config" &&
                      (selectedItems as NewHarnessKitAgentConfig[]).map(
                        (item) =>
                          renderAgentConfigRow(item, "remove", () => {
                            setSelectedAgentConfigIds((current) => {
                              const next = new Set(current);
                              next.delete(item.template_id);
                              return next;
                            });
                          }),
                      )}
                    {activeTab === "extensions-kit" &&
                      (selectedItems as HarnessKitExtensionKitCandidate[]).map(
                        (item) =>
                          renderExtensionKitRow(item, "remove", () => {
                            setSelectedExtensionKitIds((current) => {
                              const next = new Set(current);
                              next.delete(item.id);
                              return next;
                            });
                          }),
                      )}
                    {isExtraTab &&
                      (selectedItems as KitAssetCandidate[]).map((candidate) =>
                        renderExtraRow(candidate, "remove", () => {
                          setSelectedExtraIds((current) => {
                            const next = new Set(current);
                            next.delete(candidate.id);
                            return next;
                          });
                        }),
                      )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <div className="min-h-5 flex-1">
          {formError && (
            <p className="text-xs font-bold tracking-tight text-destructive">
              {formError}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-95"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!name.trim() || totalSelected === 0 || saving}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition-all duration-200 hover:bg-primary/95 hover:shadow-lg hover:shadow-primary/5 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save Harness Kit"}
        </button>
      </div>

      {/* Hover tooltip — rendered at root level to avoid overflow clipping */}
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
          {tooltip.type === "agent-config"
            ? (() => {
                const d = tooltip.data as NewHarnessKitAgentConfig;
                const preview = agentConfigPreviewCache.get(d.template_id);
                const loadingPreview = agentConfigPreviewLoading.has(
                  d.template_id,
                );
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
              })()
            : (() => {
                const d = tooltip.data as HarnessKitExtensionKitCandidate;
                const kitAssets = extensionKitAssets.get(d.id);
                const skills =
                  kitAssets?.extra_assets.filter((a) => a.kind === "skill") ??
                  [];
                const mcps =
                  kitAssets?.extra_assets.filter((a) => a.kind === "mcp") ?? [];
                const maxItems = 6;
                return (
                  <>
                    <p className="text-sm font-bold tracking-tight text-foreground">
                      {d.name}
                    </p>
                    {d.description && (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/80">
                        {d.description}
                      </p>
                    )}
                    {skills.length > 0 && (
                      <div className="mt-2.5 border-t border-border/60 pt-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/75 flex items-center justify-between">
                          <span>Skills</span>
                          <span className="text-xs text-primary font-bold">
                            {skills.length}
                          </span>
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {skills.slice(0, maxItems).map((s) => (
                            <li
                              key={s.hub_extension_id}
                              className="flex items-center gap-1.5 text-[11px] text-foreground/85"
                            >
                              <Blocks
                                size={11}
                                className="shrink-0 text-primary stroke-[1.8]"
                              />
                              <span className="truncate">{s.asset_name}</span>
                            </li>
                          ))}
                          {skills.length > maxItems && (
                            <li className="pl-4 text-[10px] text-muted-foreground font-semibold">
                              +{skills.length - maxItems} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                    {mcps.length > 0 && (
                      <div className="mt-2.5 border-t border-border/60 pt-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/75 flex items-center justify-between">
                          <span>MCP Components</span>
                          <span className="text-xs text-[var(--kind-mcp)] font-bold">
                            {mcps.length}
                          </span>
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {mcps.slice(0, maxItems).map((m) => (
                            <li
                              key={m.hub_extension_id}
                              className="flex items-center gap-1.5 text-[11px] text-foreground/85"
                            >
                              <Server
                                size={11}
                                className="shrink-0 text-[var(--kind-mcp)] stroke-[1.8]"
                              />
                              <span className="truncate">{m.asset_name}</span>
                            </li>
                          ))}
                          {mcps.length > maxItems && (
                            <li className="pl-4 text-[10px] text-muted-foreground font-semibold">
                              +{mcps.length - maxItems} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                    {skills.length === 0 && mcps.length === 0 && (
                      <p className="mt-2.5 text-[11px] text-muted-foreground/70 italic">
                        Assets not loaded yet
                      </p>
                    )}
                  </>
                );
              })()}
        </div>
      )}
    </div>
  );
}
