import { useState } from "react";
import { useAgentConfigTemplateStore } from "@/stores/agent-config-template-store";

export function CreateTemplateDialog({ onClose }: { onClose: () => void }) {
  const createTemplate = useAgentConfigTemplateStore((s) => s.createTemplate);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("default");
  const [content, setContent] = useState("");

  const canSubmit = !!(name.trim() && content.trim());

  const handleSubmit = async () => {
    await createTemplate({
      sourceProjectPath: "",
      sourceProjectName: "",
      name,
      description,
      tag,
      content,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-label="New Agent Config"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="w-[720px] rounded-2xl border border-border/50 bg-card shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="border-b border-border/50 bg-muted/20 px-6 py-4">
          <h3 className="text-lg font-semibold">New Agent Config</h3>
        </div>
        <div className="space-y-4 p-6">
          <div className="space-y-1.5">
            <label
              htmlFor="new-agent-config-file-name"
              className="block text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest pl-1"
            >
              File name
            </label>
            <input
              id="new-agent-config-file-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. AGENTS.md"
              className="h-10 w-full rounded-xl border border-border/60 bg-card/40 px-3.5 text-sm shadow-sm outline-none backdrop-blur-sm transition-all focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="new-agent-config-description"
              className="block text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest pl-1"
            >
              Description
            </label>
            <input
              id="new-agent-config-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short description"
              className="h-10 w-full rounded-xl border border-border/60 bg-card/40 px-3.5 text-sm shadow-sm outline-none backdrop-blur-sm transition-all focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="new-agent-config-tag"
              className="block text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest pl-1"
            >
              Tag
            </label>
            <input
              id="new-agent-config-tag"
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              placeholder="default"
              className="h-10 w-full rounded-xl border border-border/60 bg-card/40 px-3.5 text-sm shadow-sm outline-none backdrop-blur-sm transition-all focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="new-agent-config-file-content"
              className="block text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest pl-1"
            >
              File content
            </label>
            <textarea
              id="new-agent-config-file-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="# Agent rules&#10;&#10;Write your agent configuration content here..."
              className="min-h-[320px] w-full rounded-xl border border-border/60 bg-card/40 px-3.5 py-2.5 text-sm shadow-sm outline-none backdrop-blur-sm transition-all focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20 resize-none font-mono leading-relaxed"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border/50 bg-muted/10 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-border/60 bg-card px-5 py-2.5 text-sm font-semibold shadow-sm transition-all hover:bg-accent hover:text-foreground"
          >
            Cancel
          </button>
          <button
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary"
          >
            Create Template
          </button>
        </div>
      </div>
    </div>
  );
}
