import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImportTemplateDialog } from "@/components/agent-config-hub/import-template-dialog";

const projectState = {
  projects: [
    { id: "p1", name: "HarnessKit", path: "/workspace/hk", exists: true },
  ],
};

const agentConfigState = {
  agentDetails: [
    {
      name: "codex",
      detected: true,
      extension_counts: { skill: 0, mcp: 0, plugin: 0, hook: 0, cli: 0 },
      config_files: [
        {
          path: "/workspace/hk/.codex/AGENTS.md",
          agent: "codex",
          category: "rules",
          scope: { type: "project", name: "HarnessKit", path: "/workspace/hk" },
          file_name: "AGENTS.md",
          size_bytes: 12,
          modified_at: null,
          is_dir: false,
          exists: true,
        },
        {
          path: "/workspace/hk/.codex/settings.json",
          agent: "codex",
          category: "settings",
          scope: { type: "project", name: "HarnessKit", path: "/workspace/hk" },
          file_name: "settings.json",
          size_bytes: 12,
          modified_at: null,
          is_dir: false,
          exists: true,
        },
      ],
    },
  ],
};

const templateStore = {
  importTemplate: vi.fn(),
};

vi.mock("@/stores/project-store", () => ({
  useProjectStore: (selector: (state: typeof projectState) => unknown) =>
    selector(projectState),
}));

vi.mock("@/stores/agent-config-store", () => ({
  useAgentConfigStore: (
    selector: (state: typeof agentConfigState) => unknown,
  ) => selector(agentConfigState),
}));

vi.mock("@/stores/agent-config-template-store", () => ({
  useAgentConfigTemplateStore: (
    selector: (state: typeof templateStore) => unknown,
  ) => selector(templateStore),
}));

describe("ImportTemplateDialog", () => {
  it("limits visible file list height and only shows rules files", () => {
    render(<ImportTemplateDialog onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "codex" }));

    expect(screen.getByText(".codex/AGENTS.md")).toBeInTheDocument();
    expect(screen.queryByText("settings.json")).not.toBeInTheDocument();

    const list = screen
      .getByText("Configuration File")
      .parentElement?.querySelector("div.max-h-\\[132px\\]");
    expect(list).toBeInTheDocument();
  });
});
