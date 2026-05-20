import {
  ChevronDown,
  ChevronRight,
  FileText,
  Layers3,
  Pencil,
  Server,
  Blocks,
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
};

export function HarnessKitDetailDrawer({
  harnessKit,
  assets,
  loading,
  editing,
  onEdit,
  onClose,
  editor,
}: Props) {
  const [expanded, setExpanded] = useState({
    agentConfig: true,
    extensionsKit: true,
    skills: false,
    mcp: false,
  });

  if (editing) {
    return (
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-6xl flex-col border-l border-border bg-background shadow-xl">
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
      rows: assets.agent_configs.map((item) => item.template_name),
    },
    {
      key: "extensionsKit" as const,
      label: "Extensions Kit",
      icon: Layers3,
      count: assets.extension_kits.length,
      rows: assets.extension_kits.map((item) => item.kit_name),
    },
    {
      key: "skills" as const,
      label: "Extra Skills",
      icon: Blocks,
      count: skills.length,
      rows: skills.map((item) => item.asset_name),
    },
    {
      key: "mcp" as const,
      label: "Extra MCP",
      icon: Server,
      count: mcps.length,
      rows: mcps.map((item) => item.asset_name),
    },
  ];

  return (
    <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background shadow-xl">
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
                      <div className="mt-2 border border-dashed border-border bg-background/60 px-3 py-4 text-center text-sm text-muted-foreground">
                        No assets in this group.
                      </div>
                    ) : (
                      <div className="mt-2 divide-y divide-border rounded-lg border border-border bg-background">
                        {group.rows.map((name) => (
                          <div
                            key={name}
                            className="px-3 py-2 text-sm font-medium text-foreground"
                          >
                            {name}
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
