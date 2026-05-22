import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AgentsPage from "@/pages/agents";

const capturedAgents: string[][] = [];

const stores = vi.hoisted(() => ({
  agentConfigState: {
    fetch: vi.fn(),
    loading: false,
    agentDetails: [
      {
        name: "claude",
        detected: true,
        config_files: [],
        extension_counts: { skill: 0, mcp: 0, plugin: 0, hook: 0, cli: 0 },
      },
      {
        name: "codex",
        detected: true,
        config_files: [],
        extension_counts: { skill: 0, mcp: 0, plugin: 0, hook: 0, cli: 0 },
      },
    ],
    selectedAgent: null as string | null,
    selectAgent: vi.fn(),
    expandFile: vi.fn(),
    setPendingFocusFile: vi.fn(),
  },
  agentState: {
    agents: [
      {
        name: "claude",
        detected: true,
        extension_count: 0,
        path: "/tmp/claude",
        enabled: true,
      },
      {
        name: "codex",
        detected: true,
        extension_count: 0,
        path: "/tmp/codex",
        enabled: false,
      },
    ],
    fetch: vi.fn(),
    agentOrder: ["claude", "codex"],
    reorderAgents: vi.fn(),
  },
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock("@/hooks/use-scope", () => ({
  useScope: () => ({ scope: { type: "global" }, setScope: vi.fn() }),
}));

vi.mock("@/stores/scope-store", () => ({
  resolveDeepLinkScope: () => ({ type: "global" }),
  scopesEqual: () => true,
  useScopeStore: (selector: (state: { hydrated: boolean }) => unknown) =>
    selector({ hydrated: true }),
}));

vi.mock("@/stores/project-store", () => ({
  useProjectStore: (selector: (state: { projects: unknown[] }) => unknown) =>
    selector({ projects: [] }),
}));

vi.mock("@/stores/agent-store", () => ({
  useAgentStore: (selector: (state: typeof stores.agentState) => unknown) =>
    selector(stores.agentState),
}));

vi.mock("@/stores/agent-config-store", () => ({
  useAgentConfigStore: Object.assign(
    (selector: (state: typeof stores.agentConfigState) => unknown) =>
      selector(stores.agentConfigState),
    { setState: vi.fn() },
  ),
}));

vi.mock("@/components/agents/agent-detail", () => ({
  AgentDetail: () => <div>agent-detail</div>,
}));

vi.mock("@/components/agents/agent-list", () => ({
  AgentList: ({
    agents,
  }: {
    agents: Array<{ name: string }>;
    selectedAgent: string | null;
    onSelectAgent: (name: string) => void;
    sortable?: boolean;
    emptyMessage?: string;
  }) => {
    capturedAgents.push(agents.map((agent) => agent.name));
    return (
      <div>
        {agents.map((agent) => (
          <div key={agent.name}>{agent.name}</div>
        ))}
      </div>
    );
  },
}));

describe("AgentsPage", () => {
  beforeEach(() => {
    capturedAgents.length = 0;
    stores.agentConfigState.fetch.mockClear();
    stores.agentConfigState.selectAgent.mockClear();
    stores.agentState.fetch.mockClear();
  });

  it("hides inactive agents from the left menu", () => {
    render(<AgentsPage />);

    expect(screen.getByText("claude")).toBeInTheDocument();
    expect(screen.queryByText("codex")).not.toBeInTheDocument();
    expect(capturedAgents[capturedAgents.length - 1]).toEqual(["claude"]);
  });
});
