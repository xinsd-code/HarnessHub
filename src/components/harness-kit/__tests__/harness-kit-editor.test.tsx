import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import {
  buildCoveredAssetMap,
  removeCoveredExtraCandidates,
} from "@/components/harness-kit/harness-kit-editor";
import type { HarnessKitAssetCandidates, HarnessKitAssets } from "@/lib/types";

describe("HarnessKitEditor duplicate coverage", () => {
  it("marks Skill and MCP assets covered by selected Extensions Kits", () => {
    const assets: HarnessKitAssets = {
      agent_configs: [],
      extension_kits: [],
      extra_assets: [
        { hub_extension_id: "skill-1", kind: "skill", asset_name: "frontend-design" },
        { hub_extension_id: "mcp-1", kind: "mcp", asset_name: "chrome-devtools" },
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
