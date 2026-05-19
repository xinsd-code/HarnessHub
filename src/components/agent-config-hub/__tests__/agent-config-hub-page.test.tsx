import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentConfigHubPage } from "@/components/agent-config-hub/agent-config-hub-page";
import type { AgentConfigTemplate } from "@/lib/types";

const templates: AgentConfigTemplate[] = [
  {
    id: "default/rules",
    name: "rules",
    description: "default rules",
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
  {
    id: "review/policy",
    name: "policy",
    description: "review policy",
    tag: "review",
    source_project_name: "xinsd-api",
    source_project_path: "/p/api",
    source_path: "/p/api/CLAUDE.md",
    original_file_name: "CLAUDE.md",
    content_path: "/hub/review/policy/prompt.md",
    size_bytes: 12,
    created_at: "2026-05-15T00:00:00Z",
    updated_at: "2026-05-15T00:00:00Z",
  },
];

const state = {
  templates,
  loading: false,
  selectedId: null as string | null,
  searchQuery: "",
  tagFilter: "all",
  fetch: vi.fn(),
  select: vi.fn(),
  setSearchQuery: vi.fn((value: string) => {
    state.searchQuery = value;
  }),
  setTagFilter: vi.fn((value: string) => {
    state.tagFilter = value;
  }),
};

vi.mock("@/stores/agent-config-template-store", () => ({
  useAgentConfigTemplateStore: (selector: (s: typeof state) => unknown) =>
    selector(state),
}));

describe("AgentConfigHubPage", () => {
  it("shows tag filter buttons and no agent labels", () => {
    render(<AgentConfigHubPage />);
    expect(
      screen.getByRole("button", { name: "New Agent Config" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Import from Project" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "default" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "review" })).toBeInTheDocument();
    expect(screen.queryByText("codex")).not.toBeInTheDocument();
    expect(screen.queryByText("claude")).not.toBeInTheDocument();
  });

  it("updates tag filter when button clicked", () => {
    render(<AgentConfigHubPage />);
    fireEvent.click(screen.getByRole("button", { name: "review" }));
    expect(state.setTagFilter).toHaveBeenCalledWith("review");
  });
});
