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
import { useState } from "react";
import type { HarnessKitAssets, HarnessKitSummary } from "@/lib/types";

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
}: Props) {
  const [expanded, setExpanded] = useState({
    agentConfig: false,
    extensionsKit: false,
    skills: false,
    mcp: false,
  });

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
                      <div className="mt-1 space-y-0.5">
                        {group.rows.map((row) => (
                          <div
                            key={row.id}
                            className="group flex items-center gap-2 rounded-md px-1 py-1.5 transition-colors hover:bg-accent/50"
                          >
                            <span className="text-muted-foreground shrink-0">
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
                                className="shrink-0 rounded p-1 text-muted-foreground/80 transition-all hover:bg-accent hover:text-primary"
                              >
                                <ExternalLink size={13} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
