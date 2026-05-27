import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/invoke";
import { transport } from "@/lib/transport";
import type { ConfigScope } from "@/lib/types";

vi.mock("@/lib/transport", () => ({
  transport: vi.fn().mockResolvedValue({}),
}));

const mockTransport = vi.mocked(transport);
const globalScope: ConfigScope = { type: "global" };

const gitCalls = [
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
  ])("rejects invalid URL %s", async (url) => {
    for (const { name, call } of gitCalls) {
      await expect(
        Promise.resolve().then(() => call(url)),
        name,
      ).rejects.toThrow("Invalid git URL");
    }
  });
});
