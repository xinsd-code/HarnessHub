import { afterEach, describe, expect, it, vi } from "vitest";

describe("release config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the default HarnessKit release URLs", async () => {
    const { RELEASES_URL, UPDATE_INSTRUCTIONS_URL } = await import(
      "../release"
    );

    expect(RELEASES_URL).toBe(
      "https://api.github.com/repos/RealZST/HarnessKit/releases/latest",
    );
    expect(UPDATE_INSTRUCTIONS_URL).toBe(
      "https://github.com/RealZST/HarnessKit#updating",
    );
  });

  it("allows Vite env to override release URLs", async () => {
    vi.stubEnv(
      "VITE_HARNESSKIT_RELEASES_URL",
      "https://example.com/releases/latest",
    );
    vi.stubEnv(
      "VITE_HARNESSKIT_UPDATE_INSTRUCTIONS_URL",
      "https://example.com/update",
    );

    const { RELEASES_URL, UPDATE_INSTRUCTIONS_URL } = await import(
      "../release"
    );

    expect(RELEASES_URL).toBe("https://example.com/releases/latest");
    expect(UPDATE_INSTRUCTIONS_URL).toBe("https://example.com/update");
  });
});
