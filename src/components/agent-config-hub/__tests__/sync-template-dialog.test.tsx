import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SyncTemplateDialog } from "@/components/agent-config-hub/sync-template-dialog";

const projectState = {
  projects: [{ id: "p1", name: "HarnessKit", path: "/workspace/hk", exists: true }],
};

const agentState = {
  agents: [
    { name: "codex", detected: true, enabled: true, extension_count: 0, path: "", icon_path: null, builtin: true, has_custom_path: false },
    { name: "claude", detected: true, enabled: true, extension_count: 0, path: "", icon_path: null, builtin: true, has_custom_path: false },
  ],
};

const templateStore = {
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
  useAgentConfigTemplateStore: (selector: (state: typeof templateStore) => unknown) =>
    selector(templateStore),
}));

describe("SyncTemplateDialog", () => {
  it("shows icon-only agent buttons without visible text labels", () => {
    render(<SyncTemplateDialog templateId="default/rules" onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "codex" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "claude" })).toBeInTheDocument();
    expect(screen.queryByText("codex")).not.toBeInTheDocument();
    expect(screen.queryByText("claude")).not.toBeInTheDocument();
  });
});
