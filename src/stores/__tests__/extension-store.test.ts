import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/invoke";
import { useExtensionStore } from "@/stores/extension-store";

vi.mock("@/lib/invoke", () => ({
  api: {
    deleteExtension: vi.fn(),
  },
}));

describe("extension-store delete actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes explicit extension ids through the store action and refreshes once", async () => {
    const rescanAndFetch = vi.fn().mockResolvedValue(undefined);
    useExtensionStore.setState({ rescanAndFetch });
    vi.mocked(api.deleteExtension).mockResolvedValue(undefined);

    await useExtensionStore.getState().deleteExtensionIds(["a", "b", "a"]);

    expect(api.deleteExtension).toHaveBeenCalledTimes(2);
    expect(api.deleteExtension).toHaveBeenCalledWith("a");
    expect(api.deleteExtension).toHaveBeenCalledWith("b");
    expect(rescanAndFetch).toHaveBeenCalledTimes(1);
  });
});
