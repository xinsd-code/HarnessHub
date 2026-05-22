import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HubFilters } from "@/components/local-hub/hub-filters";
import type { Extension } from "@/lib/types";

const stores = vi.hoisted(() => ({
  hubState: {
    kindFilter: null as Extension["kind"] | null,
    setKindFilter: vi.fn(),
    searchQuery: "",
    setSearchQuery: vi.fn(),
    extensions: [] as Extension[],
  },
}));

vi.mock("@/stores/hub-store", () => ({
  useHubStore: (selector: (state: typeof stores.hubState) => unknown) =>
    selector(stores.hubState),
}));

describe("HubFilters", () => {
  beforeEach(() => {
    stores.hubState.kindFilter = null;
    stores.hubState.searchQuery = "";
    stores.hubState.extensions = [];
    stores.hubState.setKindFilter.mockClear();
    stores.hubState.setSearchQuery.mockClear();
  });

  it("shows only All, skill, and MCP kind tabs", () => {
    render(<HubFilters />);

    expect(screen.getByRole("button", { name: "All" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "skill" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "MCP" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "plugin" })).toBeNull();
  });
});
