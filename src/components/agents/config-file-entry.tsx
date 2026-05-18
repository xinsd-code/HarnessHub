import { clsx } from "clsx";
import {
  Check,
  ChevronRight,
  Copy,
  FileSearch,
  FolderOpen,
  FolderSearch,
  Pencil,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useScrollPassthrough } from "@/hooks/use-scroll-passthrough";
import { openDirectoryPicker, openFilePicker } from "@/lib/dialog";
import type { AgentConfigFile } from "@/lib/types";
import { isDesktop } from "@/lib/transport";
import { useAgentConfigStore } from "@/stores/agent-config-store";

export function ConfigFileEntry({ file }: { file: AgentConfigFile }) {
  const expandedFiles = useAgentConfigStore((s) => s.expandedFiles);
  const toggleFile = useAgentConfigStore((s) => s.toggleFile);
  const fetchPreview = useAgentConfigStore((s) => s.fetchPreview);
  const openInEditor = useAgentConfigStore((s) => s.openInEditor);
  const revealInFinder = useAgentConfigStore((s) => s.revealInFinder);
  const copyPath = useAgentConfigStore((s) => s.copyPath);
  const updateCustomPath = useAgentConfigStore((s) => s.updateCustomPath);
  const removeCustomPath = useAgentConfigStore((s) => s.removeCustomPath);
  const previewCache = useAgentConfigStore((s) => s.previewCache);
  const previewLoading = useAgentConfigStore((s) => s.previewLoading);
  const previewErrors = useAgentConfigStore((s) => s.previewErrors);
  const pendingFocusFile = useAgentConfigStore((s) => s.pendingFocusFile);
  const setPendingFocusFile = useAgentConfigStore((s) => s.setPendingFocusFile);

  const handleNestedWheel = useScrollPassthrough();
  const isExpanded = expandedFiles.has(file.path);
  const preview = previewCache.get(file.path) ?? null;
  const isPreviewLoading = previewLoading.has(file.path);
  const previewError = previewErrors.get(file.path) ?? null;

  const [editing, setEditing] = useState(false);
  const [editPath, setEditPath] = useState(file.path);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    if (isExpanded && preview === null && file.exists) {
      fetchPreview(file.path);
    }
    if (!isExpanded && editing) {
      setEditing(false);
      setEditPath(file.path);
    }
  }, [isExpanded, file.path, fetchPreview, preview, editing, file.exists]);

  // Focus handoff: when the user navigates here with this file targeted (e.g.
  // from the Overview's Agent Activity widget), the parent ConfigSection has
  // already force-opened so this row is mounted. Scroll it into view, flash a
  // ring for ~1.5s, then clear the pending state so a subsequent navigation
  // to the same file re-triggers the effect.
  //
  // We clear pendingFocusFile *inside* the rAF (after the scroll fires) so the
  // store update doesn't cause a synchronous re-run that cancels our own rAF.
  // The highlight timer is split into its own effect so re-renders triggered
  // by the store update can't kill the 1.5s ring before it shows.
  useEffect(() => {
    if (pendingFocusFile !== file.path) return;
    const el = buttonRef.current;
    if (!el) return;
    // rAF lets the section's collapsed→expanded re-render settle before we
    // measure the row's position.
    const raf = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlight(true);
      setPendingFocusFile(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [pendingFocusFile, file.path, setPendingFocusFile]);

  // Clear the highlight 1.5s after it turns on. Independent of pendingFocusFile
  // so a same-frame store update doesn't cancel the timer prematurely.
  useEffect(() => {
    if (!highlight) return;
    const timer = setTimeout(() => setHighlight(false), 1500);
    return () => clearTimeout(timer);
  }, [highlight]);

  const scopePath =
    file.custom_id != null
      ? file.path
      : file.scope.type === "global"
        ? file.path.slice(0, file.path.lastIndexOf(file.file_name))
        : file.scope.path;
  const sizeLabel =
    file.size_bytes < 1024
      ? `${file.size_bytes} B`
      : `${(file.size_bytes / 1024).toFixed(1)} KB`;

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <button
        ref={buttonRef}
        onClick={() => toggleFile(file.path)}
        className={clsx(
          "flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-accent/30",
          isExpanded && "bg-accent/20",
          highlight &&
            "ring-2 ring-primary ring-inset bg-primary/5 transition-all",
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <ChevronRight
            size={14}
            className={clsx(
              "shrink-0 text-muted-foreground/60 transition-transform duration-200",
              isExpanded && "rotate-90 text-primary",
            )}
          />
          <span
            className={clsx(
              "text-[13px] font-medium truncate",
              !file.exists && "text-muted-foreground line-through",
            )}
          >
            {file.file_name}
          </span>
          {!file.exists && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0 inline-flex items-center gap-1">
              <TriangleAlert size={10} /> Missing
            </span>
          )}
          {file.custom_id == null &&
            (file.scope.type === "global" ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-tag-global/10 text-tag-global shrink-0">
                Agent path
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-tag-project/10 text-tag-project shrink-0">
                Project path
              </span>
            ))}
          <span className="text-[11px] text-muted-foreground truncate">
            {scopePath}
          </span>
        </div>
        {!file.is_dir && (
          <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
            {sizeLabel}
          </span>
        )}
      </button>
      {isExpanded && (
        <div className="border-t border-border/40 bg-muted/20 px-5 py-4 shadow-inner animate-in slide-in-from-top-2 duration-200">
          {!file.exists ? (
            <div className="text-[12px] font-medium text-destructive/90 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              Path does not exist. Use Edit to update or Remove to delete this entry.
            </div>
          ) : previewError !== null ? (
            <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-3 text-[12px] font-medium text-destructive/90 shadow-sm">
              {previewError}
            </div>
          ) : preview !== null ? (
            <div className="relative group/code">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity duration-300 group-hover/code:opacity-100 rounded-xl pointer-events-none" />
              <pre
                onWheel={handleNestedWheel}
                className="text-[12px] leading-relaxed font-mono whitespace-pre-wrap max-h-[240px] overflow-y-auto mb-4 bg-muted/40 dark:bg-black/40 text-foreground dark:text-[#D4D4D4] p-4 rounded-xl shadow-inner border border-border/50 scrollbar-thin scrollbar-thumb-foreground/10 hover:scrollbar-thumb-foreground/20"
              >
                {preview || (file.is_dir ? "(empty directory)" : "(empty file)")}
              </pre>
            </div>
          ) : (
            <div className="text-[12px] font-medium text-muted-foreground mb-4 flex items-center gap-2 px-1">
              {isPreviewLoading && <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
              {isPreviewLoading ? "Loading preview..." : "Preview unavailable."}
            </div>
          )}

          {/* Edit form for custom paths */}
          {editing && file.custom_id != null && (
            <div className="mb-3 flex items-center gap-1.5 rounded-md border border-border bg-background p-2">
              <input
                type="text"
                value={editPath}
                onChange={(e) => setEditPath(e.target.value)}
                placeholder="Path"
                className="flex-1 rounded-md border border-border bg-card px-2.5 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {isDesktop() && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const selected = await openFilePicker({
                      title: "Select file",
                    });
                    if (selected) setEditPath(selected);
                  }}
                  className="shrink-0 rounded-md border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title="Browse file..."
                >
                  <FileSearch size={13} />
                </button>
              )}
              {isDesktop() && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const selected = await openDirectoryPicker({
                      title: "Select folder",
                    });
                    if (selected) setEditPath(selected);
                  }}
                  className="shrink-0 rounded-md border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title="Browse folder..."
                >
                  <FolderSearch size={13} />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(false);
                }}
                className="shrink-0 rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                title="Cancel"
              >
                <X size={13} />
              </button>
              <button
                disabled={!editPath.trim()}
                onClick={async (e) => {
                  e.stopPropagation();
                  await updateCustomPath(
                    file.custom_id!,
                    editPath.trim(),
                    "",
                    file.category,
                  );
                  setEditing(false);
                }}
                className="shrink-0 rounded-md bg-primary p-1.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                title="Save"
              >
                <Check size={13} />
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2.5">
            {file.exists && (
              <>
                {isDesktop() && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openInEditor(file.path);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3.5 py-1.5 text-[12px] font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent hover:border-primary/40 hover:text-foreground"
                  >
                    {file.is_dir ? (
                      <FolderOpen size={14} className="text-primary/70" />
                    ) : (
                      <FileSearch size={14} className="text-primary/70" />
                    )}{" "}
                    {file.is_dir ? "Reveal in Finder" : "Open in Editor"}
                  </button>
                )}
                {isDesktop() && !file.is_dir && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      revealInFinder(file.path);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3.5 py-1.5 text-[12px] font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent hover:border-primary/40 hover:text-foreground"
                  >
                    <FolderOpen size={14} className="text-primary/70" /> Reveal in Finder
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyPath(file.path);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3.5 py-1.5 text-[12px] font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent hover:border-primary/40 hover:text-foreground"
                >
                  <Copy size={14} className="text-primary/70" /> Copy Path
                </button>
              </>
            )}
            {file.custom_id != null && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditPath(file.path);
                    setEditing(!editing);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-accent"
                >
                  <Pencil size={12} /> Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeCustomPath(file.custom_id!);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 size={12} /> Remove
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
