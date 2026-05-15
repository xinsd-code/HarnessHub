import { FileText, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAgentConfigTemplateStore } from "@/stores/agent-config-template-store";
import { ImportTemplateDialog } from "./import-template-dialog";
import { TemplateDetailDrawer } from "./template-detail-drawer";

export function AgentConfigHubPage() {
  const templates = useAgentConfigTemplateStore((s) => s.templates);
  const loading = useAgentConfigTemplateStore((s) => s.loading);
  const fetch = useAgentConfigTemplateStore((s) => s.fetch);
  const selectedId = useAgentConfigTemplateStore((s) => s.selectedId);
  const select = useAgentConfigTemplateStore((s) => s.select);
  const searchQuery = useAgentConfigTemplateStore((s) => s.searchQuery);
  const setSearchQuery = useAgentConfigTemplateStore((s) => s.setSearchQuery);
  const tagFilter = useAgentConfigTemplateStore((s) => s.tagFilter);
  const setTagFilter = useAgentConfigTemplateStore((s) => s.setTagFilter);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const tags = useMemo(() => {
    return ["all", ...Array.from(new Set(templates.map((template) => template.tag || "default"))).sort()];
  }, [templates]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return templates.filter((template) => {
      if (tagFilter !== "all" && template.tag !== tagFilter) return false;
      if (!q) return true;
      return (
        template.name.toLowerCase().includes(q) ||
        template.description.toLowerCase().includes(q) ||
        template.source_project_name.toLowerCase().includes(q)
      );
    });
  }, [templates, tagFilter, searchQuery]);

  return (
    <div className="relative flex flex-1 flex-col min-h-0">
      <div className="shrink-0 space-y-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Agent Config</h2>
            <p className="mt-1 text-sm text-muted-foreground">Prompt templates stored in ~/.harnesskit/agent-configs</p>
          </div>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
          >
            <Plus size={13} />
            Import from Project
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-64 flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
              placeholder="Search templates..."
            />
          </div>
          <select
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
          >
            {tags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border">
        <div className="grid grid-cols-[1fr_1.3fr_140px_1fr_120px] gap-3 border-b border-border bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <div>Name</div>
          <div>Description</div>
          <div>Tag</div>
          <div>Source</div>
          <div>Updated</div>
        </div>
        {loading && filtered.length === 0 ? (
          <div className="p-5 text-sm text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <FileText size={22} />
            No agent config templates yet.
          </div>
        ) : (
          filtered.map((template) => (
            <button
              key={template.id}
              onClick={() => select(template.id)}
              className="grid w-full grid-cols-[1fr_1.3fr_140px_1fr_120px] gap-3 border-b border-border/60 px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/30"
            >
              <span className="font-medium text-foreground">{template.name}</span>
              <span className="truncate text-muted-foreground">{template.description || "No description"}</span>
              <span><span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{template.tag || "default"}</span></span>
              <span className="truncate text-muted-foreground">{template.source_project_name}</span>
              <span className="text-muted-foreground">{new Date(template.updated_at).toLocaleDateString()}</span>
            </button>
          ))
        )}
      </div>

      {selectedId && <TemplateDetailDrawer />}
      {showImport && <ImportTemplateDialog onClose={() => setShowImport(false)} />}
    </div>
  );
}
