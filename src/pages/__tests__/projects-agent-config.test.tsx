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
  useScope: () => ({ scope: { type: "agent-config" }, setScope: vi.fn() }),
}));

vi.mock("@/stores/scope-store", () => ({
  resolveDeepLinkScope: () => ({ type: "all" }),
  scopesEqual: () => true,
  useScopeStore: (selector: (state: { hydrated: boolean }) => unknown) => selector({ hydrated: true }),
}));

vi.mock("@/stores/project-store", () => ({
  useProjectStore: (selector: (state: { projects: unknown[] }) => unknown) => selector({ projects: [] }),
}));

vi.mock("@/stores/agent-config-store", () => ({
  useAgentConfigStore: Object.assign(
    (selector: (state: { fetch: () => void; loading: boolean; agentDetails: unknown[]; selectedAgent: null; selectAgent: () => void; expandFile: () => void; setPendingFocusFile: () => void }) => unknown) =>
      selector({ fetch: vi.fn(), loading: false, agentDetails: [], selectedAgent: null, selectAgent: vi.fn(), expandFile: vi.fn(), setPendingFocusFile: vi.fn() }),
    { setState: vi.fn() },
  ),
}));

vi.mock("@/components/agent-config-hub/agent-config-hub-page", () => ({
  AgentConfigHubPage: () => <div>Agent Config Hub Page</div>,
}));

describe("ProjectsPage Agent Config scope", () => {
  it("renders Agent Config hub for the virtual scope", () => {
    render(<ProjectsPage />);
    expect(screen.getByText("Agent Config Hub Page")).toBeInTheDocument();
  });
});
