import { X } from "lucide-react";
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
  const deleteTemplate = useAgentConfigTemplateStore((s) => s.deleteTemplate);
  const template = templates.find((item) => item.id === selectedId);

  const [editingTag, setEditingTag] = useState(false);
  const [tagValue, setTagValue] = useState("");
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
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold">{template.name}</h3>
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
              <dt className="font-medium text-foreground">Tag</dt>
              <dd className="text-muted-foreground">{template.tag || "default"}</dd>
              <dt className="font-medium text-foreground">Source</dt>
              <dd className="truncate text-muted-foreground">{template.source_project_name}</dd>
              <dt className="font-medium text-foreground">Path</dt>
              <dd className="truncate text-muted-foreground">{template.source_path}</dd>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => { setTagValue(template.tag || "default"); setEditingTag(true); }}
                className="rounded-lg border border-border bg-card px-2 py-1 text-xs transition-colors hover:bg-accent"
              >
                Edit tag
              </button>
              <button
                onClick={() => setShowSync(true)}
                className="rounded-lg border border-border bg-card px-2 py-1 text-xs transition-colors hover:bg-accent"
              >
                Sync to Project
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg border border-destructive/30 bg-card px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/5"
              >
                Delete
              </button>
            </div>
            {editingTag && (
              <div className="mt-2 flex gap-2">
                <input
                  value={tagValue}
                  onChange={(event) => setTagValue(event.target.value)}
                  className="h-8 flex-1 rounded-md border border-border bg-card px-2 text-sm"
                />
                <button
                  onClick={async () => { await updateTag(template.id, tagValue); setEditingTag(false); }}
                  className="rounded-lg bg-primary px-3 py-1 text-xs text-primary-foreground"
                >
                  Save
                </button>
              </div>
            )}
            <pre className="mt-4 max-h-[360px] overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
              {isLoading ? "Loading..." : errorMsg ? errorMsg : content || "No content"}
            </pre>
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
    </>
  );
}
