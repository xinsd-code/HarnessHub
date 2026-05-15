import { useMemo, useState } from "react";
import { useAgentConfigStore } from "@/stores/agent-config-store";
import { useAgentConfigTemplateStore } from "@/stores/agent-config-template-store";

export function ImportTemplateDialog({ onClose }: { onClose: () => void }) {
  const agentDetails = useAgentConfigStore((s) => s.agentDetails);
  const importTemplate = useAgentConfigTemplateStore((s) => s.importTemplate);
  const [sourceKey, setSourceKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("default");

  const sources = useMemo(() => {
    return agentDetails.flatMap((agent) =>
      agent.config_files
        .filter((file) => file.exists && file.category === "rules" && file.scope.type === "project")
        .map((file) => ({
          key: `${agent.name}:${file.path}`,
          agent: agent.name,
          file,
        })),
    );
  }, [agentDetails]);
  const selected = sources.find((source) => source.key === sourceKey);

  return (
    <div role="dialog" aria-label="Import from Project" className="fixed inset-0 z-50 flex items-center justify-center bg-background/60">
      <div className="w-[520px] rounded-xl border border-border bg-background p-4 shadow-xl">
        <h3 className="text-base font-semibold">Import from Project</h3>
        <div className="mt-4 space-y-3">
          <select value={sourceKey} onChange={(event) => setSourceKey(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm">
            <option value="">Select a rules file</option>
            {sources.map((source) => (
              <option key={source.key} value={source.key}>{source.file.scope.type === "project" ? source.file.scope.name : "Global"} · {source.file.file_name}</option>
            ))}
          </select>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Template name" className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm" />
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm" />
          <input value={tag} onChange={(event) => setTag(event.target.value)} placeholder="default" className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm">Cancel</button>
          <button
            disabled={!selected || !name.trim()}
            onClick={async () => {
              if (!selected || selected.file.scope.type !== "project") return;
              await importTemplate({
                sourcePath: selected.file.path,
                sourceProjectPath: selected.file.scope.path,
                sourceProjectName: selected.file.scope.name,
                name,
                description,
                tag,
              });
              onClose();
            }}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-40"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
