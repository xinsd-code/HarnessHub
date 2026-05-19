import { FileText, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAgentConfigTemplateStore } from "@/stores/agent-config-template-store";
import { CreateTemplateDialog } from "./create-template-dialog";
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
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const tags = useMemo(() => {
    return [
      "all",
      ...Array.from(
        new Set(templates.map((template) => template.tag || "default")),
      ).sort(),
    ];
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
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-br from-background via-background/95 to-accent/5">
      <div className="shrink-0 space-y-5 px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Agent Config
            </h2>
            <p className="mt-1.5 text-[14px] text-muted-foreground/80">
              Prompt templates stored in ~/.harnesskit/agent-configs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-[12px] font-semibold shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card/90 hover:shadow-md"
            >
              <Plus size={14} className="text-primary" />
              New Agent Config
            </button>
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-[12px] font-semibold shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card/90 hover:shadow-md"
            >
              <Plus size={14} className="text-primary" />
              Import from Project
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-64 flex-1 group">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors group-focus-within:text-primary"
            />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-10 w-full rounded-xl border border-border/60 bg-card/40 pl-10 pr-4 text-sm shadow-sm outline-none backdrop-blur-sm transition-all focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
              placeholder="Search templates..."
            />
          </div>
          <div className="flex flex-1 items-center gap-2 overflow-x-auto pb-1">
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setTagFilter(tag)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-all shadow-sm ${
                  tagFilter === tag
                    ? "bg-[#415CC6] text-white"
                    : "bg-muted/60 text-muted-foreground border border-border/40 hover:bg-accent hover:text-foreground"
                }`}
              >
                {tag === "all" ? "All" : tag}
              </button>
            ))}
            <span className="ml-auto pl-4 text-sm font-medium text-muted-foreground/80 shrink-0">
              {filtered.length} {filtered.length === 1 ? "result" : "results"}
            </span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        <div className="rounded-2xl border border-border/50 bg-card/30 shadow-sm backdrop-blur-sm overflow-hidden">
          <div className="grid grid-cols-[1.2fr_1.5fr_140px_1fr_120px] gap-4 border-b border-border/50 bg-muted/40 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">
            <div>Name</div>
            <div>Description</div>
            <div>Tag</div>
            <div>Source</div>
            <div>Updated</div>
          </div>
          {loading && filtered.length === 0 ? (
            <div className="flex items-center justify-center p-12 text-sm font-medium text-muted-foreground animate-pulse">
              Loading templates...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-16 text-sm text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/50 text-muted-foreground">
                <FileText size={24} />
              </div>
              <p>No agent config templates yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filtered.map((template) => (
                <button
                  key={template.id}
                  onClick={() => select(template.id)}
                  className="group grid w-full grid-cols-[1.2fr_1.5fr_140px_1fr_120px] gap-4 px-5 py-4 text-left text-sm transition-all hover:bg-accent/40"
                >
                  <span className="font-semibold text-foreground/90 group-hover:text-primary transition-colors flex items-center gap-2">
                    <FileText
                      size={14}
                      className="text-muted-foreground/50 group-hover:text-primary/70 transition-colors"
                    />
                    {template.name}
                  </span>
                  <span className="truncate text-muted-foreground/80">
                    {template.description || "No description"}
                  </span>
                  <span>
                    <span className="inline-flex rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground/90 shadow-sm">
                      {template.tag || "default"}
                    </span>
                  </span>
                  <span className="truncate text-muted-foreground/80 font-mono text-xs mt-0.5">
                    {template.source_project_name}
                  </span>
                  <span className="text-muted-foreground/70 text-xs mt-0.5">
                    {new Date(template.updated_at).toLocaleDateString(
                      undefined,
                      { year: "numeric", month: "short", day: "numeric" },
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedId && <TemplateDetailDrawer />}
      {showCreate && (
        <CreateTemplateDialog onClose={() => setShowCreate(false)} />
      )}
      {showImport && (
        <ImportTemplateDialog onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}
