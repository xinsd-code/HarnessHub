import "@testing-library/jest-dom/vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AgentInfo,
  Extension,
  KitAssetCandidate,
  KitSummary,
  Project,
} from "@/lib/types";
import HarnessKitPage from "@/pages/harnesskit";

const kits: KitSummary[] = [
  {
    id: "kit-1",
    name: "Data Analyst Kit",
    description: "SQL and data analysis assets",
    skills_count: 2,
    mcp_count: 1,
    cli_count: 0,
    created_at: "2026-05-18T00:00:00Z",
    updated_at: "2026-05-18T00:00:00Z",
  },
];

const candidates: KitAssetCandidate[] = [
  {
    id: "asset:skill:frontend-design",
    kind: "skill",
    name: "frontend-design",
    description: "Build polished UI",
    source_status: "in_local_hub",
    hub_extension_id: "skill-1",
    extension_id: null,
  },
  {
    id: "asset:mcp:chrome-devtools",
    kind: "mcp",
    name: "chrome-devtools",
    description: "Browser automation",
    source_status: "will_sync_to_local_hub",
    hub_extension_id: null,
    extension_id: "mcp-1",
  },
];

type TestKitStoreState = {
  kits: KitSummary[];
  candidates: KitAssetCandidate[];
  loading: boolean;
  candidateLoading: boolean;
  error: string | null;
  fetch: ReturnType<typeof vi.fn>;
  fetchCandidates: ReturnType<typeof vi.fn>;
  createKit: ReturnType<typeof vi.fn>;
  updateKit: ReturnType<typeof vi.fn>;
  deleteKit: ReturnType<typeof vi.fn>;
  fetchKitAssets: ReturnType<typeof vi.fn>;
  previewKitProjectConflicts: ReturnType<typeof vi.fn>;
  syncKitToProject: ReturnType<typeof vi.fn>;
  unsyncKitFromProject: ReturnType<typeof vi.fn>;
};

