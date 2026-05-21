import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProjectsPage from "@/pages/projects";

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock("@/hooks/use-scope", () => ({
  useScope: () => ({ scope: { type: "all" }, setScope: vi.fn() }),
}));

vi.mock("@/stores/scope-store", () => ({
  resolveDeepLinkScope: () => ({ type: "all" }),
  scopesEqual: () => true,
  useScopeStore: (selector: (state: { hydrated: boolean }) => unknown) =>
    selector({ hydrated: true }),
}));

vi.mock("@/stores/project-store", () => ({
  useProjectStore: (selector: (state: { projects: unknown[] }) => unknown) =>
    selector({ projects: [] }),
}));

vi.mock("@/stores/agent-config-store", () => ({
  useAgentConfigStore: Object.assign(
    (
      selector: (state: {
        fetch: () => void;
        loading: boolean;
        agentDetails: unknown[];
        selectedAgent: null;
        selectAgent: () => void;
        expandFile: () => void;
        setPendingFocusFile: () => void;
      }) => unknown,
    ) =>
      selector({
        fetch: vi.fn(),
        loading: false,
        agentDetails: [],
        selectedAgent: null,
        selectAgent: vi.fn(),
        expandFile: vi.fn(),
        setPendingFocusFile: vi.fn(),
      }),
    { setState: vi.fn() },
  ),
}));

describe("ProjectsPage menu", () => {
  it("does not render the old Setting / Agent Config submenu", () => {
    render(<ProjectsPage />);
    expect(screen.queryByText("Setting")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Agent Config" }),
    ).not.toBeInTheDocument();
  });
});
