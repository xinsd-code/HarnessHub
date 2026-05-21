import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HarnessKitEditor, {
  buildCoveredAssetMap,
  removeCoveredExtraCandidates,
} from "@/components/harness-kit/harness-kit-editor";
import { api } from "@/lib/invoke";
import type { HarnessKitAssetCandidates, HarnessKitAssets } from "@/lib/types";

vi.mock("@/lib/invoke", () => ({
  api: {
    getAgentConfigTemplateContent: vi.fn(),
  },
}));

const TOOLTIP_HIDE_DELAY_MS = 120;

describe("HarnessKitEditor duplicate coverage", () => {
  it("marks Skill and MCP assets covered by selected Extensions Kits", () => {
    const assets: HarnessKitAssets = {
      agent_configs: [],
      extension_kits: [],
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
    };
    const covered = buildCoveredAssetMap(
      new Set(["kit-1"]),
      new Map([["kit-1", assets]]),
      [
        {
          id: "kit-1",
          name: "Data Analyst Kit",
          description: "SQL",
          skills_count: 1,
          mcp_count: 1,
        },
      ],
    );

    expect(covered.get("skill-1")).toBe("Data Analyst Kit");
    expect(covered.get("mcp-1")).toBe("Data Analyst Kit");
  });

  it("removes selected extra candidates that are covered by Extensions Kits", () => {
    const candidates: HarnessKitAssetCandidates = {
      agent_configs: [],
      extension_kits: [],
      skills: [
        {
          id: "asset:skill:frontend-design",
          kind: "skill",
          name: "frontend-design",
          description: "UI",
          source_status: "in_local_hub",
          hub_extension_id: "skill-1",
          extension_id: null,
        },
      ],
      mcps: [
        {
          id: "asset:mcp:chrome-devtools",
          kind: "mcp",
          name: "chrome-devtools",
          description: "Browser",
          source_status: "in_local_hub",
          hub_extension_id: "mcp-1",
          extension_id: null,
        },
      ],
    };

    const result = removeCoveredExtraCandidates(
      new Set(["asset:skill:frontend-design", "asset:mcp:chrome-devtools"]),
      candidates,
      new Map([["skill-1", "Data Analyst Kit"]]),
    );

    expect([...result]).toEqual(["asset:mcp:chrome-devtools"]);
  });
});

describe("HarnessKitEditor missing dependencies", () => {
  it("drops deleted Harness Kit assets from edit submissions", async () => {
    const candidates: HarnessKitAssetCandidates = {
      agent_configs: [
        {
          template_id: "default/rules",
          template_name: "Rules",
        },
      ],
      extension_kits: [
        {
          id: "kit-1",
          name: "Data Analyst Kit",
          description: "SQL and automation bundle",
          skills_count: 0,
          mcp_count: 1,
        },
      ],
      skills: [],
      mcps: [
        {
          id: "asset:mcp:chrome-devtools",
          kind: "mcp",
          name: "chrome-devtools",
          description: "Browser",
          source_status: "in_local_hub",
          hub_extension_id: "mcp-1",
          extension_id: null,
        },
      ],
    };
    const initialAssets: HarnessKitAssets = {
      agent_configs: [
        {
          template_id: "default/test",
          template_name: "Deleted config",
        },
        {
          template_id: "default/rules",
          template_name: "Rules",
        },
      ],
      extension_kits: [
        {
          kit_id: "kit-missing",
          kit_name: "Deleted Kit",
        },
        {
          kit_id: "kit-1",
          kit_name: "Data Analyst Kit",
        },
      ],
      extra_assets: [
        {
          hub_extension_id: "skill-missing",
          kind: "skill",
          asset_name: "deleted-skill",
        },
        {
          hub_extension_id: "mcp-1",
          kind: "mcp",
          asset_name: "chrome-devtools",
        },
      ],
    };
    const onSubmit = vi.fn(() => Promise.resolve());

    render(
      <HarnessKitEditor
        initialName="My Harness"
        initialDescription="Existing"
        initialAssets={initialAssets}
        candidates={candidates}
        candidateLoading={false}
        loadExtensionKitAssets={() =>
          Promise.resolve({
            agent_configs: [],
            extension_kits: [],
            extra_assets: [],
          })
        }
        onCancel={() => {}}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save Harness Kit" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "My Harness",
      description: "Existing",
      agent_config_template_ids: ["default/rules"],
      extension_kit_ids: ["kit-1"],
      extra_candidate_ids: ["asset:mcp:chrome-devtools"],
    });
  });
});

