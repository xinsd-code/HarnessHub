import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/invoke";
import { transport } from "@/lib/transport";
import type { ConfigScope } from "@/lib/types";

vi.mock("@/lib/transport", () => ({
  transport: vi.fn().mockResolvedValue({}),
}));

const mockTransport = vi.mocked(transport);
const globalScope: ConfigScope = { type: "global" };

const gitCalls: Array<{
  name: string;
  call: (url: string) => Promise<unknown>;
}> = [
  {
    name: "installFromGit",
    call: (url: string) =>
      api.installFromGit(url, "codex", undefined, globalScope),
  },
  {
    name: "scanGitRepo",
    call: (url: string) => api.scanGitRepo(url, ["codex"], globalScope),
  },
  {
    name: "installNewRepoSkills",
    call: (url: string) =>
      api.installNewRepoSkills(url, ["skill-a"], ["codex"], globalScope),
  },
];

describe("git URL validation", () => {
  beforeEach(() => {
    mockTransport.mockClear();
  });

  it.each([
    "https://github.com/org/repo.git",
    "git://github.com/org/repo.git",
    "ssh://git@github.com/org/repo.git",
    "git@github.com:org/repo.git",
    "file:///Users/xinsd/repo",
    "file:///C:/repo",
    "file:///tmp/repo",
  ])("allows backend-supported URL %s", async (url) => {
    for (const { call } of gitCalls) {
      await expect(call(url)).resolves.not.toThrow();
    }
  });

  it.each([
    "",
    "not a url",
    "ftp://github.com/org/repo.git",
    "git@",
    "git@host",
    "git@host:",
    "git@   ",
  ])("rejects invalid URL %s", async (url) => {
    for (const { call } of gitCalls) {
      await expect(Promise.resolve().then(() => call(url))).rejects.toThrow(
        "Invalid git URL",
      );
    }
  });
});

describe("Harness Kit sync transport contract", () => {
  beforeEach(() => {
    mockTransport.mockClear();
  });

  const syncRequest = {
    harness_kit_id: "hk_123",
    project_path: "/tmp/project",
    target_agent: "codex",
    agent_config_paths: [{ template_id: "tpl_1", rel_path: "AGENTS.md" }],
    force_hub_extension_ids: ["hub_1"],
    force_agent_config_template_ids: ["tpl_1"],
  };

  it("sends preview requests as flat command args", async () => {
    await api.previewHarnessKitProjectConflicts(syncRequest);

    expect(mockTransport).toHaveBeenCalledWith(
      "preview_harness_kit_project_conflicts",
      {
        harnessKitId: "hk_123",
        projectPath: "/tmp/project",
        targetAgent: "codex",
        agentConfigPaths: [{ template_id: "tpl_1", rel_path: "AGENTS.md" }],
        forceHubExtensionIds: ["hub_1"],
        forceAgentConfigTemplateIds: ["tpl_1"],
      },
    );
  });

  it("sends status requests as flat command args", async () => {
    await api.listHarnessKitSyncStatuses({
      harness_kit_id: "hk_123",
      project_path: "/tmp/project",
    });

    expect(mockTransport).toHaveBeenCalledWith(
      "list_harness_kit_sync_statuses",
      {
        harnessKitId: "hk_123",
        projectPath: "/tmp/project",
      },
    );
  });

  it("sends sync requests as flat command args", async () => {
    await api.syncHarnessKitToProject(syncRequest);

    expect(mockTransport).toHaveBeenCalledWith("sync_harness_kit_to_project", {
      harnessKitId: "hk_123",
      projectPath: "/tmp/project",
      targetAgent: "codex",
      agentConfigPaths: [{ template_id: "tpl_1", rel_path: "AGENTS.md" }],
      forceHubExtensionIds: ["hub_1"],
      forceAgentConfigTemplateIds: ["tpl_1"],
    });
  });

  it("sends unsync requests as flat command args", async () => {
    await api.unsyncHarnessKitFromProject(syncRequest);

    expect(mockTransport).toHaveBeenCalledWith(
      "unsync_harness_kit_from_project",
      {
        harnessKitId: "hk_123",
        projectPath: "/tmp/project",
        targetAgent: "codex",
        agentConfigPaths: [{ template_id: "tpl_1", rel_path: "AGENTS.md" }],
        forceHubExtensionIds: ["hub_1"],
        forceAgentConfigTemplateIds: ["tpl_1"],
      },
    );
  });
});
