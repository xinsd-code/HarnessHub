import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "@/pages/settings";

const mocks = vi.hoisted(() => ({
  uiState: {
    themeName: "tiesen",
    mode: "system",
    appIcon: "icon-1",
    setThemeName: vi.fn(),
    setMode: vi.fn(),
    setAppIcon: vi.fn(),
  },
  projectState: {
    projects: [],
    loading: false,
    loadProjects: vi.fn(),
    addProject: vi.fn(),
    discoverProjects: vi.fn(),
    removeProject: vi.fn(),
  },
  agentState: {
    agents: [],
    fetch: vi.fn(),
    updatePath: vi.fn(),
    createAgent: vi.fn(),
    removeAgent: vi.fn(),
    setEnabled: vi.fn(),
    agentOrder: [] as readonly string[],
  },
  agentConfigState: {
    addCustomPaths: vi.fn(),
  },
  updateState: {
    available: null,
    checking: false,
    installing: false,
    checkForUpdate: vi.fn(),
    promptUpdate: vi.fn(),
  },
  webUpdateState: {
    available: null,
    checking: false,
    checkForUpdate: vi.fn(),
    promptUpdate: vi.fn(),
  },
}));

vi.mock("@/components/settings/appearance-settings-section", () => ({
  AppearanceSettingsSection: () => <div>Appearance Settings Mock</div>,
}));
vi.mock("@/components/settings/local-hub-settings-section", () => ({
  LocalHubSettingsSection: () => <div>Exts Hub Settings Mock</div>,
}));
vi.mock("@/components/settings/project-paths-section", () => ({
  ProjectPathsSection: () => <div>Project Paths Mock</div>,
}));
vi.mock("@/stores/ui-store", () => ({
  useUIStore: () => mocks.uiState,
}));
vi.mock("@/stores/project-store", () => ({
  useProjectStore: () => mocks.projectState,
}));
vi.mock("@/stores/agent-store", () => ({
  useAgentStore: () => mocks.agentState,
}));
vi.mock("@/stores/agent-config-store", () => ({
  useAgentConfigStore: (
    selector: (state: typeof mocks.agentConfigState) => unknown,
  ) => selector(mocks.agentConfigState),
}));
vi.mock("@/stores/update-store", () => ({
  useUpdateStore: (selector: (state: typeof mocks.updateState) => unknown) =>
    selector(mocks.updateState),
}));
vi.mock("@/stores/web-update-store", () => ({
  useWebUpdateStore: (
    selector: (state: typeof mocks.webUpdateState) => unknown,
  ) => selector(mocks.webUpdateState),
}));
vi.mock("@/lib/transport", () => ({
  isDesktop: () => false,
}));
vi.mock("@/stores/toast-store", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    mocks.projectState.loadProjects.mockClear();
    mocks.agentState.fetch.mockClear();
    mocks.updateState.checkForUpdate.mockClear();
    mocks.webUpdateState.checkForUpdate.mockClear();
  });

  it("shows Exts Hub in the settings navigation and switches to the section", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: /exts hub/i,
      }),
    );

    expect(screen.getByText("Exts Hub Settings Mock")).toBeTruthy();
  });
});
