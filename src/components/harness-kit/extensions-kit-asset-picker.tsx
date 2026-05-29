import {
  ArrowLeft,
  ArrowRight,
  Blocks,
  CheckCircle2,
  Layers3,
  Search,
  Server,
} from "lucide-react";
import type { ElementType } from "react";
import type { ExtensionKind, KitAssetCandidate } from "@/lib/types";

export type KitTab = "skill" | "mcp";

export const tabs: Array<{ key: KitTab; label: string; icon: ElementType }> = [
  { key: "skill", label: "Skills", icon: Blocks },
  { key: "mcp", label: "MCP", icon: Server },
];

export function countSelected(
  candidates: KitAssetCandidate[],
  selected: Set<string>,
  kind: ExtensionKind,
) {
  return candidates.filter(
    (candidate) => candidate.kind === kind && selected.has(candidate.id),
  ).length;
}

export function AssetIcon({ kind }: { kind: ExtensionKind }) {
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

export function ExtensionsKitAssetPicker({
  activeTab,
  availableFiltered,
  candidateLoading,
  candidates,
  onSelect,
  onTabChange,
  searchAvailable,
  searchSelected,
  selected,
  selectedFiltered,
  selectedSummary,
  setSearchAvailable,
  setSearchSelected,
  variant,
}: {
  activeTab: KitTab;
  availableFiltered: KitAssetCandidate[];
  candidateLoading: boolean;
  candidates: KitAssetCandidate[];
  onSelect: (candidateId: string, selected: boolean) => void;
  onTabChange: (tab: KitTab) => void;
  searchAvailable: string;
  searchSelected: string;
  selected: Set<string>;
  selectedFiltered: KitAssetCandidate[];
  selectedSummary: string;
  setSearchAvailable: (value: string) => void;
  setSearchSelected: (value: string) => void;
  variant: "create" | "edit";
}) {
  const availableColumnClass =
    variant === "edit"
      ? "flex min-h-0 min-w-0 flex-col rounded-2xl border border-border/70 bg-card/65 shadow-sm"
      : "flex min-h-0 min-w-0 flex-col";
  const selectedColumnClass =
    variant === "edit"
      ? "flex min-h-0 min-w-0 flex-col rounded-2xl border border-primary/15 bg-primary/5 shadow-sm"
      : "flex min-h-0 min-w-0 flex-col";
  const headerClass =
    variant === "edit"
      ? "border-b border-border/70 p-3"
      : "border-b border-border/60 pb-3 pt-1";

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-muted/10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/55 px-4 py-3">
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
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
          Added <span className="text-foreground">{selectedSummary}</span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-6 p-4 lg:grid-cols-2">
        <div className={availableColumnClass}>
          <div className={headerClass}>
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
                onChange={(event) => setSearchAvailable(event.target.value)}
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
                    onClick={() => onSelect(candidate.id, true)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={selectedColumnClass}>
          <div
            className={
              variant === "edit"
                ? "border-b border-primary/15 p-3"
                : headerClass
            }
          >
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
                onChange={(event) => setSearchSelected(event.target.value)}
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
                    onClick={() => onSelect(candidate.id, false)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
