import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentDetail } from "@/components/agents/agent-detail";

const scope = {
  type: "project" as const,
  name: "HarnessKit",
  path: "/workspace/hk",
};

const createProjectRulesFile = vi.fn();

const agentConfigState = {
  agentDetails: [
    {
      name: "codex",
      detected: true,
      extension_counts: { skill: 0, mcp: 0, plugin: 0, hook: 0, cli: 0 },
      config_files: [],
    },
  ],
  selectedAgent: "codex",
  addCustomPath: vi.fn(),
  createProjectRulesFile,
};

vi.mock("@/hooks/use-scope", () => ({
  useScope: () => ({ scope }),
}));

vi.mock("@/stores/agent-config-store", () => ({
  useAgentConfigStore: (selector: (state: typeof agentConfigState) => unknown) =>
    selector(agentConfigState),
}));

vi.mock("@/stores/extension-store", () => ({
  useExtensionStore: (selector: (state: { grouped: () => never[] }) => unknown) =>
    selector({ grouped: () => [] }),
}));

describe("AgentDetail", () => {
  it("supports creating a project agent config when no rules file exists", async () => {
    render(<AgentDetail />);

    fireEvent.click(screen.getAllByRole("button", { name: "New Agent Config" })[0]);
    fireEvent.change(screen.getByPlaceholderText("# Agent rules"), {
      target: { value: "# New rules" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(createProjectRulesFile).toHaveBeenCalledWith(
      "codex",
      scope,
      "# New rules",
    );
  });
});
