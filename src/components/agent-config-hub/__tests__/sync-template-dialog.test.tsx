import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncTemplateDialog } from "@/components/agent-config-hub/sync-template-dialog";

const projectState = {
  projects: [
    { id: "p1", name: "HarnessKit", path: "/workspace/hk", exists: true },
  ],
};

const agentState = {
  agents: [
    {
      name: "codex",
      detected: true,
      enabled: true,
      project_rules_target_relpath: ".codex/AGENTS.md",
      extension_count: 0,
      path: "",
      icon_path: null,
      builtin: true,
      has_custom_path: false,
    },
    {
      name: "claude",
      detected: true,
      enabled: true,
      project_rules_target_relpath: ".claude/CLAUDE.md",
      extension_count: 0,
      path: "",
      icon_path: null,
      builtin: true,
      has_custom_path: false,
    },
  ],
};

const templateStore = {
  templates: [
    {
      id: "default/rules",
      name: "rules",
      description: "desc",
      tag: "default",
      source_project_name: "HarnessKit",
      source_project_path: "/p/hk",
      source_path: "/p/hk/AGENTS.md",
      original_file_name: "AGENTS.md",
      content_path: "/hub/default/rules/prompt.md",
      size_bytes: 10,
      created_at: "2026-05-15T00:00:00Z",
      updated_at: "2026-05-15T00:00:00Z",
    },
  ],
  syncToProject: vi.fn(),
};

vi.mock("@/stores/project-store", () => ({
  useProjectStore: (selector: (state: typeof projectState) => unknown) =>
    selector(projectState),
}));

vi.mock("@/stores/agent-store", () => ({
  useAgentStore: (selector: (state: typeof agentState) => unknown) =>
    selector(agentState),
}));

vi.mock("@/stores/agent-config-template-store", () => ({
  useAgentConfigTemplateStore: (
    selector: (state: typeof templateStore) => unknown,
  ) => selector(templateStore),
}));

describe("SyncTemplateDialog", () => {
  beforeEach(() => {
    templateStore.syncToProject.mockClear();
  });

  it("shows icon-only agent buttons without visible text labels", () => {
    render(<SyncTemplateDialog templateId="default/rules" onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "codex" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "claude" })).toBeInTheDocument();
    expect(screen.queryByText("codex")).not.toBeInTheDocument();
    expect(screen.queryByText("claude")).not.toBeInTheDocument();
  });

  it("shows the fixed project path above the target path input", () => {
    render(<SyncTemplateDialog templateId="default/rules" onClose={vi.fn()} />);

    expect(screen.getByText("Target path")).toBeInTheDocument();
    expect(screen.getByText("/workspace/hk/")).toBeInTheDocument();
    expect(screen.getByDisplayValue(".codex/AGENTS.md")).toBeInTheDocument();
  });

  it("switches the default path when a different agent is selected", () => {
    render(<SyncTemplateDialog templateId="default/rules" onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "claude" }));

    expect(screen.getByDisplayValue(".claude/AGENTS.md")).toBeInTheDocument();
  });

  it("clears the agent selection when clicking the active agent and falls back to file name only", async () => {
    render(<SyncTemplateDialog templateId="default/rules" onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "codex" }));

    expect(screen.getByDisplayValue("AGENTS.md")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sync" }));

    expect(templateStore.syncToProject).toHaveBeenCalledWith(
      "default/rules",
      "/workspace/hk",
      "",
      false,
      "AGENTS.md",
    );
  });
});
