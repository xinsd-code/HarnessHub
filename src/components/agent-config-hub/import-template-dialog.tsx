import { useState } from "react";
import { openFilePicker, selectedPickerPath } from "@/lib/platform/dialog";
import { isDesktop } from "@/lib/transport";
import { useAgentConfigTemplateStore } from "@/stores/agent-config-template-store";

function fileNameFromPath(path: string): string {
  const trimmed = path.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const index = trimmed.lastIndexOf("/");
  return index >= 0 ? trimmed.slice(index + 1) : trimmed;
}

function parentPathFrom(path: string): string {
  const trimmed = path.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const index = trimmed.lastIndexOf("/");
  if (index < 0) return "";
  if (index === 0) return "/";
  return trimmed.slice(0, index);
}

export function ImportTemplateDialog({ onClose }: { onClose: () => void }) {
  const importTemplate = useAgentConfigTemplateStore((s) => s.importTemplate);

  const [localPath, setLocalPath] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("default");

  const localSourcePath = localPath.trim();
  const localSourceProjectPath = parentPathFrom(localSourcePath);
  const localSourceProjectName =
    fileNameFromPath(localSourceProjectPath) || "Local path";
  const canSubmit = !!(localSourcePath && name.trim());

  const handleSubmit = async () => {
    if (!localSourcePath) return;
    await importTemplate({
      sourcePath: localSourcePath,
      sourceProjectPath: localSourceProjectPath,
      sourceProjectName: localSourceProjectName,
      name,
      description,
      tag,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-label="Input From Local"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="w-[640px] rounded-2xl border border-border/50 bg-card shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="border-b border-border/50 bg-muted/20 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Input From Local</h3>
        </div>
        <div className="p-6 flex gap-6">
          <div className="w-[280px] shrink-0 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="agent-config-file-path"
                className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest pl-1"
              >
                File path
              </label>
              <div className="flex gap-2">
                <input
                  id="agent-config-file-path"
                  value={localPath}
                  onChange={(event) => {
                    const nextPath = event.target.value;
                    setLocalPath(nextPath);
                    if (!name.trim()) {
                      setName(fileNameFromPath(nextPath));
                    }
                  }}
                  onBlur={() => {
                    if (!name.trim()) {
                      setName(fileNameFromPath(localPath));
                    }
                  }}
                  placeholder="Paste or choose a local file path"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-border/60 bg-card/40 px-3.5 text-sm shadow-sm outline-none backdrop-blur-sm transition-all focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
                />
                {isDesktop() && (
                  <button
                    type="button"
                    onClick={async () => {
                      const result = await openFilePicker({
                        title: "Select local file",
                      });
                      const selectedPath = selectedPickerPath(result);
                      if (selectedPath) {
                        setLocalPath(selectedPath);
                        setName(fileNameFromPath(selectedPath));
                      }
                    }}
                    className="shrink-0 rounded-xl border border-border/60 bg-card/60 px-3 text-[12px] font-semibold shadow-sm transition-colors hover:bg-accent hover:text-foreground"
                  >
                    Browse
                  </button>
                )}
              </div>
              <p className="px-1 text-[11px] text-muted-foreground/70">
                Choose a file directly, or paste its full path here.
              </p>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-4 py-1">
            <div className="space-y-1.5">
              <label
                htmlFor="agent-config-file-name"
                className="block text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest pl-1"
              >
                File name
              </label>
              <input
                id="agent-config-file-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. AGENTS.md"
                className="h-10 w-full rounded-xl border border-border/60 bg-card/40 px-3.5 text-sm shadow-sm outline-none backdrop-blur-sm transition-all focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="agent-config-description"
                className="block text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest pl-1"
              >
                Description
              </label>
              <input
                id="agent-config-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Short description"
                className="h-10 w-full rounded-xl border border-border/60 bg-card/40 px-3.5 text-sm shadow-sm outline-none backdrop-blur-sm transition-all focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="agent-config-tag"
                className="block text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest pl-1"
              >
                Tag
              </label>
              <input
                id="agent-config-tag"
                value={tag}
                onChange={(event) => setTag(event.target.value)}
                placeholder="default"
                className="h-10 w-full rounded-xl border border-border/60 bg-card/40 px-3.5 text-sm shadow-sm outline-none backdrop-blur-sm transition-all focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
              />
            </div>
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
            Import Template
          </button>
        </div>
      </div>
    </div>
  );
}
