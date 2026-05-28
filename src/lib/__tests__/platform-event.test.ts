import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: mocks.listen,
}));

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete (window as Window & { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
});

describe("platform event boundary", () => {
  it("returns a noop unlisten in web mode", async () => {
    const { listenTauriEvent } = await import("@/lib/platform/event");

    const unlisten = await listenTauriEvent("extensions-changed", vi.fn());

    expect(typeof unlisten).toBe("function");
    expect(mocks.listen).not.toHaveBeenCalled();
  });

  it("forwards event listeners in desktop mode", async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ =
      {};
    const cleanup = vi.fn();
    const handler = vi.fn();
    mocks.listen.mockResolvedValueOnce(cleanup);

    const { listenTauriEvent } = await import("@/lib/platform/event");
    const unlisten = await listenTauriEvent("extensions-changed", handler);

    expect(unlisten).toBe(cleanup);
    expect(mocks.listen).toHaveBeenCalledWith("extensions-changed", handler);
  });
});
