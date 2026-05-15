import { useState } from "react";
import { humanizeError } from "@/lib/errors";
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
  const relTarget = PRIMARY_TARGETS[targetAgent] ?? "agent project rules path";
  const project = projects.find((item) => item.path === projectPath);
  const targetPreview = project ? `${project.path}/${relTarget}` : relTarget;

  return (
    <div role="dialog" aria-label="Sync to Project" className="fixed inset-0 z-50 flex items-center justify-center bg-background/60">
      <div className="w-[520px] rounded-xl border border-border bg-background p-4 shadow-xl">
        <h3 className="text-base font-semibold">Sync to Project</h3>
        <div className="mt-4 space-y-3">
          <select value={projectPath} onChange={(event) => setProjectPath(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm">
            {projects.map((project) => <option key={project.id} value={project.path}>{project.name}</option>)}
          </select>
          <select value={targetAgent} onChange={(event) => setTargetAgent(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm">
            {agents.map((agent) => <option key={agent.name} value={agent.name}>{agent.name}</option>)}
          </select>
          <div className="rounded-lg border border-border bg-muted/30 p-2 text-xs text-muted-foreground">{targetPreview}</div>
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{error}</div>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm">Cancel</button>
          {conflicted && (
            <button
              onClick={async () => {
                await syncToProject(templateId, projectPath, targetAgent, true);
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
                await syncToProject(templateId, projectPath, targetAgent, false);
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
