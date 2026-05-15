import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateDetailDrawer } from "@/components/agent-config-hub/template-detail-drawer";

const state = {
  templates: [{
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
  }],
  selectedId: "default/rules",
  contentCache: new Map([["default/rules", "# rules"]]),
  contentErrors: new Map(),
  contentLoading: new Set(),
  select: vi.fn(),
  updateTag: vi.fn(),
  deleteTemplate: vi.fn(),
  syncToProject: vi.fn(),
};

vi.mock("@/stores/agent-config-template-store", () => ({
  useAgentConfigTemplateStore: (selector: (s: typeof state) => unknown) => selector(state),
}));

describe("TemplateDetailDrawer", () => {
  it("renders preview and action buttons", () => {
    render(<TemplateDetailDrawer />);
    expect(screen.getByText("rules")).toBeInTheDocument();
    expect(screen.getByText("# rules")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sync to project/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit tag/i })).toBeInTheDocument();
  });

  it("closes drawer", () => {
    render(<TemplateDetailDrawer />);
    fireEvent.click(screen.getByTitle("Close"));
    expect(state.select).toHaveBeenCalledWith(null);
  });
});
