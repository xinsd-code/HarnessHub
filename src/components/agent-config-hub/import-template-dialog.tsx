import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { AgentMascot } from "@/components/shared/agent-mascot/agent-mascot";
import { useAgentConfigStore } from "@/stores/agent-config-store";
import { useAgentConfigTemplateStore } from "@/stores/agent-config-template-store";
import { useProjectStore } from "@/stores/project-store";
import { pathsEqual } from "@/lib/types";

export function ImportTemplateDialog({ onClose }: { onClose: () => void }) {
  const projects = useProjectStore((s) => s.projects).filter((p) => p.exists);
  const agentDetails = useAgentConfigStore((s) => s.agentDetails);
  const importTemplate = useAgentConfigTemplateStore((s) => s.importTemplate);

  const [projectPath, setProjectPath] = useState(projects[0]?.path ?? "");
  const [targetAgent, setTargetAgent] = useState("");
  const [sourcePath, setSourcePath] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("default");

  const projectAgents = useMemo(() => {
    return agentDetails.filter((agent) =>
      agent.config_files.some(
        (file) =>
          file.exists &&
          file.category === "rules" &&
          file.scope.type === "project" &&
          pathsEqual(file.scope.path, projectPath),
      ),
    );
  }, [agentDetails, projectPath]);

  const agentFiles = useMemo(() => {
    if (!targetAgent) return [];
    const agent = agentDetails.find((a) => a.name === targetAgent);
    if (!agent) return [];
    return agent.config_files
      .filter(
        (file) =>
          file.exists &&
          file.category === "rules" &&
          file.scope.type === "project" &&
          pathsEqual(file.scope.path, projectPath),
      )
      .map((file) => ({
        ...file,
        relPath: file.path.startsWith(projectPath + "/")
          ? file.path.slice(projectPath.length + 1)
          : file.path,
      }));
  }, [agentDetails, projectPath, targetAgent]);

  const selected = agentFiles.find((file) => file.path === sourcePath) ?? null;
  const canSubmit = !!(selected && name.trim());

  const handleSubmit = async () => {
    if (!selected || selected.scope.type !== "project") return;
    await importTemplate({
      sourcePath: selected.path,
      sourceProjectPath: selected.scope.path,
      sourceProjectName: selected.scope.name,
      name,
      description,
      tag,
    });
    onClose();
  };

  return (
    <div role="dialog" aria-label="Import from Project" className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[640px] rounded-2xl border border-border/50 bg-card shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="border-b border-border/50 bg-muted/20 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Import from Project</h3>
        </div>
        <div className="p-6 flex gap-6">
          <div className="w-[280px] shrink-0 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest pl-1">Project</label>
              <select
                value={projectPath}
                onChange={(event) => { setProjectPath(event.target.value); setTargetAgent(""); setSourcePath(""); }}
                className="h-10 w-full rounded-xl border border-border/60 bg-card/40 px-3 text-sm shadow-sm outline-none backdrop-blur-sm transition-all hover:bg-card/80 focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
              >
                {projects.map((p) => <option key={p.id} value={p.path}>{p.name}</option>)}
              </select>
            </div>

            {projectAgents.length === 0 ? (
              <div className="py-8 rounded-xl border border-dashed border-border/50 bg-muted/10 text-center text-xs text-muted-foreground/80">
                No agents detected in this project.
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest pl-1">Target Agent</label>
                <div className="flex flex-wrap gap-2">
                  {projectAgents.map((agent) => (
                    <button
                      key={agent.name}
                      onClick={() => { setTargetAgent(agent.name); setSourcePath(""); }}
                      title={agent.name}
                      aria-label={agent.name}
                      className={clsx(
                        "rounded-xl border p-2 transition-all hover:-translate-y-0.5",
                        targetAgent === agent.name
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border/60 bg-card/60 hover:bg-accent/80 hover:border-primary/30",
                      )}
                    >
                      <AgentMascot name={agent.name} size={24} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {agentFiles.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest pl-1">Configuration File</label>
                <div className="max-h-[132px] overflow-y-auto rounded-xl border border-border/60 bg-card/30 shadow-inner p-1">
                  {agentFiles.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => {
                        setSourcePath(file.path);
                        setName(file.file_name);
                      }}
                      className={clsx(
                        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-medium leading-tight transition-all",
                        sourcePath === file.path ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground/90 hover:bg-accent/50 hover:text-foreground",
                      )}
                    >
                      <span className="truncate">{file.relPath}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-4 py-1">
            <div className="space-y-1.5">
              <label htmlFor="agent-config-file-name" className="block text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest pl-1">File name</label>
              <input
                id="agent-config-file-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. AGENTS.md"
                className="h-10 w-full rounded-xl border border-border/60 bg-card/40 px-3.5 text-sm shadow-sm outline-none backdrop-blur-sm transition-all focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="agent-config-description" className="block text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest pl-1">Description</label>
              <input
                id="agent-config-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Short description"
                className="h-10 w-full rounded-xl border border-border/60 bg-card/40 px-3.5 text-sm shadow-sm outline-none backdrop-blur-sm transition-all focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="agent-config-tag" className="block text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest pl-1">Tag</label>
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
          <button onClick={onClose} className="rounded-xl border border-border/60 bg-card px-5 py-2.5 text-sm font-semibold shadow-sm transition-all hover:bg-accent hover:text-foreground">Cancel</button>
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
