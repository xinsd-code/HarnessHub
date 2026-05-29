import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.clearAllMocks();
  delete (window as Window & { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
});

describe("transport runtime boundary", () => {
  it("uses HTTP transport with snake_case args in web mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { isDesktop, transport } = await import("../transport");

    await expect(
      transport("install_from_git", {
        targetAgent: "codex",
        targetScope: { type: "global" },
      }),
    ).resolves.toEqual({ ok: true });

    expect(isDesktop()).toBe(false);
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("/api/install_from_git", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_agent: "codex",
        target_scope: { type: "global" },
      }),
    });
  });

  it("loads web auth token from the URL and removes it before invoking", async () => {
    window.history.replaceState({}, "", "/?token=secret123");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { getAuthToken, transport } = await import("../transport");

    expect(getAuthToken()).toBe("secret123");
    expect(window.location.search).toBe("");

    await transport("list_extensions", {});

    expect(fetchMock).toHaveBeenCalledWith("/api/list_extensions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer secret123",
      },
      body: JSON.stringify({}),
    });
  });

  it("uses Tauri invoke with camelCase args when the runtime is present", async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ =
      {};
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mocks.invoke.mockResolvedValue({ ok: true });

    const { isDesktop, transport } = await import("../transport");

    await expect(
      transport("install_from_git", {
        targetAgent: "codex",
        targetScope: { type: "global" },
      }),
    ).resolves.toEqual({ ok: true });

    expect(isDesktop()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.invoke).toHaveBeenCalledWith("install_from_git", {
      targetAgent: "codex",
      targetScope: { type: "global" },
    });
  });
});