describe("HarnessKitEditor hover preview", () => {
  const candidates: HarnessKitAssetCandidates = {
    agent_configs: [
      {
        template_id: "default/rules",
        template_name: "Rules",
      },
    ],
    extension_kits: [
      {
        id: "kit-1",
        name: "Data Analyst Kit",
        description: "SQL and automation bundle",
        skills_count: 1,
        mcp_count: 1,
      },
    ],
    skills: [],
    mcps: [],
  };

  const loadExtensionKitAssets = vi.fn<() => Promise<HarnessKitAssets>>(() =>
    Promise.resolve({
      agent_configs: [],
      extension_kits: [],
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
  );

  beforeEach(() => {
    loadExtensionKitAssets.mockClear();
    vi.mocked(api.getAgentConfigTemplateContent).mockReset();
  });

  function renderEditor() {
    return render(
      <HarnessKitEditor
        initialName="My Harness"
        initialDescription=""
        candidates={candidates}
        candidateLoading={false}
        loadExtensionKitAssets={loadExtensionKitAssets}
        onCancel={() => {}}
        onSubmit={async () => {}}
      />,
    );
  }

  it("shows agent config file content and keeps the tooltip open while hovered", async () => {
    vi.mocked(api.getAgentConfigTemplateContent).mockResolvedValue(
      "# Rules\nAlways respond in Chinese",
    );

    renderEditor();

    const row = screen.getByRole("button", { name: "Rules" });
    fireEvent.mouseEnter(row);

    await waitFor(() =>
      expect(api.getAgentConfigTemplateContent).toHaveBeenCalledWith(
        "default/rules",
      ),
    );
    expect(await screen.findByText("File Content")).toBeInTheDocument();
    expect(screen.getByText(/Always respond in Chinese/i)).toBeInTheDocument();

    fireEvent.mouseLeave(row);
    const tooltip = screen.getByRole("tooltip", { name: "Asset preview" });
    fireEvent.mouseEnter(tooltip);
    await new Promise((resolve) =>
      window.setTimeout(resolve, TOOLTIP_HIDE_DELAY_MS + 20),
    );

    expect(
      screen.getByRole("tooltip", { name: "Asset preview" }),
    ).toBeInTheDocument();

    fireEvent.mouseLeave(tooltip);
    await new Promise((resolve) =>
      window.setTimeout(resolve, TOOLTIP_HIDE_DELAY_MS + 20),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("tooltip", { name: "Asset preview" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("loads extension kit assets for preview and dismisses the tooltip after add", async () => {
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: /Extensions Kit/i }));

    const row = screen.getByRole("button", { name: /Data Analyst Kit/i });
    fireEvent.mouseEnter(row);

    await waitFor(() =>
      expect(loadExtensionKitAssets).toHaveBeenCalledWith("kit-1"),
    );
    expect(await screen.findByText("Skills (1)")).toBeInTheDocument();
    expect(screen.getByText("frontend-design")).toBeInTheDocument();
    expect(screen.getByText("chrome-devtools")).toBeInTheDocument();

    fireEvent.click(row);

    await waitFor(() =>
      expect(
        screen.queryByRole("tooltip", { name: "Asset preview" }),
      ).not.toBeInTheDocument(),
    );
  });
});
