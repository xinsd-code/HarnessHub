import { Blocks, CheckCircle2, Plus, Server, Terminal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ExtensionKind, KitAssetCandidate } from "@/lib/types";
import { useKitStore } from "@/stores/kit-store";

const tabs: Array<{ key: "skill" | "mcp" | "cli"; label: string }> = [
  { key: "skill", label: "Skills" },
  { key: "mcp", label: "MCP" },
  { key: "cli", label: "CLI" },
];

function countSelected(candidates: KitAssetCandidate[], selected: Set<string>, kind: ExtensionKind) {
  return candidates.filter((candidate) => candidate.kind === kind && selected.has(candidate.id)).length;
}

export default function HarnessKitPage() {
  const kits = useKitStore((s) => s.kits);
  const candidates = useKitStore((s) => s.candidates);
  const loading = useKitStore((s) => s.loading);
  const candidateLoading = useKitStore((s) => s.candidateLoading);
  const fetch = useKitStore((s) => s.fetch);
  const fetchCandidates = useKitStore((s) => s.fetchCandidates);
  const createKit = useKitStore((s) => s.createKit);
  const deleteKit = useKitStore((s) => s.deleteKit);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<"skill" | "mcp" | "cli">("skill");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  useEffect(() => {
    if (showCreate) void fetchCandidates();
  }, [showCreate, fetchCandidates]);

  const visibleCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.kind === activeTab),
    [activeTab, candidates],
  );

  const selectedSummary = `${countSelected(candidates, selected, "skill")} Skills · ${countSelected(candidates, selected, "mcp")} MCP · ${countSelected(candidates, selected, "cli")} CLI`;

  const resetForm = () => {
    setName("");
    setDescription("");
    setSelected(new Set());
    setActiveTab("skill");
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

  return (
    <div className="flex min-h-0 flex-1 gap-5">
      <aside className="w-44 shrink-0 border-r border-border pr-3">
        <div className="mb-3 px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          HarnessKit
        </div>
        <button className="w-full rounded-lg bg-accent px-3 py-2 text-left text-sm font-semibold text-foreground">
          Extensions Kit
        </button>
      </aside>

      <main className="min-w-0 flex-1 space-y-5 pb-4">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">HarnessKit</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              一个组合的 Skills、MCP、CLI，形成可追溯的 Kit 清单。保存前自动把未在 Local Hub 的资产同步进去。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent"
          >
            <Plus size={14} />
            New Kit
          </button>
        </header>

        {loading && kits.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
            Loading Kits...
          </div>
        ) : kits.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
            No Kits yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {kits.map((kit) => (
              <article key={kit.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{kit.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{kit.description || "No description"}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${kit.name}`}
                    onClick={() => {
                      if (window.confirm(`Delete ${kit.name}? Local Hub assets will be preserved.`)) {
                        void deleteKit(kit.id);
                      }
                    }}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-border px-2 py-1">Skills {kit.skills_count}</span>
                  <span className="rounded-full border border-border px-2 py-1">MCP {kit.mcp_count}</span>
                  <span className="rounded-full border border-border px-2 py-1">CLI {kit.cli_count}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">New Kit</h3>
              <span className="text-xs text-muted-foreground">{selectedSummary}</span>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm font-medium">
                Kit name
                <input
                  aria-label="Kit name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Description
                <textarea
                  aria-label="Description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-20 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={activeTab === tab.key ? "rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold" : "rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent/60"}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-border">
              {candidateLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading assets...</div>
              ) : visibleCandidates.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No assets in this category.</div>
              ) : (
                visibleCandidates.map((candidate) => (
                  <label key={candidate.id} className="flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
                    <input
                      type="checkbox"
                      aria-label={`${candidate.name} ${candidate.source_status}`}
                      checked={selected.has(candidate.id)}
                      onChange={() => {
                        setSelected((current) => {
                          const next = new Set(current);
                          if (next.has(candidate.id)) next.delete(candidate.id);
                          else next.add(candidate.id);
                          return next;
                        });
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {candidate.kind === "skill" && <Blocks size={14} />}
                        {candidate.kind === "mcp" && <Server size={14} />}
                        {candidate.kind === "cli" && <Terminal size={14} />}
                        <span className="font-medium">{candidate.name}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{candidate.description || "No description"}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                      <CheckCircle2 size={12} />
                      {candidate.source_status === "in_local_hub" ? "In Local Hub" : "Will sync to Local Hub"}
                    </span>
                  </label>
                ))
              )}
            </div>

            {formError && <p className="mt-3 text-sm text-destructive">{formError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowCreate(false);
                }}
                className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Save Kit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