const { state, agentState, projectState, extensionState, harnessKitState, useKitStoreMock } =
  vi.hoisted(() => {
    const state: TestKitStoreState = {
      kits: [
        {
          id: "kit-1",
          name: "Data Analyst Kit",
          description: "SQL and data analysis assets",
          skills_count: 2,
          mcp_count: 1,
          cli_count: 0,
          created_at: "2026-05-18T00:00:00Z",
          updated_at: "2026-05-18T00:00:00Z",
        },
      ],
      candidates: [
        {
          id: "asset:skill:frontend-design",
          kind: "skill",
          name: "frontend-design",
          description: "Build polished UI",
          source_status: "in_local_hub",
          hub_extension_id: "skill-1",
          extension_id: null,
        },
        {
          id: "asset:mcp:chrome-devtools",
          kind: "mcp",
          name: "chrome-devtools",
          description: "Browser automation",
          source_status: "will_sync_to_local_hub",
          hub_extension_id: null,
          extension_id: "mcp-1",
        },
      ],
      loading: false,
      candidateLoading: false,
      error: null as string | null,
      fetch: vi.fn(() => Promise.resolve()),
      fetchCandidates: vi.fn(() => Promise.resolve()),
      createKit: vi.fn(() => Promise.resolve()),
      updateKit: vi.fn(() => Promise.resolve()),
      deleteKit: vi.fn(() => Promise.resolve()),
      fetchKitAssets: vi.fn(() =>
        Promise.resolve([
          {
            hub_extension_id: "skill-1",
            kind: "skill",
            asset_name: "frontend-design",
          },
          {
            hub_extension_id: "mcp-1",
            kind: "mcp",
            asset_name: "chrome-devtools",
          },
        ]),
      ),
      previewKitProjectConflicts: vi.fn(() =>
        Promise.resolve({ conflicts: [] }),
      ),
      syncKitToProject: vi.fn(() =>
        Promise.resolve({ installed_count: 2, skipped_conflict_count: 0 }),
      ),
      unsyncKitFromProject: vi.fn(() => Promise.resolve()),
    };

    const agentState = {
      agents: [
        {
          name: "codex",
          detected: true,
          extension_count: 0,
          path: "/tmp/codex",
          enabled: true,
        },
      ] satisfies AgentInfo[],
      agentOrder: ["codex"] as const,
      fetch: vi.fn(() => Promise.resolve()),
    };

    const projectState = {
      projects: [
        {
          id: "project-1",
          name: "Demo Project",
          path: "/tmp/demo-project",
          created_at: "2026-05-18T00:00:00Z",
          exists: true,
        },
      ] satisfies Project[],
      loaded: true,
      loadProjects: vi.fn(() => Promise.resolve()),
    };

    const extensionState = {
      extensions: [] as Extension[],
      hasFetched: true,
      fetch: vi.fn(() => Promise.resolve()),
    };

    const harnessKitState = {
      harnessKits: [
        {
          id: "hk-1",
          name: "Data Workspace",
          description: "Prompt and extension bundle",
          agent_config_count: 2,
          extensions_kit_count: 1,
          skills_count: 3,
          mcp_count: 2,
          created_at: "2026-05-19T00:00:00Z",
          updated_at: "2026-05-19T00:00:00Z",
        },
      ],
      candidates: {
        agent_configs: [
          { template_id: "default/rules", template_name: "Rules" },
        ],
        extension_kits: [
          {
            id: "kit-1",
            name: "Data Analyst Kit",
            description: "SQL and data analysis assets",
            skills_count: 2,
            mcp_count: 1,
          },
        ],
        skills: [
          {
            id: "asset:skill:frontend-design",
            kind: "skill",
            name: "frontend-design",
            description: "Build polished UI",
            source_status: "in_local_hub" as const,
            hub_extension_id: "skill-1",
            extension_id: null,
          },
        ],
        mcps: [
          {
            id: "asset:mcp:chrome-devtools",
            kind: "mcp",
            name: "chrome-devtools",
            description: "Browser automation",
            source_status: "will_sync_to_local_hub" as const,
            hub_extension_id: null,
            extension_id: "mcp-1",
          },
        ],
      },
      loading: false,
      candidateLoading: false,
      error: null as string | null,
      fetch: vi.fn(() => Promise.resolve()),
      fetchCandidates: vi.fn(() => Promise.resolve()),
      createHarnessKit: vi.fn(() => Promise.resolve()),
      updateHarnessKit: vi.fn(() => Promise.resolve()),
      deleteHarnessKit: vi.fn(() => Promise.resolve()),
      fetchHarnessKitAssets: vi.fn(() =>
        Promise.resolve({
          agent_configs: [
            { template_id: "default/rules", template_name: "Rules" },
          ],
          extension_kits: [
            { kit_id: "kit-1", kit_name: "Data Analyst Kit" },
          ],
          extra_assets: [
            {
              hub_extension_id: "skill-1",
              kind: "skill",
              asset_name: "frontend-design",
            },
            {
              hub_extension_id: "mcp-1",
              kind: "mcp",
              asset_name: "chrome-devtools",
            },
          ],
        }),
      ),
    };

    const useKitStoreMock = Object.assign(
      (selector: (s: typeof state) => unknown) => selector(state),
      {
        getState: () => state,
      },
    );

    return { state, agentState, projectState, extensionState, harnessKitState, useKitStoreMock };
  });

vi.mock("@/stores/kit-store", () => ({
  useKitStore: useKitStoreMock,
}));

vi.mock("@/stores/agent-store", () => ({
  useAgentStore: (selector: (s: typeof agentState) => unknown) =>
    selector(agentState),
}));

vi.mock("@/stores/project-store", () => ({
  useProjectStore: (selector: (s: typeof projectState) => unknown) =>
    selector(projectState),
}));

vi.mock("@/stores/extension-store", () => ({
  useExtensionStore: (selector: (s: typeof extensionState) => unknown) =>
    selector(extensionState),
}));

vi.mock("@/stores/harness-kit-store", () => ({
  useHarnessKitStore: (selector: (s: typeof harnessKitState) => unknown) =>
    selector(harnessKitState),
}));

vi.mock("@/components/agent-config-hub/agent-config-hub-page", () => ({
  AgentConfigHubPage: () => <div>Agent Config Hub Page</div>,
}));

