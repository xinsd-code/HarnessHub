import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncDialog } from "@/components/local-hub/sync-dialog";
import type { Extension } from "@/lib/types";

function makeExtension(overrides: Partial<Extension>): Extension {
  return {
    id: "ext",
    kind: "skill",
    name: "frontend-design",
    description: "desc",
    source: {
      origin: "agent",
      url: null,
      version: null,
      commit_hash: null,
    },
    agents: [],
    tags: [],
    pack: null,
    permissions: [],
    enabled: true,
    trust_score: null,
    installed_at: "2026-05-22T00:00:00.000Z",
    updated_at: "2026-05-22T00:00:00.000Z",
    source_path: null,
    cli_parent_id: null,
    cli_meta: null,
    install_meta: null,
    scope: { type: "global" },
    ...overrides,
  };
}

const mocks = vi.hoisted(() => ({
  api: {
    previewSyncToHub: vi.fn(),
    syncExtensionsToHub: vi.fn(),
  },
  hubState: {
    fetch: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/invoke", () => ({ api: mocks.api }));
vi.mock("@/stores/hub-store", () => ({
  useHubStore: (selector: (state: typeof mocks.hubState) => unknown) =>
    selector(mocks.hubState),
}));
vi.mock("@/stores/toast-store", () => ({
  toast: mocks.toast,
}));

describe("SyncDialog", () => {
  beforeEach(() => {
    mocks.api.previewSyncToHub.mockReset();
    mocks.api.syncExtensionsToHub.mockReset();
    mocks.hubState.fetch.mockReset();
    mocks.toast.success.mockReset();
    mocks.toast.error.mockReset();
  });

  it("filters plugin extensions out of the sync options and default selection", async () => {
    mocks.api.previewSyncToHub.mockResolvedValue({
      to_sync: [
        makeExtension({ id: "skill-1", kind: "skill", name: "frontend" }),
        makeExtension({ id: "mcp-1", kind: "mcp", name: "db" }),
        makeExtension({ id: "plugin-1", kind: "plugin", name: "bridge" }),
      ],
    });
    mocks.api.syncExtensionsToHub.mockResolvedValue([
      makeExtension({ id: "skill-1", kind: "skill", name: "frontend" }),
      makeExtension({ id: "mcp-1", kind: "mcp", name: "db" }),
    ]);

    render(<SyncDialog open onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("frontend")).toBeTruthy();
      expect(screen.getByText("db")).toBeTruthy();
    });
    expect(screen.queryByText("bridge")).toBeNull();
    expect(screen.queryByRole("button", { name: /plugins/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /sync \(2\)/i }));

    await waitFor(() => {
      expect(mocks.api.syncExtensionsToHub).toHaveBeenCalledWith([
        "skill-1",
        "mcp-1",
      ]);
    });
  });
});
