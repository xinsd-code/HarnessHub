import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HarnessKitDetailDrawer } from "@/components/harness-kit/harness-kit-detail-drawer";

// Mock the ProjectInstallPanel to avoid needing to mock AgentMascot
vi.mock("@/components/shared/project-install-panel", () => ({
  ProjectInstallPanel: vi.fn(() => <div data-testid="project-install-panel" />),
}));

describe("HarnessKitDetailDrawer insert panel", () => {
  it("renders Insert to Project with project panel when projects prop provided", () => {
    render(
      <HarnessKitDetailDrawer
        harnessKit={{
          id: "hk-1",
          name: "Data Kit",
          description: "",
          agent_config_count: 1,
          extensions_kit_count: 0,
          skills_count: 1,
          mcp_count: 0,
          created_at: "2026-05-20T00:00:00Z",
          updated_at: "2026-05-20T00:00:00Z",
        }}
        assets={{
          agent_configs: [{ template_id: "tpl-1", template_name: "Rules" }],
          extension_kits: [],
          extra_assets: [
            { hub_extension_id: "hub-1", kind: "skill", asset_name: "Skill A" },
          ],
        }}
        loading={false}
        editing={false}
        onEdit={vi.fn()}
        onClose={vi.fn()}
        editor={null}
        projects={[
          {
            id: "p1",
            name: "HarnessKit",
            path: "/workspace/hk",
            exists: true,
            created_at: "2026-05-20T00:00:00Z",
          },
        ]}
        selectedProjectPath="/workspace/hk"
        onProjectChange={vi.fn()}
        agentItems={[
          {
            name: "codex",
            installed: false,
            pending: false,
            disabled: false,
            title: "Sync to Codex",
            onClick: vi.fn(),
          },
        ]}
      />,
    );

    expect(screen.getByTestId("project-install-panel")).toBeInTheDocument();
  });

  it("does not render insert panel when projects prop is undefined", () => {
    render(
      <HarnessKitDetailDrawer
        harnessKit={{
          id: "hk-1",
          name: "Data Kit",
          description: "",
          agent_config_count: 0,
          extensions_kit_count: 0,
          skills_count: 0,
          mcp_count: 0,
          created_at: "2026-05-20T00:00:00Z",
          updated_at: "2026-05-20T00:00:00Z",
        }}
        assets={{ agent_configs: [], extension_kits: [], extra_assets: [] }}
        loading={false}
        editing={false}
        onEdit={vi.fn()}
        onClose={vi.fn()}
        editor={null}
      />,
    );

    expect(
      screen.queryByTestId("project-install-panel"),
    ).not.toBeInTheDocument();
  });
});