beforeEach(() => {
  state.kits = kits;
  state.candidates = candidates;
  state.loading = false;
  state.candidateLoading = false;
  state.error = null;
  state.fetch.mockClear();
  state.fetchCandidates.mockClear();
  state.createKit.mockClear();
  state.updateKit.mockClear();
  state.deleteKit.mockClear();
  state.fetchKitAssets.mockClear();
  state.previewKitProjectConflicts.mockClear();
  state.previewKitProjectConflicts.mockResolvedValue({ conflicts: [] });
  state.syncKitToProject.mockClear();
  state.syncKitToProject.mockResolvedValue({
    installed_count: 2,
    skipped_conflict_count: 0,
  });
  state.unsyncKitFromProject.mockClear();
  extensionState.extensions = [];
  extensionState.hasFetched = true;
  extensionState.fetch.mockClear();
  agentState.fetch.mockClear();
  projectState.loadProjects.mockClear();
  harnessKitState.fetch.mockClear();
  harnessKitState.fetchCandidates.mockClear();
  harnessKitState.createHarnessKit.mockClear();
  harnessKitState.updateHarnessKit.mockClear();
  harnessKitState.deleteHarnessKit.mockClear();
  harnessKitState.fetchHarnessKitAssets.mockClear();
});

describe("HarnessKitPage", () => {
  it("renders submenu, header, and Kit cards with asset counts", async () => {
    render(<HarnessKitPage />);

    fireEvent.click(screen.getByRole("button", { name: "Extensions Kit" }));

    expect(
      screen.getByRole("heading", { name: "Extensions Kit" }),
    ).toBeInTheDocument();
    const agentConfigMenu = screen.getByRole("button", {
      name: "Agent Config",
    });
    const extensionsKitMenu = screen.getByRole("button", {
      name: "Extensions Kit",
    });
    expect(
      agentConfigMenu.compareDocumentPosition(extensionsKitMenu) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "New Extensions Kit" }),
    ).toBeInTheDocument();

    const card = screen.getByText("Data Analyst Kit").closest("article");
    expect(card).toBeTruthy();
    const scoped = within(card as HTMLElement);
    expect(
      scoped.getByText("SQL and data analysis assets"),
    ).toBeInTheDocument();
    expect(scoped.getByText("Skills 2")).toBeInTheDocument();
    expect(scoped.getByText("MCP 1")).toBeInTheDocument();
    expect(scoped.queryByText("CLI 1")).not.toBeInTheDocument();

    await waitFor(() => expect(state.fetch).toHaveBeenCalled());
  });

  it("renders Agent Config from the HarnessKit submenu", () => {
    render(<HarnessKitPage />);

    fireEvent.click(screen.getByRole("button", { name: "Agent Config" }));

    expect(screen.getByText("Agent Config Hub Page")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New Extensions Kit" }),
    ).not.toBeInTheDocument();
  });

  it("filters Extensions Kits by name", () => {
    render(<HarnessKitPage />);
    fireEvent.click(screen.getByRole("button", { name: "Extensions Kit" }));

    fireEvent.change(screen.getByPlaceholderText("Search kits by name..."), {
      target: { value: "data" },
    });
    expect(screen.getByText("Data Analyst Kit")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search kits by name..."), {
      target: { value: "lark" },
    });
    expect(screen.getByText("No Kits found.")).toBeInTheDocument();
  });

  it("validates create form and submits selected candidates", async () => {
    render(<HarnessKitPage />);
    fireEvent.click(screen.getByRole("button", { name: "Extensions Kit" }));
    fireEvent.click(screen.getByRole("button", { name: "New Extensions Kit" }));

    fireEvent.click(screen.getByRole("button", { name: "Save Kit" }));
    expect(await screen.findByText("Kit name is required")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Kit name"), {
      target: { value: "Frontend Builder Kit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Kit" }));
    expect(
      await screen.findByText("Select at least one asset"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /frontend-design/i }));
    fireEvent.click(screen.getByRole("button", { name: /^MCP/ }));
    fireEvent.click(screen.getByRole("button", { name: /chrome-devtools/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save Kit" }));

    await waitFor(() =>
      expect(state.createKit).toHaveBeenCalledWith({
        name: "Frontend Builder Kit",
        description: "",
        candidate_ids: [
          "asset:skill:frontend-design",
          "asset:mcp:chrome-devtools",
        ],
      }),
    );
  });

  it("deletes only the Kit after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    render(<HarnessKitPage />);
    fireEvent.click(screen.getByRole("button", { name: "Extensions Kit" }));

    fireEvent.click(
      screen.getByRole("button", { name: /Delete Data Analyst Kit/i }),
    );

    await waitFor(() => expect(state.deleteKit).toHaveBeenCalledWith("kit-1"));
  });

  it("opens a Kit details drawer with Skills and MCP assets", async () => {
    render(<HarnessKitPage />);
    fireEvent.click(screen.getByRole("button", { name: "Extensions Kit" }));

    fireEvent.click(screen.getByText("Data Analyst Kit"));

    await waitFor(() =>
      expect(state.fetchKitAssets).toHaveBeenCalledWith("kit-1"),
    );
    expect(
      screen.getAllByRole("heading", { name: "Data Analyst Kit" }).length,
    ).toBeGreaterThan(1);
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.queryByText("frontend-design")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Skills 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /MCP 1/i }));

    expect(screen.getByText("frontend-design")).toBeInTheDocument();
    expect(screen.getByText("chrome-devtools")).toBeInTheDocument();
  });

  it("updates a Kit from the details drawer", async () => {
    render(<HarnessKitPage />);
    fireEvent.click(screen.getByRole("button", { name: "Extensions Kit" }));

    fireEvent.click(screen.getByText("Data Analyst Kit"));
    await waitFor(() =>
      expect(state.fetchKitAssets).toHaveBeenCalledWith("kit-1"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(await screen.findByLabelText("Kit name"), {
      target: { value: "Updated Kit" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() =>
      expect(state.updateKit).toHaveBeenCalledWith({
        id: "kit-1",
        name: "Updated Kit",
        description: "SQL and data analysis assets",
        candidate_ids: [
          "asset:skill:frontend-design",
          "asset:mcp:chrome-devtools",
        ],
      }),
    );
  });

  it("syncs a Kit to a project agent from the details drawer", async () => {
    render(<HarnessKitPage />);
    fireEvent.click(screen.getByRole("button", { name: "Extensions Kit" }));

    fireEvent.click(screen.getByText("Data Analyst Kit"));
    await waitFor(() =>
      expect(state.fetchKitAssets).toHaveBeenCalledWith("kit-1"),
    );

    fireEvent.change(screen.getByLabelText("Select target project"), {
      target: { value: "/tmp/demo-project" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Codex/i }));

    await waitFor(() =>
      expect(state.previewKitProjectConflicts).toHaveBeenCalledWith({
        kit_id: "kit-1",
        project_path: "/tmp/demo-project",
        target_agent: "codex",
      }),
    );
    await waitFor(() =>
      expect(state.syncKitToProject).toHaveBeenCalledWith({
        kit_id: "kit-1",
        project_path: "/tmp/demo-project",
        target_agent: "codex",
      }),
    );
    expect(
      screen.getByRole("button", { name: /Remove Kit from project/i }),
    ).toBeInTheDocument();
  });

  it("keeps a project-synced Kit agent icon highlighted after remount", async () => {
    extensionState.extensions = [
      {
        id: "project-skill-1",
        kind: "skill",
        name: "frontend-design",
        description: "Build polished UI",
        source: {
          origin: "local",
          url: null,
          version: null,
          commit_hash: null,
        },
        agents: ["codex"],
        tags: [],
        pack: null,
        permissions: [],
        enabled: true,
        trust_score: null,
        installed_at: "2026-05-18T00:00:00Z",
        updated_at: "2026-05-18T00:00:00Z",
        source_path: null,
        cli_parent_id: null,
        cli_meta: null,
        install_meta: null,
        scope: {
          type: "project",
          name: "Demo Project",
          path: "/tmp/demo-project",
        },
      },
      {
        id: "project-mcp-1",
        kind: "mcp",
        name: "chrome-devtools",
        description: "Browser automation",
        source: {
          origin: "local",
          url: null,
          version: null,
          commit_hash: null,
        },
        agents: ["codex"],
        tags: [],
        pack: null,
        permissions: [],
        enabled: true,
        trust_score: null,
        installed_at: "2026-05-18T00:00:00Z",
        updated_at: "2026-05-18T00:00:00Z",
        source_path: null,
        cli_parent_id: null,
        cli_meta: null,
        install_meta: null,
        scope: {
          type: "project",
          name: "Demo Project",
          path: "/tmp/demo-project",
        },
      },
    ];

    const { unmount } = render(<HarnessKitPage />);
    unmount();
    render(<HarnessKitPage />);
    fireEvent.click(screen.getByRole("button", { name: "Extensions Kit" }));

    fireEvent.click(screen.getByText("Data Analyst Kit"));
    await waitFor(() =>
      expect(state.fetchKitAssets).toHaveBeenCalledWith("kit-1"),
    );

    fireEvent.change(screen.getByLabelText("Select target project"), {
      target: { value: "/tmp/demo-project" },
    });

    expect(
      screen.getByRole("button", { name: /Remove Kit from project/i }),
    ).toBeInTheDocument();
  });

  it("removes a synced Kit from a project agent when the highlighted icon is clicked", async () => {
    render(<HarnessKitPage />);
    fireEvent.click(screen.getByRole("button", { name: "Extensions Kit" }));

    fireEvent.click(screen.getByText("Data Analyst Kit"));
    await waitFor(() =>
      expect(state.fetchKitAssets).toHaveBeenCalledWith("kit-1"),
    );

    fireEvent.change(screen.getByLabelText("Select target project"), {
      target: { value: "/tmp/demo-project" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Codex/i }));
    await waitFor(() => expect(state.syncKitToProject).toHaveBeenCalled());

    fireEvent.click(
      screen.getByRole("button", { name: /Remove Kit from project/i }),
    );

    await waitFor(() =>
      expect(state.unsyncKitFromProject).toHaveBeenCalledWith({
        kit_id: "kit-1",
        project_path: "/tmp/demo-project",
        target_agent: "codex",
      }),
    );
    expect(
      screen.getByRole("button", { name: /Sync Kit to Codex/i }),
    ).toBeInTheDocument();
  });

  it("lets users choose which conflicting Kit assets to overwrite", async () => {
    state.previewKitProjectConflicts.mockResolvedValueOnce({
      conflicts: [
        {
          hub_extension_id: "mcp-1",
          kind: "mcp",
          asset_name: "chrome-devtools",
          existing_extension_id: "existing-mcp-1",
        },
      ],
    });
    render(<HarnessKitPage />);
    fireEvent.click(screen.getByRole("button", { name: "Extensions Kit" }));

    fireEvent.click(screen.getByText("Data Analyst Kit"));
    await waitFor(() =>
      expect(state.fetchKitAssets).toHaveBeenCalledWith("kit-1"),
    );

    fireEvent.change(screen.getByLabelText("Select target project"), {
      target: { value: "/tmp/demo-project" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Codex/i }));

    expect(
      await screen.findByRole("dialog", {
        name: "Resolve Kit asset conflicts",
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/chrome-devtools/i));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(state.syncKitToProject).toHaveBeenCalledWith({
        kit_id: "kit-1",
        project_path: "/tmp/demo-project",
        target_agent: "codex",
        force_hub_extension_ids: ["mcp-1"],
      }),
    );
  });

  it("opens Harness Kit by default above Agent Config", async () => {
    render(<HarnessKitPage />);

    expect(screen.getByRole("heading", { name: "Harness Kit" })).toBeInTheDocument();
    const harnessKitMenu = screen.getByRole("button", { name: "Harness Kit" });
    const agentConfigMenu = screen.getByRole("button", { name: "Agent Config" });
    expect(
      harnessKitMenu.compareDocumentPosition(agentConfigMenu) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "New Harness Kit" })).toBeInTheDocument();
    await waitFor(() => expect(harnessKitState.fetch).toHaveBeenCalled());
  });

  it("renders Harness Kit cards with aggregate counts", () => {
    render(<HarnessKitPage />);

    const card = screen.getByText("Data Workspace").closest("article");
    expect(card).toBeTruthy();
    const scoped = within(card as HTMLElement);
    expect(scoped.getByText("Prompt and extension bundle")).toBeInTheDocument();
    expect(scoped.getByText("Agent Config 2")).toBeInTheDocument();
    expect(scoped.getByText("Extensions Kit 1")).toBeInTheDocument();
    expect(scoped.getByText("Skills 3")).toBeInTheDocument();
    expect(scoped.getByText("MCP 2")).toBeInTheDocument();
  });

  it("opens Harness Kit details drawer", async () => {
    render(<HarnessKitPage />);

    fireEvent.click(screen.getByText("Data Workspace"));

    await waitFor(() =>
      expect(harnessKitState.fetchHarnessKitAssets).toHaveBeenCalledWith("hk-1"),
    );
    expect(screen.getAllByRole("heading", { name: "Data Workspace" }).length).toBeGreaterThan(1);
    expect(screen.getAllByText("Agent Config").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Extensions Kit").length).toBeGreaterThanOrEqual(2);
  });

  it("keeps existing Extensions Kit section reachable", () => {
    render(<HarnessKitPage />);

    fireEvent.click(screen.getByRole("button", { name: "Extensions Kit" }));

    expect(screen.getByRole("heading", { name: "Extensions Kit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Extensions Kit" })).toBeInTheDocument();
  });
});
