import { clsx } from "clsx";
import {
  FolderOpen,
  FolderSearch,
  Loader2,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  type DiscoveredProject,
  normalizePathForComparison,
  type Project,
} from "@/lib/types";

type ProjectPathsSectionProps = {
  adding: boolean;
  discoveredProjects: DiscoveredProject[] | null;
  discoveredSelected: Set<string>;
  existingPaths: Set<string>;
  isDesktop: boolean;
  loading: boolean;
  onAddDiscovered: () => void;
  onAddPath: (path: string) => void;
  onBrowseProject: () => void;
  onCancelDiscovered: () => void;
  onInputChange: (value: string) => void;
  onRemoveProject: (id: string) => void;
  onToggleDiscovered: (path: string) => void;
  projectPathInput: string;
  projects: Project[];
};

export function ProjectPathsSection({
  adding,
  discoveredProjects,
  discoveredSelected,
  existingPaths,
  isDesktop,
  loading,
  onAddDiscovered,
  onAddPath,
  onBrowseProject,
  onCancelDiscovered,
  onInputChange,
  onRemoveProject,
  onToggleDiscovered,
  projectPathInput,
  projects,
}: ProjectPathsSectionProps) {
  const trimmedInput = projectPathInput.trim();

  return (
    <section id="project-paths" className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground tracking-tight">
          Projects Configuration
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Add project directories to scan their local extensions
          (.claude/skills, .mcp.json, hooks).
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder={
            isDesktop
              ? "Paste a project path or browse..."
              : "Paste a project path..."
          }
          value={projectPathInput}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && trimmedInput) onAddPath(trimmedInput);
          }}
          className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {isDesktop && (
          <button
            type="button"
            disabled={adding}
            onClick={onBrowseProject}
            className="shrink-0 rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 active:scale-95"
            title="Browse..."
          >
            <FolderSearch size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={() => onAddPath(trimmedInput)}
          disabled={adding || !trimmedInput}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-[color,background-color,box-shadow] duration-200 hover:bg-primary/90 hover:shadow-md disabled:opacity-50 active:scale-95"
        >
          {adding ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Plus size={12} />
          )}
          <span>Add Project</span>
        </button>
      </div>

      {discoveredProjects !== null && (
        <div className="space-y-3 rounded-lg bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground">
            The selected directory is not a project. Found{" "}
            {discoveredProjects.length} project(s) inside:
          </p>
          {discoveredProjects.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No projects found.
            </p>
          ) : (
            <>
              <div className="space-y-1 max-h-48 overflow-y-auto overscroll-contain">
                {discoveredProjects.map((project) => {
                  const already = existingPaths.has(
                    normalizePathForComparison(project.path),
                  );
                  return (
                    <label
                      key={project.path}
                      className={clsx(
                        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer transition-colors",
                        already
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-muted",
                      )}
                    >
                      <input
                        type="checkbox"
                        disabled={already}
                        checked={discoveredSelected.has(project.path)}
                        onChange={() => onToggleDiscovered(project.path)}
                        className="rounded border-border"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-foreground">
                          {project.name}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground truncate">
                          {project.path}
                        </span>
                      </div>
                      {already && (
                        <span className="text-xs text-muted-foreground">
                          Added
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancelDiscovered}
                  className="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onAddDiscovered}
                  disabled={discoveredSelected.size === 0 || adding}
                  className="rounded-lg bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Add Selected ({discoveredSelected.size})
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/25 p-8 text-center">
          <FolderOpen size={24} className="mx-auto text-muted-foreground/45" />
          <h4 className="mt-3 text-sm font-semibold text-foreground">
            No projects yet
          </h4>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-sm mx-auto">
            Add a project directory to scan for local extensions and manage
            their settings.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className={clsx(
                "group flex w-full items-center justify-between gap-3 rounded-xl border p-4 transition-all duration-300 hover:border-border/90 hover:bg-card/75 hover:shadow-xs",
                project.exists
                  ? "border-border/50 bg-card/45"
                  : "border-destructive/20 bg-destructive/[0.015] hover:border-destructive/40 hover:bg-destructive/[0.03]",
              )}
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground group-hover:scale-105 group-hover:bg-primary/5 group-hover:text-primary transition-all duration-300">
                  <FolderOpen size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        "font-semibold text-sm tracking-tight",
                        project.exists
                          ? "text-foreground"
                          : "text-muted-foreground/75 line-through",
                      )}
                    >
                      {project.name}
                    </span>
                    {!project.exists && (
                      <span className="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded bg-destructive/10 text-destructive inline-flex items-center gap-1">
                        <TriangleAlert size={9} /> Missing
                      </span>
                    )}
                  </div>
                  <span className="block text-xs text-muted-foreground mt-0.5 truncate">
                    {project.path}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemoveProject(project.id)}
                className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10 transition-all duration-200 cursor-pointer focus:outline-none active:scale-90"
                aria-label={`Remove ${project.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
