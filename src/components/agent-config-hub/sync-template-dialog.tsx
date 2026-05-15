import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { humanizeError } from "@/lib/errors";
import { AgentMascot } from "@/components/shared/agent-mascot/agent-mascot";
import { useAgentStore } from "@/stores/agent-store";
import { useAgentConfigTemplateStore } from "@/stores/agent-config-template-store";
import { useProjectStore } from "@/stores/project-store";

const PRIMARY_TARGETS: Record<string, string> = {
  codex: ".codex/AGENTS.md",
  claude: ".claude/CLAUDE.md",
  gemini: ".gemini/GEMINI.md",
};

export function SyncTemplateDialog({ templateId, onClose }: { templateId: string; onClose: () => void }) {
  const projects = useProjectStore((s) => s.projects).filter((project) => project.exists);
  const agents = useAgentStore((s) => s.agents).filter((agent) => agent.detected || agent.enabled);
  const syncToProject = useAgentConfigTemplateStore((s) => s.syncToProject);
  const [projectPath, setProjectPath] = useState(projects[0]?.path ?? "");
  const [targetAgent, setTargetAgent] = useState(agents[0]?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [conflicted, setConflicted] = useState(false);

  const defaultRel = PRIMARY_TARGETS[agents[0]?.name ?? ""] ?? "";
  const [relPath, setRelPath] = useState(defaultRel);

  useEffect(() => {
    setRelPath(PRIMARY_TARGETS[targetAgent] ?? "");
  }, [projectPath, targetAgent]);

  return (
    <div role="dialog" aria-label="Sync to Project" className="fixed inset-0 z-50 flex items-center justify-center bg-background/60">
      <div className="w-[520px] rounded-xl border border-border bg-background p-4 shadow-xl">
        <h3 className="text-base font-semibold">Sync to Project</h3>
        <div className="mt-4 space-y-3">
          <select value={projectPath} onChange={(event) => setProjectPath(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm">
            {projects.map((p) => <option key={p.id} value={p.path}>{p.name}</option>)}
          </select>
          <div className="flex gap-2">
            {agents.map((agent) => (
              <button
                key={agent.name}
                onClick={() => setTargetAgent(agent.name)}
                title={agent.name}
                aria-label={agent.name}
                className={clsx(
                  "flex items-center justify-center rounded-lg border px-3 py-2 transition-colors",
                  targetAgent === agent.name
                    ? "border-primary bg-accent"
                    : "border-border bg-card hover:bg-accent/50",
                )}
              >
                <AgentMascot name={agent.name} size={28} />
              </button>
            ))}
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Target path</label>
            <div className="flex items-center rounded-lg border border-border bg-card">
              <span className="shrink-0 truncate border-r border-border px-3 py-2 text-sm text-muted-foreground max-w-[55%]">
                {projectPath}/
              </span>
              <input
                value={relPath}
                onChange={(event) => setRelPath(event.target.value)}
                className="h-9 min-w-0 flex-1 bg-transparent px-3 text-sm font-mono outline-none"
              />
            </div>
          </div>
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{error}</div>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm">Cancel</button>
          {conflicted && (
            <button
              onClick={async () => {
                await syncToProject(templateId, projectPath, targetAgent, true, relPath);
                onClose();
              }}
              className="rounded-lg border border-destructive/30 px-3 py-1.5 text-sm text-destructive"
            >
              Overwrite
            </button>
          )}
          <button
            onClick={async () => {
              try {
                await syncToProject(templateId, projectPath, targetAgent, false, relPath);
                onClose();
              } catch (err) {
                const message = humanizeError(String(err));
                setError(message);
                setConflicted(message.toLowerCase().includes("conflict") || message.includes("already exists"));
              }
            }}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            Sync
          </button>
        </div>
      </div>
    </div>
  );
}
