import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfigFileEntry } from "@/components/agents/config-file-entry";
import type { AgentConfigFile } from "@/lib/types";

const file: AgentConfigFile = {
  path: "/workspace/hk/.codex/AGENTS.md",
  agent: "codex",
  category: "rules",
  scope: { type: "project", name: "HarnessKit", path: "/workspace/hk" },
  file_name: "AGENTS.md",
  size_bytes: 12,
  modified_at: null,
  is_dir: false,
  exists: true,
};

const readFileContent = vi.fn().mockResolvedValue("# full content");
const writeFileContent = vi.fn().mockResolvedValue(undefined);

const agentConfigState = {
  expandedFiles: new Set([file.path]),
  toggleFile: vi.fn(),
  fetchPreview: vi.fn(),
  readFileContent,
  writeFileContent,
  openInEditor: vi.fn(),
  revealInFinder: vi.fn(),
  copyPath: vi.fn(),
  updateCustomPath: vi.fn(),
  removeCustomPath: vi.fn(),
  previewCache: new Map([[file.path, "# preview"]]),
  previewLoading: new Set<string>(),
  previewErrors: new Map<string, string>(),
  pendingFocusFile: null,
  setPendingFocusFile: vi.fn(),
};

vi.mock("@/stores/agent-config-store", () => ({
  useAgentConfigStore: (selector: (state: typeof agentConfigState) => unknown) =>
    selector(agentConfigState),
}));

describe("ConfigFileEntry", () => {
  it("loads full content for editing and saves it back", async () => {
    render(<ConfigFileEntry file={file} />);

    fireEvent.click(screen.getByRole("button", { name: /Edit Content/i }));
    expect(await screen.findByDisplayValue("# full content")).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("# full content"), {
      target: { value: "# updated content" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(writeFileContent).toHaveBeenCalledWith(
      "/workspace/hk/.codex/AGENTS.md",
      "# updated content",
    );
  });
});
