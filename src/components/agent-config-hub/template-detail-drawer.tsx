import { Maximize2, RefreshCw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useAgentConfigTemplateStore } from "@/stores/agent-config-template-store";
import { SyncTemplateDialog } from "./sync-template-dialog";

export function TemplateDetailDrawer() {
  const templates = useAgentConfigTemplateStore((s) => s.templates);
  const selectedId = useAgentConfigTemplateStore((s) => s.selectedId);
  const select = useAgentConfigTemplateStore((s) => s.select);
  const contentCache = useAgentConfigTemplateStore((s) => s.contentCache);
  const contentErrors = useAgentConfigTemplateStore((s) => s.contentErrors);
  const contentLoading = useAgentConfigTemplateStore((s) => s.contentLoading);
  const updateTag = useAgentConfigTemplateStore((s) => s.updateTag);
  const updateContent = useAgentConfigTemplateStore((s) => s.updateContent);
  const deleteTemplate = useAgentConfigTemplateStore((s) => s.deleteTemplate);
  const template = templates.find((item) => item.id === selectedId);

  const [editingTag, setEditingTag] = useState(false);
  const [tagValue, setTagValue] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [contentValue, setContentValue] = useState("");
  const [showSync, setShowSync] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!template) return null;

  const isLoading = contentLoading.has(template.id);
  const errorMsg = contentErrors.get(template.id);
  const content = contentCache.get(template.id) ?? "";

  return (
    <>
      <button
        type="button"
        aria-label="Close agent config details"
        onClick={() => select(null)}
        className="absolute inset-0 z-[5] cursor-default bg-transparent"
      />
      <aside className="absolute bottom-0 right-0 top-0 z-10 w-96 border-l border-border bg-background shadow-xl">
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between border-b border-border p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-base font-semibold">{template.name}</h3>
                <span className="inline-flex shrink-0 items-center" style={{ minWidth: 116 }}>
                  {editingTag ? (
                    <span className="inline-flex items-center gap-1">
                      <input
                        value={tagValue}
                        onChange={(event) => setTagValue(event.target.value)}
                        className="h-6 w-24 rounded border border-border bg-card px-1.5 text-xs"
                      />
                      <button
                        onClick={async () => { await updateTag(template.id, tagValue); setEditingTag(false); }}
                        className="rounded bg-primary px-2 py-0.5 text-[10px] text-primary-foreground"
                      >
                        Save
                      </button>
                    </span>
                  ) : (
                    <span
                      className="cursor-pointer rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
                      onDoubleClick={(e) => { e.stopPropagation(); setTagValue(template.tag || "default"); setEditingTag(true); }}
                      title="Double-click to edit tag"
                    >
                      {template.tag || "default"}
                    </span>
                  )}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{template.size_bytes} B</p>
            </div>
            <button
              onClick={() => select(null)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Close"
            >
              <X size={15} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <p className="text-sm text-muted-foreground">{template.description || "No description"}</p>
            <dl className="mt-4 grid grid-cols-[72px_1fr] gap-2 text-xs">
              <dt className="font-medium text-foreground">Source</dt>
              <dd className="truncate text-muted-foreground">{template.source_project_name}</dd>
              <dt className="font-medium text-foreground">Path</dt>
              <dd className="truncate text-muted-foreground">{template.source_path}</dd>
            </dl>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <button
                onClick={() => setShowSync(true)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-[12px] font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                <RefreshCw size={14} />
                Sync to Project
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] font-semibold text-destructive shadow-sm transition-all hover:-translate-y-0.5 hover:border-destructive/40 hover:bg-destructive/10"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
            
            <div className="mt-5 overflow-hidden rounded-xl border border-border/50 bg-muted/30 shadow-inner">
              <div className="flex items-center justify-between border-b border-border/50 bg-background/60 px-3.5 py-2.5">
                <span className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest">Content</span>
                <button
                  onClick={() => {
                    setContentValue(content);
                    setShowEditor(true);
                  }}
                  className="rounded-lg border border-border/50 bg-card/70 p-1.5 text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
                  title="Expand editor"
                  aria-label="Expand editor"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
              <div className="relative group/code">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity duration-300 group-hover/code:opacity-100 pointer-events-none" />
                <pre className="max-h-[360px] overflow-y-auto bg-muted/40 dark:bg-black/40 p-4 text-[12px] leading-relaxed text-foreground dark:text-[#D4D4D4] font-mono scrollbar-thin scrollbar-thumb-foreground/10 hover:scrollbar-thumb-foreground/20">
                  {isLoading ? "Loading..." : errorMsg ? <span className="text-destructive/90">{errorMsg}</span> : content || "(empty file)"}
                </pre>
              </div>
            </div>
          </div>
        </div>
        {confirmDelete && (
          <div role="dialog" aria-label="Delete agent config template" className="absolute inset-x-4 bottom-4 rounded-lg border border-border bg-background p-3 shadow-lg">
            <p className="text-sm text-muted-foreground">Delete only removes this template from ~/.harnesskit/agent-configs. Project files stay untouched.</p>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} className="rounded-lg border border-border px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={() => { void deleteTemplate(template.id); }} className="rounded-lg bg-destructive px-3 py-1.5 text-sm text-destructive-foreground">Delete</button>
            </div>
          </div>
        )}
      </aside>
      {showSync && template.id && (
        <SyncTemplateDialog templateId={template.id} onClose={() => setShowSync(false)} />
      )}
      {showEditor && (
        <div className="fixed inset-0 z-20">
          <button
            type="button"
            aria-label="Close content editor"
            onClick={() => setShowEditor(false)}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />
          <div role="dialog" aria-label="Edit agent config content" className="absolute inset-x-6 top-1/2 z-10 flex -translate-y-1/2 justify-center">
            <div className="w-[min(900px,calc(100vw-48px))] rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
              <div>
                <h4 className="text-sm font-semibold">{template.name}</h4>
                <p className="mt-1 text-xs text-muted-foreground">Edit and save this agent config template.</p>
              </div>
              <button
                onClick={() => setShowEditor(false)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Close editor"
                aria-label="Close editor"
              >
                <X size={15} />
              </button>
            </div>
            <div className="p-5">
              <textarea
                value={contentValue}
                onChange={(event) => setContentValue(event.target.value)}
                className="min-h-[420px] w-full rounded-xl border border-border/60 bg-card/40 p-4 text-[12px] leading-relaxed font-mono outline-none resize-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-border/50 bg-muted/10 px-5 py-4">
              <button
                onClick={() => setShowEditor(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await updateContent(template.id, contentValue);
                  setShowEditor(false);
                }}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground"
              >
                Save
              </button>
            </div>
          </div>
          </div>
        </div>
      )}
    </>
  );
}
