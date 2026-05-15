import { clsx } from "clsx";
import { FolderOpen, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { AgentDetail } from "@/components/agents/agent-detail";
import { AgentList } from "@/components/agents/agent-list";
import { AgentScopeTree } from "@/components/agents/agent-scope-tree";
import { AgentConfigHubPage } from "@/components/agent-config-hub/agent-config-hub-page";
import { useScope } from "@/hooks/use-scope";
import type { AgentDetail as AgentDetailType, Project } from "@/lib/types";
import { pathSegments, pathsEqual } from "@/lib/types";
import { useAgentConfigStore } from "@/stores/agent-config-store";
import { useProjectStore } from "@/stores/project-store";
import {
  resolveDeepLinkScope,
  scopesEqual,
  useScopeStore,
} from "@/stores/scope-store";

function hasProjectConfig(
  agent: AgentDetailType,
  projectPath?: string,
): boolean {
  return agent.config_files.some(
    (file) =>
      file.exists &&
      file.scope.type === "project" &&
      (projectPath == null || pathsEqual(file.scope.path, projectPath)),
  );
}

function groupProjects(projects: Project[]) {
  const groups = new Map<string, Project[]>();
  for (const project of projects) {
    const segments = pathSegments(project.path);
    const label =
      segments.length >= 2 ? segments[segments.length - 2] : "Projects";
    const current = groups.get(label) ?? [];
    current.push(project);
    groups.set(label, current);
  }
  return [...groups.entries()]
    .map(([label, items]) => ({
      label,
      projects: [...items].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export default function ProjectsPage() {
  const hydrated = useScopeStore((s) => s.hydrated);
  const fetch = useAgentConfigStore((s) => s.fetch);
  const loading = useAgentConfigStore((s) => s.loading);
  const agentDetails = useAgentConfigStore((s) => s.agentDetails);
  const selectedAgent = useAgentConfigStore((s) => s.selectedAgent);
  const selectAgent = useAgentConfigStore((s) => s.selectAgent);
  const expandFile = useAgentConfigStore((s) => s.expandFile);
  const setPendingFocusFile = useAgentConfigStore((s) => s.setPendingFocusFile);
  const { scope, setScope } = useScope();
  const projects = useProjectStore((s) => s.projects);
  const groupedProjects = useMemo(() => groupProjects(projects), [projects]);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!hydrated) return;
    fetch();
  }, [fetch, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (scope.type === "global") {
      setScope(projects.length > 0 ? { type: "all" } : { type: "global" });
    }
  }, [hydrated, projects.length, scope.type, setScope]);

  const prevScopeRef = useRef(scope);
  useEffect(() => {
    if (prevScopeRef.current !== scope) {
      useAgentConfigStore.setState({
        expandedFiles: new Set(),
        pendingFocusFile: null,
      });
      prevScopeRef.current = scope;
    }
  }, [scope]);

  useEffect(() => {
    return () => {
      useAgentConfigStore.setState({
        expandedFiles: new Set(),
        pendingFocusFile: null,
      });
    };
  }, []);

  useEffect(() => {
    const agent = searchParams.get("agent");
    if (loading || !agent) return;
    const file = searchParams.get("file");
    const targetScope = resolveDeepLinkScope(
      searchParams.get("scope"),
      projects,
    );
    if (!scopesEqual(targetScope, scope)) {
      setScope(targetScope);
      prevScopeRef.current = targetScope;
    }
    selectAgent(agent);
    if (file) {
      expandFile(file);
      setPendingFocusFile(file);
    }
    setSearchParams({}, { replace: true });
  }, [
    loading,
    searchParams,
    scope,
    setScope,
    projects,
    selectAgent,
    expandFile,
    setPendingFocusFile,
    setSearchParams,
  ]);

  const visibleAgents = agentDetails.filter((agent) => {
    if (scope.type === "all") return hasProjectConfig(agent);
    if (scope.type === "project") return hasProjectConfig(agent, scope.path);
    return false;
  });

  useEffect(() => {
    if (scope.type !== "project" || loading) return;
    if (visibleAgents.length === 0) {
      if (selectedAgent !== null) selectAgent(null);
      return;
    }
    if (
      !selectedAgent ||
      !visibleAgents.some((agent) => agent.name === selectedAgent)
    ) {
      selectAgent(visibleAgents[0].name);
    }
  }, [loading, scope.type, selectedAgent, selectAgent, visibleAgents]);

  if (!hydrated) {
    return <div className="p-4 text-sm text-muted-foreground">Loading...</div>;
  }

  const isAgentConfig = (scope as { type: string }).type === "agent-config";

  return (
    <div className="flex h-full">
      <div className="w-[240px] shrink-0 overflow-y-auto overscroll-contain border-r border-border">
        <AgentScopeTree
          projects={projects}
          scope={isAgentConfig ? { type: "all" } : scope}
          onSelectScope={setScope}
          showAgentsSection={false}
        >
          <section>
            <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Setting
            </div>
            <button
              onClick={() => setScope({ type: "agent-config" } as never)}
              className={clsx(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                isAgentConfig ? "bg-accent text-accent-foreground" : "text-foreground/75 hover:bg-accent/50",
              )}
            >
              Agent Config
            </button>
          </section>
        </AgentScopeTree>
      </div>
      {isAgentConfig ? (
        <div className="relative flex-1 min-h-0">
          <AgentConfigHubPage />
        </div>
      ) : loading ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
          Loading...
        </div>
      ) : scope.type === "all" ? (
        <div className="flex-1 overflow-y-auto overscroll-contain p-8 bg-gradient-to-br from-background via-background/95 to-accent/10">
          <div className="mb-8 max-w-4xl">
            <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              All Projects
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground/90">
              Explore your registered workspaces. Click any project to inspect its connected agents, configurations, and isolated assets.
            </p>
          </div>
          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/50 bg-accent/5 p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-3 shadow-sm">
              <FolderOpen size={32} className="text-muted-foreground/40" />
              <p>No projects added yet.</p>
            </div>
          ) : (
            <div className="space-y-8 max-w-6xl">
              {groupedProjects.map((group) => (
                <section key={group.label} className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="h-[1px] flex-1 bg-border/40" />
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/70 bg-background/50 px-2 rounded-full">
                      {group.label}
                    </span>
                    <div className="h-[1px] flex-1 bg-border/40" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {group.projects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() =>
                          setScope({
                            type: "project",
                            name: project.name,
                            path: project.path,
                          })
                        }
                        className="group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border border-border/40 bg-card/40 p-5 text-left shadow-sm backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/80 hover:shadow-md dark:hover:shadow-primary/5"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <div className="flex w-full items-start justify-between">
                          <div className={clsx("flex h-10 w-10 items-center justify-center rounded-xl shadow-sm transition-colors", project.exists ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground/50")}>
                            <FolderOpen size={20} />
                          </div>
                          {!project.exists && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/10 px-2 py-1 text-[10px] font-semibold text-destructive shadow-sm">
                              <TriangleAlert size={10} />
                              Missing
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 w-full pt-1 z-10">
                          <span
                            className={clsx(
                              "block truncate text-base font-semibold tracking-tight transition-colors group-hover:text-primary",
                              project.exists
                                ? "text-foreground"
                                : "text-muted-foreground line-through",
                            )}
                          >
                            {project.name}
                          </span>
                          <div className="mt-1.5 flex items-center text-xs text-muted-foreground/80 font-mono">
                            <span className="truncate" title={project.path}>{project.path}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="w-[190px] shrink-0 overflow-y-auto overscroll-contain border-r border-border">
            <div className="border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {scope.type === "project" ? scope.name : "Projects"}
            </div>
            <AgentList
              agents={visibleAgents}
              selectedAgent={selectedAgent}
              onSelectAgent={selectAgent}
              emptyMessage="This project has no detected agent configs yet."
            />
          </div>
          <AgentDetail />
        </>
      )}
    </div>
  );
}
