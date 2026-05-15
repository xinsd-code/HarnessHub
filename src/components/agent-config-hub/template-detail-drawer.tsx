import { X } from "lucide-react";
import { useAgentConfigTemplateStore } from "@/stores/agent-config-template-store";

export function TemplateDetailDrawer() {
  const templates = useAgentConfigTemplateStore((s) => s.templates);
  const selectedId = useAgentConfigTemplateStore((s) => s.selectedId);
  const select = useAgentConfigTemplateStore((s) => s.select);
  const contentCache = useAgentConfigTemplateStore((s) => s.contentCache);
  const template = templates.find((item) => item.id === selectedId);

  if (!template) return null;
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
            <pre className="mt-4 max-h-[360px] overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
              {content || "Loading..."}
            </pre>
          </div>
        </div>
      </aside>
    </>
  );
}
