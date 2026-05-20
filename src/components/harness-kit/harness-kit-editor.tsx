import {
  ArrowLeft,
  ArrowRight,
  Blocks,
  CheckCircle2,
  FileText,
  Layers3,
  Search,
  Server,
} from "lucide-react";
import type { ElementType } from "react";
import { useEffect, useMemo, useState } from "react";
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

  // Remove covered extra candidates from selection
  useMemo(() => {
    const cleaned = removeCoveredExtraCandidates(
      selectedExtraIds,
      candidates,
      coveredAssetMap,
    );
    if (cleaned.size !== selectedExtraIds.size) {
      setSelectedExtraIds(cleaned);
    }
  }, [selectedExtraIds, candidates, coveredAssetMap]);

  // Reset tab search when changing tabs
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSearchAvailable("");
    setSearchSelected("");
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
            ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 transition-opacity group-hover:opacity-100"
            : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
        }
      >
        {action === "add" ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
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
            ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 transition-opacity group-hover:opacity-100"
            : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
        }
      >
        {action === "add" ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
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
            ? "flex min-h-[64px] w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-border/30 bg-muted/30 px-3 py-2.5 text-left opacity-60"
            : action === "add"
              ? "group flex min-h-[64px] w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-transparent px-3 py-2.5 text-left transition-all hover:border-primary/25 hover:bg-background hover:shadow-sm"
              : "group flex min-h-[64px] w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-primary/15 bg-background/80 px-3 py-2.5 text-left shadow-sm transition-all hover:border-destructive/30 hover:bg-destructive/5"
        }
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={
                isDisabled
                  ? "text-muted-foreground/50"
                  : action === "add"
                    ? "text-muted-foreground group-hover:text-primary"
                    : "text-primary"
              }
            >
              {activeTab === "skills" ? (
                <Blocks size={15} aria-hidden="true" />
              ) : (
                <Server size={15} aria-hidden="true" />
              )}
            </span>
            <span className="truncate text-[13px] font-semibold text-foreground">
              {candidate.name}
            </span>
            {action === "add" && !isDisabled && (
              <SourceBadge status={candidate.source_status} />
            )}
          </div>
          {isCovered ? (
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              Included in Extensions Kit: {coveredName}
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
                ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 transition-opacity group-hover:opacity-100"
                : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
            }
          >
            {action === "add" ? (
              <ArrowRight size={15} />
            ) : (
              <ArrowLeft size={15} />
            )}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="flex min-h-full flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
        <label className="grid gap-1.5 text-sm font-semibold">
          <span className="text-foreground/90">Name</span>
          <input
            aria-label="Name"
            value={name}
            placeholder="e.g. My Harness Kit"
            onChange={(event) => setName(event.target.value)}
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          <span className="text-foreground/90">Description</span>
          <textarea
            aria-label="Description"
            value={description}
            placeholder="Briefly describe what this Harness Kit does"
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className="resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
      </div>

      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-muted/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/55 px-4 py-3">
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
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={
                    activeTab === tab
                      ? "inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm"
                      : "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  }
                >
                  <Icon size={15} />
                  {tabLabels[tab]}
                  <span className="rounded-full bg-background/20 px-1.5 text-[10px]">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="text-sm font-semibold text-muted-foreground">
            Added{" "}
            <span className="text-foreground">{totalSelected} assets</span>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 p-4 lg:grid-cols-2">
          {/* Available (left column) */}
          <div className="flex min-h-0 min-w-0 flex-col rounded-2xl border border-border/70 bg-card/65 shadow-sm">
            <div className="border-b border-border/70 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Available Assets
                </p>
                <span className="text-xs text-muted-foreground">
                  {availableItems.length} available
                </span>
              </div>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={15}
                />
                <input
                  type="text"
                  placeholder={`Search available ${tabLabels[activeTab]} by name`}
                  value={searchAvailable}
                  onChange={(event) => setSearchAvailable(event.target.value)}
                  className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>
            </div>
            <div className="min-h-[220px] flex-1 overflow-y-auto p-2">
              {candidateLoading ? (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/45 px-6 text-center">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-sm">
                    <Layers3 size={20} />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    Loading assets
                  </p>
                  <p className="mt-1 max-w-56 text-xs leading-5 text-muted-foreground">
                    Scanning Local Hub and Extensions.
                  </p>
                </div>
              ) : availableItems.length === 0 ? (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/45 px-6 text-center">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-sm">
                    <Layers3 size={20} />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    No assets found
                  </p>
                  <p className="mt-1 max-w-56 text-xs leading-5 text-muted-foreground">
                    Try a different name search or switch tabs.
                  </p>
                </div>
              ) : (
                <div className="grid gap-1.5">
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
              )}
            </div>
          </div>

          {/* Selected (right column) */}
          <div className="flex min-h-0 min-w-0 flex-col rounded-2xl border border-primary/15 bg-primary/5 shadow-sm">
            <div className="border-b border-primary/15 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Added Assets
                </p>
                <span className="text-xs text-muted-foreground">
                  {selectedItems.length} shown
                </span>
              </div>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={15}
                />
                <input
                  type="text"
                  placeholder={`Search added ${tabLabels[activeTab]} by name`}
                  value={searchSelected}
                  onChange={(event) => setSearchSelected(event.target.value)}
                  className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>
            </div>
            <div className="min-h-[220px] flex-1 overflow-y-auto p-2">
              {selectedItems.length === 0 ? (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/45 px-6 text-center">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-sm">
                    <Layers3 size={20} />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    No added assets
                  </p>
                  <p className="mt-1 max-w-56 text-xs leading-5 text-muted-foreground">
                    Choose assets from the left panel to add them to this
                    Harness Kit.
                  </p>
                </div>
              ) : (
                <div className="grid gap-1.5">
                  {activeTab === "agent-config" &&
                    (selectedItems as NewHarnessKitAgentConfig[]).map((item) =>
                      renderAgentConfigRow(item, "remove", () => {
                        setSelectedAgentConfigIds((current) => {
                          const next = new Set(current);
                          next.delete(item.template_id);
                          return next;
                        });
                      }),
                    )}
                  {activeTab === "extensions-kit" &&
                    (
                      selectedItems as HarnessKitExtensionKitCandidate[]
                    ).map((item) =>
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
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
        <div className="min-h-5 flex-1">
          {formError && (
            <p className="text-sm font-semibold text-destructive">
              {formError}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!name.trim() || totalSelected === 0 || saving}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Harness Kit"}
        </button>
      </div>
    </div>
  );
}
